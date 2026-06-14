"""Stage 0 seed scenarios.

The pipeline service picks one of these deterministically from a session id
hash so different sessions exercise different verdicts. Later stages replace
this with real ELA + Claude VLM output; the contract shapes stay identical.
"""
from __future__ import annotations

import hashlib
from typing import Literal

from app.schemas.scan import (
    ElaPayload,
    ElaRect,
    NormalizationPayload,
    ScanResult,
    Verdict,
    VlmFinding,
    VlmPayload,
)

ScenarioId = Literal["authentic_coartem", "counterfeit_digital", "counterfeit_print"]


# ─── Hot-spot maps (mirrored from src/lib/mock-api/fixtures/ela-maps.ts) ──

_AUTHENTIC_RECTS = [
    ElaRect(x=0.12, y=0.18, w=0.08, h=0.05, intensity=0.08),
    ElaRect(x=0.34, y=0.42, w=0.06, h=0.04, intensity=0.12),
    ElaRect(x=0.72, y=0.71, w=0.07, h=0.05, intensity=0.10),
]

_COUNTERFEIT_DIGITAL_RECTS = [
    ElaRect(x=0.61, y=0.08, w=0.30, h=0.12, intensity=0.92),
    ElaRect(x=0.64, y=0.10, w=0.24, h=0.08, intensity=0.98),
    ElaRect(x=0.66, y=0.12, w=0.20, h=0.05, intensity=1.0),
    ElaRect(x=0.58, y=0.15, w=0.06, h=0.04, intensity=0.42),
    ElaRect(x=0.88, y=0.14, w=0.04, h=0.04, intensity=0.36),
]

_COUNTERFEIT_PRINT_RECTS = [
    ElaRect(x=0.08, y=0.12, w=0.18, h=0.18, intensity=0.62),
    ElaRect(x=0.78, y=0.60, w=0.16, h=0.22, intensity=0.68),
    ElaRect(x=0.42, y=0.46, w=0.18, h=0.12, intensity=0.51),
    ElaRect(x=0.32, y=0.78, w=0.12, h=0.08, intensity=0.44),
]


# ─── Scenarios ───────────────────────────────────────────────────────────


def _scenario(
    scenario_id: ScenarioId,
) -> tuple[
    str,  # product_name
    str,  # reference_image
    str,  # reference_reg_number
    float,  # ela_score
    float,  # vlm_score
    float,  # consensus_score
    Verdict,
    list[ElaRect],
    list[VlmFinding],
    str,  # summary
]:
    if scenario_id == "authentic_coartem":
        return (
            "Coartem 80/480mg",
            "/reference/coartem.svg",
            "04-1284",
            96.2,
            94.4,
            95.4,
            "PASS",
            _AUTHENTIC_RECTS,
            [],
            "All forensic checks consistent with NAFDAC reference image.",
        )
    if scenario_id == "counterfeit_digital":
        return (
            "Coartem 80/480mg",
            "/reference/coartem.svg",
            "04-1284",
            24.8,
            78.4,
            41.2,
            "FAIL",
            _COUNTERFEIT_DIGITAL_RECTS,
            [
                VlmFinding(
                    id=1,
                    x=0.74,
                    y=0.16,
                    title="Expiry-date region resampled",
                    detail=(
                        "ELA noise concentrated 920% above local baseline. "
                        "Pixel-level inconsistencies indicate digital alteration."
                    ),
                    severity="critical",
                )
            ],
            "Expiry date appears digitally altered. Block transfer.",
        )
    # counterfeit_print
    return (
        "Augmentin 625mg",
        "/reference/augmentin.svg",
        "04-2918",
        71.2,
        32.8,
        48.1,
        "FAIL",
        _COUNTERFEIT_PRINT_RECTS,
        [
            VlmFinding(
                id=1,
                x=0.18,
                y=0.22,
                title="Font weight discrepancy",
                detail=(
                    "Batch number rendered 18% lighter than the NAFDAC "
                    "reference. Indicates inkjet print substitution."
                ),
                severity="critical",
            ),
            VlmFinding(
                id=2,
                x=0.84,
                y=0.68,
                title="Logo positioning offset",
                detail=(
                    "Manufacturer logo offset by 2.4mm (1.2% relative). "
                    "Genuine packaging tolerance is ≤ 0.3mm."
                ),
                severity="warning",
            ),
            VlmFinding(
                id=3,
                x=0.5,
                y=0.52,
                title="Security seal pattern mismatch",
                detail=(
                    "Diagonal spacing inconsistent with reference micro-pattern. "
                    "Holographic foil absent under polarized inspection."
                ),
                severity="critical",
            ),
        ],
        "Three print discrepancies from NAFDAC reference. Block transfer.",
    )


_SCENARIOS: tuple[ScenarioId, ScenarioId, ScenarioId] = (
    "authentic_coartem",
    "counterfeit_digital",
    "counterfeit_print",
)

#: Public, frozen membership set — `pipeline.run_pipeline` uses this to
#: validate a session's `scenario_hint`. Mirrors `ALLOWED_SCENARIO_HINTS`
#: in `app.services.sessions`.
SCENARIOS: frozenset[ScenarioId] = frozenset(_SCENARIOS)


def scenario_from_hint(hint: str) -> ScenarioId:
    """Coerce a hint string into a `ScenarioId` or raise `ValueError`."""
    if hint not in _SCENARIOS:
        raise ValueError(hint)
    return hint  # type: ignore[return-value]


def pick_scenario(session_id: str, *, hint: str | None = None) -> ScenarioId:
    """Deterministic-by-session scenario selection.

    A `hint` (`POST /api/scan`'s optional `scenario` form field) wins when
    present — the frontend's "Recent captures" rail uses it so the chosen
    sample reliably produces the verdict its label promises. Without a hint,
    we hash the session id and round-robin so re-scans cycle the verdict
    shape. Stage 2 onward this hint is ignored — the real ELA + Claude VLM
    derive everything from the image bytes.
    """
    if hint is not None:
        return scenario_from_hint(hint)
    digest = hashlib.sha256(session_id.encode("utf-8")).digest()
    return _SCENARIOS[digest[0] % len(_SCENARIOS)]


# ─── Payload builders ─────────────────────────────────────────────────────


def normalization_payload(
    session_id: str,
    scenario: ScenarioId,
    *,
    normalized_image_url: str | None = None,
) -> NormalizationPayload:
    """Build the `normalization_complete` payload for a session.

    `normalized_image_url` defaults to the backend's per-session normalized
    endpoint so the frontend renders the *uploaded* capture during the warp
    animation. The caller (pipeline) wires the absolute URL.
    """
    product_name, ref, *_ = _scenario(scenario)
    return NormalizationPayload(
        session_id=session_id,
        product_name=product_name,
        bbox=(0.08, 0.11, 0.84, 0.73),
        normalized_image_url=normalized_image_url or ref,
    )


def ela_payload(session_id: str, scenario: ScenarioId) -> ElaPayload:
    product_name, _ref, _reg, ela_score, *_rest = _scenario(scenario)
    _, _, _, _, _, _, _, ela_rects, _, _ = _scenario(scenario)
    return ElaPayload(
        session_id=session_id,
        product_name=product_name,
        ela_score=ela_score,
        ela_map=ela_rects,
    )


def vlm_payload(session_id: str, scenario: ScenarioId) -> VlmPayload:
    product_name, ref, reg, _ela, vlm_score, _cons, _v, _rects, findings, _sum = _scenario(
        scenario
    )
    return VlmPayload(
        session_id=session_id,
        product_name=product_name,
        vlm_score=vlm_score,
        vlm_findings=findings,
        reference_image=ref,
        reference_reg_number=reg,
    )


def consensus_result(
    session_id: str,
    scenario: ScenarioId,
    *,
    captured_at: str,
    batch_id: str | None,
) -> ScanResult:
    (
        product_name,
        ref,
        _reg,
        ela_score,
        vlm_score,
        consensus_score,
        verdict,
        ela_rects,
        findings,
        summary,
    ) = _scenario(scenario)
    return ScanResult(
        session_id=session_id,
        product_name=product_name,
        batch_id=batch_id,
        captured_at=captured_at,
        ela_score=ela_score,
        vlm_score=vlm_score,
        consensus_score=consensus_score,
        verdict=verdict,
        ela_map=ela_rects,
        vlm_findings=findings,
        summary=summary,
        reference_image=ref,
    )
