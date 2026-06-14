"""Pydantic mirror of the Aegis forensic scan pipeline contract.

This module is the BACKEND HALF of the four-way contract mirror. The other
three are:

  * `contract/README.md`              — human-readable spec
  * `contract/scan-pipeline.schema.json` — language-neutral JSON Schema
  * `src/lib/contract/scan.ts`        — frontend TypeScript types

A shape change here MUST land in all four at once. The Pydantic models are
configured with `populate_by_name=True` and camelCase aliases so the wire
JSON is byte-compatible with the TS contract.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# ─── Base config ──────────────────────────────────────────────────────────


class ContractModel(BaseModel):
    """Every contract DTO renders camelCase on the wire."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        str_strip_whitespace=True,
        extra="forbid",
        frozen=True,
    )


# ─── Primitives ───────────────────────────────────────────────────────────

Verdict = Literal["PASS", "REVIEW", "FAIL"]
VlmSeverity = Literal["info", "warning", "critical"]
ScanPipelineStage = Literal[
    "normalization_complete",
    "identify_complete",
    "ela_complete",
    "vlm_complete",
    "consensus",
]


class ElaRect(ContractModel):
    """A single ELA hot-spot in normalised (0..1) coordinates."""

    x: Annotated[float, Field(ge=0.0, le=1.0)]
    y: Annotated[float, Field(ge=0.0, le=1.0)]
    w: Annotated[float, Field(ge=0.0, le=1.0)]
    h: Annotated[float, Field(ge=0.0, le=1.0)]
    intensity: Annotated[float, Field(ge=0.0, le=1.0)]


class VlmFinding(ContractModel):
    """One print-discrepancy finding."""

    id: Annotated[int, Field(ge=1)]
    x: Annotated[float, Field(ge=0.0, le=1.0)]
    y: Annotated[float, Field(ge=0.0, le=1.0)]
    title: str
    detail: str
    severity: VlmSeverity


# ─── Stage payloads ───────────────────────────────────────────────────────


class NormalizationPayload(ContractModel):
    session_id: str
    product_name: str
    bbox: Annotated[
        tuple[float, float, float, float],
        Field(description="Detected label bbox normalised [x, y, w, h]"),
    ]
    normalized_image_url: str


class IdentifyPayload(ContractModel):
    """Stage 8 — Claude vision classified the pack."""

    session_id: str
    product_name: str
    nafdac_reg_number: str | None = None
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]
    reference_key: str | None = None


class ElaPayload(ContractModel):
    session_id: str
    product_name: str
    ela_score: Annotated[float, Field(ge=0.0, le=100.0)]
    ela_map: list[ElaRect]
    heatmap_image_url: str | None = None


class VlmPayload(ContractModel):
    session_id: str
    product_name: str
    # `None` when no reference was available for the identified product.
    vlm_score: float | None = Field(default=None, ge=0.0, le=100.0)
    vlm_findings: list[VlmFinding] = Field(default_factory=list)
    reference_image: str | None = None
    reference_reg_number: str | None = None
    reference_available: bool = True


class ScanResult(ContractModel):
    """Terminal consensus payload — also returned by GET /api/scan/{id}/result."""

    session_id: str
    product_name: str
    batch_id: str | None = None
    captured_at: str
    ela_score: Annotated[float, Field(ge=0.0, le=100.0)]
    # `None` when no reference was available — verdict relies on ELA alone.
    vlm_score: float | None = Field(default=None, ge=0.0, le=100.0)
    consensus_score: Annotated[float, Field(ge=0.0, le=100.0)]
    verdict: Verdict
    ela_map: list[ElaRect]
    vlm_findings: list[VlmFinding]
    summary: str
    reference_image: str | None = None
    reference_available: bool = True


# ─── Pipeline events (discriminated union on `stage`) ─────────────────────


class _BaseEvent(ContractModel):
    timestamp: str
    latency_ms: Annotated[int, Field(ge=0)]


class NormalizationCompleteEvent(_BaseEvent):
    stage: Literal["normalization_complete"] = "normalization_complete"
    payload: NormalizationPayload


class IdentifyCompleteEvent(_BaseEvent):
    stage: Literal["identify_complete"] = "identify_complete"
    payload: IdentifyPayload


class ElaCompleteEvent(_BaseEvent):
    stage: Literal["ela_complete"] = "ela_complete"
    payload: ElaPayload


class VlmCompleteEvent(_BaseEvent):
    stage: Literal["vlm_complete"] = "vlm_complete"
    payload: VlmPayload


class ConsensusEvent(_BaseEvent):
    stage: Literal["consensus"] = "consensus"
    payload: ScanResult


ScanPipelineEvent = Annotated[
    NormalizationCompleteEvent
    | IdentifyCompleteEvent
    | ElaCompleteEvent
    | VlmCompleteEvent
    | ConsensusEvent,
    Field(discriminator="stage"),
]


class ScanErrorEvent(ContractModel):
    stage: Literal["error"] = "error"
    timestamp: str
    failed_stage: ScanPipelineStage | Literal["upload"]
    message: str
    recoverable: bool


# ─── HTTP DTOs ────────────────────────────────────────────────────────────


class ScanAcceptResponse(ContractModel):
    session_id: str
    accepted_at: str


__all__ = [
    "ConsensusEvent",
    "ContractModel",
    "ElaCompleteEvent",
    "ElaPayload",
    "ElaRect",
    "IdentifyCompleteEvent",
    "IdentifyPayload",
    "NormalizationCompleteEvent",
    "NormalizationPayload",
    "ScanAcceptResponse",
    "ScanErrorEvent",
    "ScanPipelineEvent",
    "ScanPipelineStage",
    "ScanResult",
    "Verdict",
    "VlmCompleteEvent",
    "VlmFinding",
    "VlmPayload",
    "VlmSeverity",
]
