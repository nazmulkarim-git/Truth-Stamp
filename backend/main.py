import os
import json
import tempfile
import traceback
import datetime
import pathlib
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from .config import MAX_MB
from .models import AnalysisResult, ToolStatus, Finding
from .utils import sha256_file
from .engine import (
    tool_versions,
    detect_media_type,
    extract_exiftool,
    extract_ffprobe,
    extract_c2pa,
    ai_disclosure_from_metadata,
    transformation_hints,
    classify_provenance,
    derived_timeline,
    metadata_consistency,
    metadata_completeness,
)
from .report import build_pdf_report

app = FastAPI()

# Allow your frontend origin (comma-separated)
origins = os.getenv("CORS_ORIGINS", "https://truthstamp-web.onrender.com").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "service": "truthstamp-api"}


def _too_big(nbytes: int) -> bool:
    return nbytes > MAX_MB * 1024 * 1024


def _cleanup_file(path: Optional[str]) -> None:
    if not path:
        return
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


def _analyze_to_model(
    in_path: str,
    filename: Optional[str],
    role: Optional[str],
    use_case: Optional[str],
    bytes_len: int,
) -> AnalysisResult:
    """
    Single source of truth for analysis used by BOTH /analyze and /report.
    Returns an AnalysisResult object.
    """
    sha = sha256_file(in_path)
    media_type = detect_media_type(in_path)
    tools = tool_versions() or {}

    meta = extract_exiftool(in_path) if media_type in {"image", "video", "unknown"} else {}
    ff = extract_ffprobe(in_path) if media_type in {"video", "unknown"} else {}
    c2pa = extract_c2pa(in_path)

    meta_d = meta if isinstance(meta, dict) else {}
    ff_d = ff if isinstance(ff, dict) else {}

    ai = ai_disclosure_from_metadata(meta_d)
    trans = transformation_hints(meta_d, ff_d)
    tl = derived_timeline(meta_d)
    cons = metadata_consistency(meta_d)
    prov_state, prov_summary = classify_provenance(c2pa, meta_d)

    make = meta_d.get("EXIF:Make") or meta_d.get("Make")
    model = meta_d.get("EXIF:Model") or meta_d.get("Model")
    sw = meta_d.get("EXIF:Software") or meta_d.get("XMP:CreatorTool") or meta_d.get("Software")

    extra = []
    if make or model:
        extra.append(
            f"Device metadata suggests capture on: {(make or '').strip()} {(model or '').strip()}".strip()
        )
    if sw:
        extra.append(f"Software/creator tool tag: {sw}")

    # Be defensive: ai/trans might not be dict depending on engine impl
    if isinstance(ai, dict) and ai.get("declared") == "POSSIBLE":
        extra.append(f"AI-related markers present in metadata: {', '.join((ai.get('signals') or [])[:6])}")
    if isinstance(trans, dict) and trans.get("screenshot_likelihood") == "HIGH":
        extra.append("Workflow hints suggest possible screenshot/screen capture.")

    summary = prov_summary + (" " + " ".join(extra) if extra else "")

    tool_list = [
        ToolStatus(
            name=k,
            available=v.get("available", False) if isinstance(v, dict) else False,
            version=v.get("version") if isinstance(v, dict) else None,
            notes=v.get("notes") if isinstance(v, dict) else None,
        )
        for k, v in tools.items()
    ]

    findings = [
        Finding(
            key="provenance_state",
            value=prov_state,
            confidence="PROVABLE" if prov_state != "UNVERIFIABLE_NO_PROVENANCE" else "INFERRED",
        ),
    ]
    if make or model:
        findings.append(
            Finding(
                key="device_make_model",
                value=f"{make or ''} {model or ''}".strip(),
                confidence="INFERRED",
            )
        )
    else:
        findings.append(
            Finding(
                key="device_make_model",
                value=None,
                confidence="UNKNOWN",
                notes="No camera Make/Model metadata found.",
            )
        )

    return AnalysisResult(
        filename=filename or "upload",
        role=role,
        use_case=use_case,
        media_type=media_type,
        sha256=sha,
        bytes=bytes_len,
        provenance_state=prov_state,
        summary=summary,
        tools=tool_list,
        c2pa=c2pa,
        metadata=meta_d,
        ffprobe=ff_d,
        ai_disclosure=ai,
        transformations=trans,
        derived_timeline=tl,
        metadata_consistency=cons,
        metadata_completeness=metadata_completeness(meta_d),
        what_this_report_is=[
            "Cryptographic provenance verification when present (C2PA)",
            "Structured technical observations (metadata, encoding, workflow hints)",
            "Clear separation of provable facts, derived observations, and unknowns",
        ],
        what_this_report_is_not=[
            "A probability score of being fake",
            "A determination of authenticity or intent",
            "A detector of specific deepfake models",
        ],
        decision_context={
            "purpose": "Support financial, legal, or editorial decision-making without guessing.",
            "principle": "Separates provable facts, technical observations, and unknowns.",
        },
        what_would_make_verifiable=[
            "Capture from a C2PA-enabled camera/app",
            "Preserve the original file without re-export or platform recompression",
            "Seal media at capture inside a trusted app or device workflow",
        ],
        report_integrity={
            "analyzed_at": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
            "tools": {t.name: {"available": t.available, "version": t.version} for t in tool_list},
        },
        findings=findings,
    )


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(...),
    role: str | None = Form(default=None),
    use_case: str | None = Form(default=None),
):
    contents = await file.read()
    if _too_big(len(contents)):
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_MB} MB.")

    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, file.filename or "upload.bin")
        with open(in_path, "wb") as f:
            f.write(contents)

        # Return model directly (FastAPI serializes it)
        return _analyze_to_model(in_path, file.filename, role, use_case, bytes_len=len(contents))


@app.post("/report")
async def report(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    role: str | None = Form(default=None),
    use_case: str | None = Form(default=None),
):
    tmp_in = None
    tmp_pdf = None

    try:
        contents = await file.read()
        if _too_big(len(contents)):
            raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_MB} MB.")

        # Save upload to /tmp (Render-safe)
        suffix = os.path.splitext(file.filename or "")[-1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            tmp_in = f.name
            f.write(contents)

        analysis_model = _analyze_to_model(tmp_in, file.filename, role, use_case, bytes_len=len(contents))

        # Create PDF in /tmp
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as pf:
            tmp_pdf = pf.name

        # IMPORTANT: report builder expects a dict with .get()
        build_pdf_report(analysis_model.model_dump(), tmp_pdf)

        # Cleanup after response is sent
        background_tasks.add_task(_cleanup_file, tmp_in)
        background_tasks.add_task(_cleanup_file, tmp_pdf)

        return FileResponse(
            tmp_pdf,
            media_type="application/pdf",
            filename="truthstamp-report.pdf",
        )

    except HTTPException:
        background_tasks.add_task(_cleanup_file, tmp_in)
        background_tasks.add_task(_cleanup_file, tmp_pdf)
        raise

    except Exception as e:
        print("REPORT_GENERATION_ERROR:", repr(e))
        print(traceback.format_exc())
        background_tasks.add_task(_cleanup_file, tmp_in)
        background_tasks.add_task(_cleanup_file, tmp_pdf)
        raise HTTPException(status_code=500, detail="Report generation failed. See API logs.")


# --- Pilot leads ---
class LeadIn(BaseModel):
    email: EmailStr
    role: str | None = None
    use_case: str | None = None
    notes: str | None = None


@app.post("/lead")
async def lead(payload: LeadIn):
    """Collect pilot program leads. Stored as JSONL on ephemeral disk."""
    try:
        line = {
            "email": payload.email,
            "role": payload.role,
            "use_case": payload.use_case,
            "notes": payload.notes,
            "received_at": datetime.datetime.utcnow().isoformat() + "Z",
        }
        out_dir = pathlib.Path("/tmp/truthstamp")
        out_dir.mkdir(parents=True, exist_ok=True)
        with (out_dir / "leads.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps(line) + "\n")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
