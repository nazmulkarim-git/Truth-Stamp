import os
import json
import tempfile
import traceback
import datetime
import pathlib
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Form, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from .config import MAX_MB
from .models import (
    AnalysisResult,
    ToolStatus,
    Finding,
    CaseCreate,
    CaseItem,
    EvidenceItem,
    EventItem,
)
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
from . import workspace

app = FastAPI()

# --- Initialize workspace DB (Render: ephemeral /tmp, fine for demo) ---
workspace.init_db()

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


def _actor_from_request(request: Request) -> Optional[str]:
    # Frontend can send X-TruthStamp-Actor or X-Actor
    return request.headers.get("x-truthstamp-actor") or request.headers.get("x-actor")


def _analyze_to_model(
    in_path: str,
    filename: Optional[str],
    role: Optional[str],
    use_case: Optional[str],
    bytes_len: int,
    case_id: Optional[str] = None,
    evidence_id: Optional[str] = None,
) -> AnalysisResult:
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

    now_utc = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    return AnalysisResult(
        filename=filename or "upload",
        role=role,
        use_case=use_case,
        case_id=case_id,
        evidence_id=evidence_id,
        media_type=media_type,
        sha256=sha,
        bytes=bytes_len,
        provenance_state=prov_state,
        summary=summary,
        tools=tool_list,
        c2pa=c2pa if isinstance(c2pa, dict) else {},
        metadata=meta_d,
        ffprobe=ff_d,
        ai_disclosure=ai if isinstance(ai, dict) else {},
        transformations=trans if isinstance(trans, dict) else {},
        derived_timeline=tl if isinstance(tl, dict) else {},
        metadata_consistency=cons if isinstance(cons, dict) else {},
        metadata_completeness=metadata_completeness(meta_d) if isinstance(meta_d, dict) else {},
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
            "purpose": "Support legal, insurance, compliance, or editorial decisions without guessing.",
            "principle": "Separates provable facts, technical observations, and unknowns.",
        },
        what_would_make_verifiable=[
            "Capture from a C2PA-enabled camera/app",
            "Preserve the original file without re-export or platform recompression",
            "Seal media at capture inside a trusted app or device workflow",
        ],
        report_integrity={
            "timestamp": now_utc,
            "analyzed_at": now_utc,
            "tools": {t.name: {"available": t.available, "version": t.version} for t in tool_list},
        },
        findings=findings,
        limitations=[
            "Absence of cryptographic provenance is not evidence of manipulation; it limits verifiability.",
            "Metadata can be missing or altered by common workflows (screenshots, exports, messaging apps, social platforms).",
            "This report reflects the state of the provided file at the time of analysis.",
        ],
    )


# -----------------------------
# Evidence Workspace (Cases)
# -----------------------------

@app.post("/cases", response_model=CaseItem)
def create_case(payload: CaseCreate):
    c = workspace.create_case(payload.title, payload.description)
    # initial event
    workspace.add_event(c["id"], "case.created", details={"title": payload.title})
    return c


@app.get("/cases", response_model=list[CaseItem])
def list_cases(limit: int = 50, offset: int = 0):
    return workspace.list_cases(limit=limit, offset=offset)


@app.get("/cases/{case_id}", response_model=CaseItem)
def get_case(case_id: str):
    c = workspace.get_case(case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return c


@app.get("/cases/{case_id}/evidence", response_model=list[EvidenceItem])
def list_case_evidence(case_id: str, limit: int = 200):
    if not workspace.get_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    return workspace.list_evidence(case_id, limit=limit)


@app.get("/cases/{case_id}/evidence/{evidence_id}")
def get_case_evidence(case_id: str, evidence_id: str):
    evd = workspace.get_evidence(case_id, evidence_id)
    if not evd:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evd


@app.get("/cases/{case_id}/events", response_model=list[EventItem])
def list_case_events(case_id: str, limit: int = 200):
    if not workspace.get_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    return workspace.list_events(case_id, limit=limit)


# -----------------------------
# Analysis & Report
# -----------------------------

@app.post("/analyze", response_model=AnalysisResult)
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    role: str | None = Form(default=None),
    use_case: str | None = Form(default=None),
    case_id: str | None = Form(default=None),
):
    contents = await file.read()
    if _too_big(len(contents)):
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_MB} MB.")

    actor = _actor_from_request(request)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, file.filename or "upload.bin")
        with open(in_path, "wb") as f:
            f.write(contents)

        analysis_model = _analyze_to_model(in_path, file.filename, role, use_case, bytes_len=len(contents), case_id=case_id)

        # If attached to a case, store evidence + events
        if case_id:
            if not workspace.get_case(case_id):
                raise HTTPException(status_code=404, detail="Case not found")

            analysis_dict = analysis_model.model_dump()
            evidence = workspace.add_evidence(case_id, analysis_dict)

            # update model to include evidence_id
            analysis_model.evidence_id = evidence["id"]

            workspace.add_event(
                case_id,
                "evidence.uploaded",
                evidence_id=evidence["id"],
                actor=actor,
                ip=ip,
                user_agent=ua,
                details={"filename": analysis_model.filename, "bytes": analysis_model.bytes},
            )
            workspace.add_event(
                case_id,
                "evidence.analyzed",
                evidence_id=evidence["id"],
                actor=actor,
                ip=ip,
                user_agent=ua,
                details={"provenance_state": analysis_model.provenance_state, "sha256": analysis_model.sha256},
            )

        return analysis_model


@app.post("/report")
async def report(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    role: str | None = Form(default=None),
    use_case: str | None = Form(default=None),
    case_id: str | None = Form(default=None),
):
    tmp_in = None
    tmp_pdf = None

    actor = _actor_from_request(request)
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    try:
        contents = await file.read()
        if _too_big(len(contents)):
            raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_MB} MB.")

        suffix = os.path.splitext(file.filename or "")[-1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            tmp_in = f.name
            f.write(contents)

        analysis_model = _analyze_to_model(tmp_in, file.filename, role, use_case, bytes_len=len(contents), case_id=case_id)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as pf:
            tmp_pdf = pf.name

        analysis_dict = analysis_model.model_dump()
        build_pdf_report(analysis_dict, tmp_pdf)

        # If attached to a case, store evidence + events (and mark report generated)
        if case_id:
            if not workspace.get_case(case_id):
                raise HTTPException(status_code=404, detail="Case not found")

            evidence = workspace.add_evidence(case_id, analysis_dict)
            analysis_model.evidence_id = evidence["id"]

            workspace.add_event(
                case_id,
                "evidence.uploaded",
                evidence_id=evidence["id"],
                actor=actor,
                ip=ip,
                user_agent=ua,
                details={"filename": analysis_model.filename, "bytes": analysis_model.bytes},
            )
            workspace.add_event(
                case_id,
                "evidence.analyzed",
                evidence_id=evidence["id"],
                actor=actor,
                ip=ip,
                user_agent=ua,
                details={"provenance_state": analysis_model.provenance_state, "sha256": analysis_model.sha256},
            )
            workspace.add_event(
                case_id,
                "report.generated",
                evidence_id=evidence["id"],
                actor=actor,
                ip=ip,
                user_agent=ua,
                details={"report_filename": "truthstamp-report.pdf"},
            )

        background_tasks.add_task(_cleanup_file, tmp_in)
        background_tasks.add_task(_cleanup_file, tmp_pdf)

        return FileResponse(tmp_pdf, media_type="application/pdf", filename="truthstamp-report.pdf")

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
    """Collect pilot program leads. Stored as JSONL on ephemeral disk (/tmp)."""
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
