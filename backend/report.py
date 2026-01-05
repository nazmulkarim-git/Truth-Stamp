from __future__ import annotations

import datetime
import hashlib
import json
from typing import Any, Dict, List, Tuple

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def _safe_text(v: Any, max_len: int = 400) -> str:
    if v is None:
        return ""
    s = str(v)
    s = s.replace("\x00", "").strip()
    if len(s) > max_len:
        s = s[: max_len - 1] + "…"
    return s


def _hash_result_for_id(result: Dict[str, Any]) -> str:
    """
    Stable hash for a report ID. This is NOT the file hash; it's a hash of the analysis payload.
    """
    payload = {
        "filename": result.get("filename"),
        "media_type": result.get("media_type"),
        "sha256": result.get("sha256"),
        "bytes": result.get("bytes"),
        "provenance_state": result.get("provenance_state"),
        "c2pa": result.get("c2pa"),
        "metadata": result.get("metadata"),
        "timeline": result.get("timeline"),
        "consistency": result.get("consistency"),
        "tools": result.get("tools"),
    }
    s = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(s.encode("utf-8", errors="replace")).hexdigest()


def _kv_table(data: Dict[str, Any], col_widths: Tuple[float, float] = (2.2 * inch, 4.8 * inch)) -> Table:
    rows = []
    for k, v in data.items():
        rows.append([_safe_text(k, 80), _safe_text(v, 800)])
    t = Table(rows, colWidths=list(col_widths))
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.whitesmoke, colors.white]),
                ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def _bullets(title: str, items: List[str], style_title: ParagraphStyle, style_body: ParagraphStyle) -> List[Any]:
    out: List[Any] = []
    out.append(Paragraph(_safe_text(title, 120), style_title))
    if items:
        html = "<br/>".join(f"• {_safe_text(x, 300)}" for x in items)
    else:
        html = "• (none)"
    out.append(Paragraph(html, style_body))
    return out


def build_pdf_report(out_path: str, result: Dict[str, Any]) -> None:
    styles = getSampleStyleSheet()
    title = ParagraphStyle("ts_title", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, alignment=TA_LEFT)
    h2 = ParagraphStyle("ts_h2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=14, alignment=TA_LEFT)
    body = ParagraphStyle("ts_body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10, leading=13, alignment=TA_LEFT)
    small = ParagraphStyle("ts_small", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12, alignment=TA_LEFT)

    doc = SimpleDocTemplate(out_path, pagesize=LETTER, leftMargin=0.8 * inch, rightMargin=0.8 * inch, topMargin=0.8 * inch, bottomMargin=0.8 * inch)
    story: List[Any] = []

    # Header
    story.append(Paragraph("TruthStamp — Evidence Provenance Report", title))
    story.append(Paragraph("Cryptographic proof when available. No guessing.", small))
    story.append(Spacer(1, 0.2 * inch))

    # Decision context (YC-focused, but careful)
    decision_context = (result.get("decision_context") or {}).get("purpose") or (
        "This report supports financial, legal, or editorial decision-making by separating cryptographically verifiable facts, technical observations, and unknowns."
    )
    story.append(Paragraph("Decision context", h2))
    story.append(Paragraph(_safe_text(decision_context, 600), body))
    story.append(Spacer(1, 0.15 * inch))

    # Report ID / integrity
    analyzed_at = (result.get("report_integrity") or {}).get("timestamp") or datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    report_hash = _hash_result_for_id(result)
    report_id = report_hash[:12]
    story.append(Paragraph("Executive summary", h2))
    summary = {
        "Report ID": report_id,
        "Analysis time (UTC)": analyzed_at,
        "Filename": result.get("filename"),
        "Media type": result.get("media_type"),
        "SHA-256 (file fingerprint)": result.get("sha256"),
        "Size (bytes)": result.get("bytes"),
        "Provenance status": result.get("provenance_state"),
    }
    story.append(_kv_table(summary))
    story.append(Spacer(1, 0.18 * inch))

    # What this report is / is not
    is_list = result.get("what_this_report_is") or [
        "A structured view of verifiable facts, derived technical observations, and unknowns",
        "A provenance and metadata summary intended to support human review",
    ]
    not_list = result.get("what_this_report_is_not") or [
        "A probability score of being fake",
        "A determination of authenticity or intent",
        "A detector of specific deepfake models",
    ]
    story += _bullets("What this report is", is_list, h2, body)
    story.append(Spacer(1, 0.08 * inch))
    story += _bullets("What this report is not", not_list, h2, body)
    story.append(Spacer(1, 0.18 * inch))

    # Layer 1: Cryptographically verifiable (C2PA)
    story.append(Paragraph("Layer 1 — Cryptographically verifiable facts", h2))
    c2pa = result.get("c2pa") or {}
    c2pa_present = bool(c2pa.get("present")) if isinstance(c2pa, dict) else False
    c2pa_kv = {
        "C2PA present": "Yes" if c2pa_present else "No",
        "C2PA validation": _safe_text(c2pa.get("validation") if isinstance(c2pa, dict) else ""),
        "Signer / issuer": _safe_text(c2pa.get("signer") if isinstance(c2pa, dict) else ""),
        "Assertions": _safe_text(c2pa.get("assertions") if isinstance(c2pa, dict) else ""),
    }
    story.append(_kv_table(c2pa_kv))
    story.append(Spacer(1, 0.18 * inch))

    # Layer 2: Derived technical observations
    story.append(Paragraph("Layer 2 — Derived technical observations", h2))

    # Metadata completeness (0-3) - visibility score, not trust score
    meta = result.get("metadata") or {}
    completeness = result.get("metadata_completeness") or {}
    score = completeness.get("score") if isinstance(completeness, dict) else None
    score_details = completeness.get("details") if isinstance(completeness, dict) else None
    obs = {
        "Metadata completeness (0–3)": score if score is not None else _safe_text(result.get("metadata_score")),
        "Completeness details": _safe_text(score_details),
        "Camera make": (meta.get("make") if isinstance(meta, dict) else ""),
        "Camera model": (meta.get("model") if isinstance(meta, dict) else ""),
        "Software / creator tool": (meta.get("software") if isinstance(meta, dict) else ""),
    }
    story.append(_kv_table(obs))
    story.append(Spacer(1, 0.12 * inch))

    # Timeline
    timeline = result.get("timeline") or {}
    if isinstance(timeline, dict):
        tl_kv = {
            "DateTimeOriginal": timeline.get("datetime_original"),
            "Create time": timeline.get("create_time"),
            "Modify time": timeline.get("modify_time"),
            "Export / encode time": timeline.get("export_time"),
        }
    else:
        tl_kv = {"Timeline": timeline}
    story.append(Paragraph("Derived timeline (from available metadata)", h2))
    story.append(_kv_table(tl_kv))
    story.append(Spacer(1, 0.12 * inch))

    # Consistency checks
    consistency = result.get("consistency") or {}
    story.append(Paragraph("Consistency checks", h2))
    story.append(_kv_table(consistency if isinstance(consistency, dict) else {"Notes": consistency}))
    story.append(Spacer(1, 0.18 * inch))

    # Layer 3: Unknowns & limitations
    story.append(Paragraph("Layer 3 — Unknowns & limitations", h2))
    limitations = result.get("limitations") or [
        "Absence of cryptographic provenance is not evidence of manipulation; it limits verifiability.",
        "Metadata can be missing or altered by common workflows (screenshots, exports, messaging apps, social platforms).",
        "This report reflects the state of the provided file at the time of analysis.",
    ]
    story.append(Paragraph("<br/>".join(f"• {_safe_text(x, 400)}" for x in limitations), body))
    story.append(Spacer(1, 0.18 * inch))

    # What would make this verifiable
    story.append(Paragraph("What would increase verifiability", h2))
    wmv = result.get("what_would_make_verifiable") or [
        "Capture with a C2PA-enabled camera or app",
        "Preserve the original file without re-exporting",
        "Use platform-side sealing at the time of capture",
    ]
    story.append(Paragraph("<br/>".join(f"• {_safe_text(x, 400)}" for x in wmv), body))
    story.append(Spacer(1, 0.18 * inch))

    # Report integrity block
    tools = result.get("tools") or {}
    integrity = {
        "Report hash (SHA-256)": report_hash,
        "Analysis timestamp (UTC)": analyzed_at,
        "Tool versions": _safe_text(tools),
    }
    story.append(Paragraph("Report integrity", h2))
    story.append(_kv_table(integrity, col_widths=(2.2 * inch, 4.8 * inch)))

    doc.build(story)
