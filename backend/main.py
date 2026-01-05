import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import MAX_MB
from .models import AnalysisResult, ToolStatus, Finding
from .utils import sha256_file
from .engine import (
    tool_versions, detect_media_type, extract_exiftool, extract_ffprobe, extract_c2pa,
    ai_disclosure_from_metadata, transformation_hints, classify_provenance, derived_timeline, metadata_consistency, metadata_completeness
)
from .report import build_pdf_report

app = FastAPI(title="TruthStamp API", version="0.2.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True, "service": "truthstamp-api"}

def _too_big(nbytes: int) -> bool:
    return nbytes > MAX_MB * 1024 * 1024

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

        sha = sha256_file(in_path)
        media_type = detect_media_type(in_path)
        tools = tool_versions()

        meta = extract_exiftool(in_path) if media_type in {"image", "video", "unknown"} else {}
        ff = extract_ffprobe(in_path) if media_type in {"video", "unknown"} else {}
        c2pa = extract_c2pa(in_path)

        ai = ai_disclosure_from_metadata(meta if isinstance(meta, dict) else {})
        trans = transformation_hints(meta if isinstance(meta, dict) else {}, ff if isinstance(ff, dict) else {})
        tl = derived_timeline(meta if isinstance(meta, dict) else {})
        cons = metadata_consistency(meta if isinstance(meta, dict) else {})
        prov_state, prov_summary = classify_provenance(c2pa, meta if isinstance(meta, dict) else {})

        make = (meta.get("EXIF:Make") or meta.get("Make")) if isinstance(meta, dict) else None
        model = (meta.get("EXIF:Model") or meta.get("Model")) if isinstance(meta, dict) else None
        sw = (meta.get("EXIF:Software") or meta.get("XMP:CreatorTool") or meta.get("Software")) if isinstance(meta, dict) else None

        extra = []
        if make or model:
            extra.append(f"Device metadata suggests capture on: {(make or '').strip()} {(model or '').strip()}".strip())
        if sw:
            extra.append(f"Software/creator tool tag: {sw}")
        if ai.get("declared") == "POSSIBLE":
            extra.append(f"AI-related markers present in metadata: {', '.join(ai.get('signals', [])[:6])}")
        if trans.get("screenshot_likelihood") == "HIGH":
            extra.append("Workflow hints suggest possible screenshot/screen capture.")

        summary = prov_summary + (" " + " ".join(extra) if extra else "")

        tool_list = [
            ToolStatus(name=k, available=v["available"], version=v.get("version"), notes=v.get("notes"))
            for k, v in tools.items()
        ]

        findings = [
            Finding(key="provenance_state", value=prov_state, confidence="PROVABLE" if prov_state != "UNVERIFIABLE_NO_PROVENANCE" else "INFERRED"),
        ]
        if make or model:
            findings.append(Finding(key="device_make_model", value=f"{make or ''} {model or ''}".strip(), confidence="INFERRED"))
        else:
            findings.append(Finding(key="device_make_model", value=None, confidence="UNKNOWN", notes="No camera Make/Model metadata found."))

        result = AnalysisResult(
            filename=file.filename or "upload",
            media_type=media_type,
            sha256=sha,
            bytes=len(contents),
            provenance_state=prov_state,
            summary=summary,
            tools=tool_list,
            c2pa=c2pa,
            metadata=meta if isinstance(meta, dict) else {},
            ai_disclosure=ai,
            transformations=trans,
            derived_timeline=tl,
            metadata_consistency=cons,
            metadata_completeness=metadata_completeness(meta if isinstance(meta, dict) else {}),
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
                "analyzed_at": __import__("datetime").datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
                "tools": {t.name: {"available": t.available, "version": t.version} for t in tool_list},
            },
            findings=findings,
        )
        return JSONResponse(result.model_dump())

def _cleanup_file(path: str) -> None:
    try:
        os.remove(path)
    except Exception:
        pass

@app.post("/report")
async def report(
    background_tasks: BackgroundTasks,
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

        sha = sha256_file(in_path)
        media_type = detect_media_type(in_path)
        tools = tool_versions()

        meta = extract_exiftool(in_path) if media_type in {"image", "video", "unknown"} else {}
        ff = extract_ffprobe(in_path) if media_type in {"video", "unknown"} else {}
        c2pa = extract_c2pa(in_path)

        ai = ai_disclosure_from_metadata(meta if isinstance(meta, dict) else {})
        trans = transformation_hints(meta if isinstance(meta, dict) else {}, ff if isinstance(ff, dict) else {})
        tl = derived_timeline(meta if isinstance(meta, dict) else {})
        cons = metadata_consistency(meta if isinstance(meta, dict) else {})
        prov_state, prov_summary = classify_provenance(c2pa, meta if isinstance(meta, dict) else {})

        make = (meta.get("EXIF:Make") or meta.get("Make")) if isinstance(meta, dict) else None
        model = (meta.get("EXIF:Model") or meta.get("Model")) if isinstance(meta, dict) else None
        sw = (meta.get("EXIF:Software") or meta.get("XMP:CreatorTool") or meta.get("Software")) if isinstance(meta, dict) else None

        extra = []
        if make or model:
            extra.append(f"Device metadata suggests capture on: {(make or '').strip()} {(model or '').strip()}".strip())
        if sw:
            extra.append(f"Software/creator tool tag: {sw}")
        if ai.get("declared") == "POSSIBLE":
            extra.append(f"AI-related markers present in metadata: {', '.join(ai.get('signals', [])[:6])}")
        if trans.get("screenshot_likelihood") == "HIGH":
            extra.append("Workflow hints suggest possible screenshot/screen capture.")

        summary = prov_summary + (" " + " ".join(extra) if extra else "")

        tool_list = [
            {"name": k, "available": v["available"], "version": v.get("version"), "notes": v.get("notes")}
            for k, v in tools.items()
        ]

        result = {
            "filename": file.filename or "upload",
            "media_type": media_type,
            "sha256": sha,
            "bytes": len(contents),
            "provenance_state": prov_state,
            "summary": summary,
            "tools": tool_list,
            "c2pa": c2pa,
            "metadata": meta if isinstance(meta, dict) else {},
            "ai_disclosure": ai,
            "transformations": trans,
            "derived_timeline": tl,
            "metadata_consistency": cons,
            "decision_context": {
                "purpose": "Support financial, legal, or editorial decision-making without guessing.",
                "principle": "Separates provable facts, technical observations, and unknowns.",
            },
            "what_would_make_verifiable": [
                "Capture from a C2PA-enabled camera/app",
                "Preserve the original file without re-export or platform recompression",
                "Seal media at capture inside a trusted app or device workflow",
            ],
            "report_integrity": {
                "analyzed_at": __import__("datetime").datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
                "tools": {t["name"]: {"available": t["available"], "version": t.get("version")} for t in tool_list},
            },
        }

        # IMPORTANT: FileResponse streams after return. Do NOT place the PDF inside
        # TemporaryDirectory that will be deleted immediately.
        out_f = tempfile.NamedTemporaryFile(prefix="truthstamp_", suffix=".pdf", delete=False)
        out_pdf = out_f.name
        out_f.close()

        build_pdf_report(out_pdf, result)

        background_tasks.add_task(_cleanup_file, out_pdf)
        return FileResponse(out_pdf, media_type="application/pdf", filename=f"TruthStamp_Report_{sha[:10]}.pdf")


from pydantic import BaseModel, EmailStr
import pathlib
import datetime

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
