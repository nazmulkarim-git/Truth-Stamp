from __future__ import annotations

import os
import sqlite3
import json
import uuid
import datetime
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.getenv("TRUTHSTAMP_DB_PATH", "/tmp/truthstamp.db")


def _utc_now_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def get_db_path() -> str:
    return os.getenv("TRUTHSTAMP_DB_PATH", DEFAULT_DB_PATH)


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(get_db_path(), check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    con = connect()
    cur = con.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS cases (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS evidence (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            filename TEXT,
            sha256 TEXT,
            media_type TEXT,
            bytes INTEGER,
            provenance_state TEXT,
            summary TEXT,
            analysis_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(case_id) REFERENCES cases(id)
        );
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            case_id TEXT NOT NULL,
            evidence_id TEXT,
            event_type TEXT NOT NULL,
            actor TEXT,
            ip TEXT,
            user_agent TEXT,
            details_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(case_id) REFERENCES cases(id),
            FOREIGN KEY(evidence_id) REFERENCES evidence(id)
        );
        """
    )

    con.commit()
    con.close()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def create_case(title: str, description: Optional[str] = None) -> Dict[str, Any]:
    case_id = _new_id("case")
    created_at = _utc_now_iso()
    con = connect()
    con.execute(
        "INSERT INTO cases (id, title, description, created_at) VALUES (?, ?, ?, ?)",
        (case_id, title, description, created_at),
    )
    con.commit()
    con.close()
    return {"id": case_id, "title": title, "description": description, "created_at": created_at}


def list_cases(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    con = connect()
    rows = con.execute(
        "SELECT id, title, description, created_at FROM cases ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    con = connect()
    row = con.execute(
        "SELECT id, title, description, created_at FROM cases WHERE id = ?",
        (case_id,),
    ).fetchone()
    con.close()
    return dict(row) if row else None


def add_event(
    case_id: str,
    event_type: str,
    evidence_id: Optional[str] = None,
    actor: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    event_id = _new_id("evt")
    created_at = _utc_now_iso()
    payload = json.dumps(details or {}, ensure_ascii=False)
    con = connect()
    con.execute(
        "INSERT INTO events (id, case_id, evidence_id, event_type, actor, ip, user_agent, details_json, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (event_id, case_id, evidence_id, event_type, actor, ip, user_agent, payload, created_at),
    )
    con.commit()
    con.close()
    return {"id": event_id, "case_id": case_id, "evidence_id": evidence_id, "event_type": event_type, "created_at": created_at}


def list_events(case_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    con = connect()
    rows = con.execute(
        "SELECT id, case_id, evidence_id, event_type, actor, ip, user_agent, details_json, created_at "
        "FROM events WHERE case_id = ? ORDER BY created_at DESC LIMIT ?",
        (case_id, limit),
    ).fetchall()
    con.close()
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = dict(r)
        try:
            d["details"] = json.loads(d.pop("details_json") or "{}")
        except Exception:
            d["details"] = {}
        out.append(d)
    return out


def add_evidence(case_id: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
    evidence_id = _new_id("evd")
    created_at = _utc_now_iso()
    con = connect()
    con.execute(
        "INSERT INTO evidence (id, case_id, filename, sha256, media_type, bytes, provenance_state, summary, analysis_json, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            evidence_id,
            case_id,
            analysis.get("filename"),
            analysis.get("sha256"),
            analysis.get("media_type"),
            analysis.get("bytes"),
            analysis.get("provenance_state"),
            analysis.get("summary"),
            json.dumps(analysis, ensure_ascii=False),
            created_at,
        ),
    )
    con.commit()
    con.close()
    return {"id": evidence_id, "case_id": case_id, "created_at": created_at}


def list_evidence(case_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    con = connect()
    rows = con.execute(
        "SELECT id, case_id, filename, sha256, media_type, bytes, provenance_state, summary, created_at "
        "FROM evidence WHERE case_id = ? ORDER BY created_at DESC LIMIT ?",
        (case_id, limit),
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def get_evidence(case_id: str, evidence_id: str) -> Optional[Dict[str, Any]]:
    con = connect()
    row = con.execute(
        "SELECT id, case_id, filename, sha256, media_type, bytes, provenance_state, summary, analysis_json, created_at "
        "FROM evidence WHERE case_id = ? AND id = ?",
        (case_id, evidence_id),
    ).fetchone()
    con.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["analysis"] = json.loads(d.pop("analysis_json") or "{}")
    except Exception:
        d["analysis"] = {}
    return d
