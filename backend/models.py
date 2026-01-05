from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional, Literal

ProvenanceState = Literal[
    "VERIFIED_ORIGINAL",
    "ALTERED_OR_BROKEN_PROVENANCE",
    "UNVERIFIABLE_NO_PROVENANCE",
]

class ToolStatus(BaseModel):
    name: str
    available: bool
    version: Optional[str] = None
    notes: Optional[str] = None

class Finding(BaseModel):
    key: str
    value: Any
    confidence: Literal["PROVABLE", "INFERRED", "UNKNOWN"] = "INFERRED"
    notes: Optional[str] = None

class AnalysisResult(BaseModel):
    filename: str
    media_type: Literal["image", "video", "unknown"]
    sha256: str
    bytes: int
    provenance_state: ProvenanceState
    summary: str
    tools: List[ToolStatus] = Field(default_factory=list)
    c2pa: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    ai_disclosure: Dict[str, Any] = Field(default_factory=dict)
    transformations: Dict[str, Any] = Field(default_factory=dict)
    findings: List[Finding] = Field(default_factory=list)
    derived_timeline: Dict[str, Any] = Field(default_factory=dict)
    metadata_consistency: Dict[str, Any] = Field(default_factory=dict)
    decision_context: Dict[str, Any] = Field(default_factory=dict)
    what_would_make_verifiable: List[str] = Field(default_factory=list)
    report_integrity: Dict[str, Any] = Field(default_factory=dict)
metadata_completeness: Dict[str, Any] = Field(default_factory=dict)
what_this_report_is: List[str] = Field(default_factory=list)
what_this_report_is_not: List[str] = Field(default_factory=list)
