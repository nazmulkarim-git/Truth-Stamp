from reportlab.lib.pagesizes import LETTER
from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, Paragraph
from reportlab.lib.units import inch
from reportlab.lib.colors import black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from typing import Dict, Any, List
import datetime
import json
import re

def _safe_text(v: Any, max_len: int = 600) -> str:
    # ReportLab's default built-in fonts (e.g., Helvetica) are not full-Unicode.
    # To avoid 500s on metadata/filenames with non-Latin characters,
    # we coerce text to latin-1 with replacement.
    if v is None:
        return ""
    s = str(v)
    s = s.replace("\x00", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) > max_len:
        s = s[:max_len] + "…"
    try:
        return s.encode("latin-1", "replace").decode("latin-1")
    except Exception:
        return "".join(ch if ord(ch) < 128 else "?" for ch in s)

def _kv_table(data: Dict[str, Any], max_rows: int = 25) -> Table:
    rows = [["Key", "Value"]]
    count = 0
    for k, v in data.items():
        if count >= max_rows:
            break
        if isinstance(v, (dict, list)):
            vv = json.dumps(v, ensure_ascii=False)
        else:
            vv = v
        rows.append([_safe_text(k, 120), _safe_text(vv, 600)])
        count += 1

    t = Table(rows, colWidths=[2.2 * inch, 4.8 * inch])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (0, 0), (-1, 0), 1, black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

def _hash_result_for_id(result: Dict[str, Any]) -> str:
    import hashlib
    # Canonical hash over key fields (exclude large raw blobs where possible)
    payload = {
        "filename": result.get("filename"),
        "sha256": result.get("sha256"),
        "bytes": result.get("bytes"),
        "media_type": result.get("media_type"),
        "provenance_state": result.get("provenance_state"),
        "summary": result.get("summary"),
        "ai_disclosure": result.get("ai_disclosure"),
        "transformations": result.get("transformations"),
        "metadata_consistency": result.get("metadata_consistency"),
        "derived_timeline": result.get("derived_timeline"),
        "tools": result.get("tools"),
        # include c2pa status only (not full manifest) to keep stable + small
        "c2pa_status": (result.get("c2pa") or {}).get("_status") if isinstance(result.get("c2pa"), dict) else None,
    }
    s = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(s.encode("utf-8", errors="replace")).hexdigest()

def build_pdf_report(out_path: str, result: Dict[str, Any]) -> None:
    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_LEFT)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=14, alignment=TA_LEFT)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=13, alignment=TA_LEFT)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12, alignment=TA_LEFT)

    doc = SimpleDocTemplate(out_path, pagesize=LETTER, leftMargin=0.8 * inch, rightMargin=0.8 * inch, topMargin=0.8 * inch, bottomMargin=0.8 * inch)
    story: List[Any] = []

    # ---- Header ----
    story.append(Paragraph("TruthStamp — Evidence Provenance Report", title))
    story.append(Paragraph("Cryptographic proof when available. No guessing.", small))
    story.append(Spacer(1, 0.18 * inch))

    analyzed_at = (result.get("report_integrity") or {}).get("analyzed_at") or datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    report_hash = _hash_result_for_id(result)
    report_id = report_hash[:12]

    # ---- Decision context ----
    story.append(Paragraph("Decision context", h2))
    story.append(Paragraph(
        "This report is designed to support financial, legal, or editorial decision-making. "
        "It separates <b>cryptographically provable facts</b>, <b>technical observations</b>, and <b>unknowns</b>.",
        body
    ))
    story.append(Spacer(1, 0.12 * inch))

    
# ---- What this report is / is not ----
story.append(Paragraph("What this report is (and is not)", h2))
is_list = result.get("what_this_report_is") or [
    "Cryptographic provenance verification when present (C2PA)",
    "Structured technical observations (metadata, encoding, workflow hints)",
    "Clear separation of provable facts, derived observations, and unknowns",
]
not_list = result.get("what_this_report_is_not") or [
    "A probability score of being fake",
    "A determination of authenticity or intent",
    "A detector of specific deepfake models",
]
story.append(Paragraph("<b>This report is:</b><br/>- " + "<br/>- ".join(_safe_text(x, 200) for x in is_list), body))
story.append(Spacer(1, 0.06 * inch))
story.append(Paragraph("<b>This report is not:</b><br/>- " + "<br/>- ".join(_safe_text(x, 200) for x in not_list), body))
story.append(Spacer(1, 0.14 * inch))

    # ---- Executive summary ----
    story.append(Paragraph("Executive summary", h2))
    exec_summary = {
        "Report ID": report_id,
        "Analysis time": analyzed_at,
        "Filename": _safe_text(result.get("filename")),
        "Media type": _safe_text(result.get("media_type")),
        "SHA-256 (file fingerprint)": _safe_text(result.get("sha256")),
        "Size (bytes)": _safe_text(result.get("bytes")),
        "Provenance status": _safe_text(result.get("provenance_state")),
    }
    story.append(_kv_table(exec_summary, max_rows=20))
    story.append(Spacer(1, 0.12 * inch))

    # ---- Status matrix ----
    prov_state = str(result.get("provenance_state") or "")
    c2pa_present = "YES" if prov_state in {"VERIFIED_ORIGINAL", "ALTERED_OR_BROKEN_PROVENANCE"} else "NO"
    ai_decl = (result.get("ai_disclosure") or {}).get("declared", "UNKNOWN")
    tamper = "POSSIBLE" if prov_state == "ALTERED_OR_BROKEN_PROVENANCE" else ("NO_EVIDENCE" if prov_state == "VERIFIED_ORIGINAL" else "UNKNOWN")
    cons_status = (result.get("metadata_consistency") or {}).get("status", "UNKNOWN")

    story.append(Paragraph("Evidence status (high-level)", h2))
    status = {
        "Cryptographic provenance (C2PA)": c2pa_present,
        "AI disclosure (declared)": ai_decl,
        "Metadata consistency": cons_status,
        "Tamper evidence from provenance": tamper,
    }
    story.append(_kv_table(status, max_rows=20))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Tools ----
    story.append(Paragraph("Tooling & environment", h2))
    tools = {}
    for t in result.get("tools", []) or []:
        if isinstance(t, dict):
            tools[f"{t.get('name')}"] = ("available" if t.get("available") else "missing") + (f" ({t.get('version')})" if t.get("version") else "")
    tools["_note"] = "Tool versions are included for auditability and reproducibility."
    story.append(_kv_table(tools, max_rows=25))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Layer 1: Provable facts ----
    story.append(Paragraph("Layer 1 — Cryptographically provable facts", h2))
    c2pa = result.get("c2pa", {}) or {}
    c2pa_brief = {"status": c2pa.get("_status", "ok")}
    story.append(_kv_table(c2pa_brief, max_rows=10))
    story.append(Spacer(1, 0.12 * inch))
    story.append(Paragraph(
        "Interpretation: Only media with a valid C2PA manifest and intact trust chain can be cryptographically verified. "
        "If no manifest is present, the media is classified as <b>Unverifiable</b> (not fake — just not provable).",
        body
    ))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Layer 2: Technical observations ----
    story.append(Paragraph("Layer 2 — Technical observations (derived)", h2))
    meta = result.get("metadata", {}) or {}
    curated_keys = [
        "EXIF:Make", "EXIF:Model", "EXIF:DateTimeOriginal", "EXIF:CreateDate",
        "EXIF:GPSLatitude", "EXIF:GPSLongitude", "EXIF:Software", "XMP:CreatorTool",
        "XMP:CreateDate", "File:FileType", "File:MIMEType",
        "File:FileCreateDate", "File:FileModifyDate",
    ]
    curated = {k: meta.get(k) for k in curated_keys if k in meta}
    curated["_note"] = "Metadata may be missing or altered by exports, screenshots, or platform processing."
    story.append(_kv_table(curated, max_rows=25))
    story.append(Spacer(1, 0.12 * inch))

    cons = result.get("metadata_consistency") or {}
    story.append(Paragraph("Metadata consistency checks", h2))
    story.append(_kv_table({ "status": cons.get("status", "UNKNOWN"), "notes": " | ".join(cons.get("notes", [])[:3]) }, max_rows=10))
    story.append(Spacer(1, 0.12 * inch))

    tl = result.get("derived_timeline") or {}
    story.append(Paragraph("Derived timeline (from available metadata)", h2))
    events = tl.get("events", []) or []
    if events:
        tl_rows = {"events": events[:10], "notes": " | ".join((tl.get("notes") or [])[:2])}
        story.append(_kv_table(tl_rows, max_rows=15))
    else:
        story.append(_kv_table({"events": "No usable timestamp fields found.", "notes": " | ".join((tl.get("notes") or [])[:2])}, max_rows=10))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Transformations ----
    story.append(Paragraph("Workflow hints (non-cryptographic)", h2))
    trans = result.get("transformations", {}) or {}
    story.append(_kv_table(trans, max_rows=20))
    story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph("AI disclosure (non-inferential)", h2))
    ai = result.get("ai_disclosure", {}) or {}
    story.append(_kv_table(ai, max_rows=20))
    story.append(Paragraph(
        "Interpretation: AI origin is only <b>confirmed</b> when the media explicitly declares it (e.g., signed provenance or embedded metadata). "
        "Absence of disclosure does not prove human capture.",
        body
    ))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Layer 3: Unknowns ----
    story.append(Paragraph("Layer 3 — Unknowns & limitations", h2))
    story.append(Paragraph(
        "TruthStamp does not determine authenticity or intent. If cryptographic provenance is missing, authenticity cannot be confirmed or denied. "
        "Metadata absence is not evidence of manipulation, but it limits verifiability.",
        body
    ))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Make verifiable ----
    story.append(Paragraph("What would make this verifiable", h2))
    wmv = result.get("what_would_make_verifiable") or [
        "Capture from a C2PA-enabled camera/app",
        "Preserve the original file without re-export",
        "Seal media at capture inside a trusted workflow",
    ]
    story.append(Paragraph("<br/>".join([f"• { _safe_text(x, 200) }" for x in wmv[:8]]), body))
    story.append(Spacer(1, 0.18 * inch))

    # ---- Report integrity ----
    story.append(Paragraph("Report integrity", h2))
    integrity = {
        "Report hash (SHA-256)": report_hash,
        "Generated at": analyzed_at,
        "Tool versions included": "Yes",
        "Scope": "Reflects the state of the provided file at analysis time",
    }
    story.append(_kv_table(integrity, max_rows=15))
    story.append(Spacer(1, 0.08 * inch))
    story.append(Paragraph(
        "Note: This report is generated automatically. For court submissions, preserve the original file and keep a clear chain of custody.",
        small
    ))

    doc.build(story)
