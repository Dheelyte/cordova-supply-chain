"""Consensus stage — fold ELA + VLM into one verdict.

Pure function. No external state, no I/O. Returns the weighted score, the
band-classified verdict, and a one-line summary the verdict card renders
when no upstream summary is available.

Weights (see decisions.md D-0021):

    score = 0.55 · ela_score + 0.45 · vlm_score

ELA gets the slightly larger share because it's a deterministic forensic
baseline — re-runs on the same bytes produce identical numbers. VLM is the
more *intelligent* signal, but its score is sampled from Claude (some
non-determinism even with `effort=high`), so we lean a touch on ELA to
keep the consensus stable across re-scans.

Verdict bands match the contract's Verdict enum (`shared/contract/`):

    score >= 85  →  PASS
    score >= 60  →  REVIEW
    score <  60  →  FAIL
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.schemas.scan import Verdict

log = logging.getLogger("app.consensus")

ELA_WEIGHT = 0.55
VLM_WEIGHT = 0.45
assert abs(ELA_WEIGHT + VLM_WEIGHT - 1.0) < 1e-9, "weights must sum to 1.0"


@dataclass(frozen=True)
class ConsensusResult:
    score: float
    verdict: Verdict
    ela_score: float
    vlm_score: float
    ela_weight: float
    vlm_weight: float


def compute_consensus(*, ela_score: float, vlm_score: float) -> ConsensusResult:
    """Weighted score + band-mapped verdict."""
    ela = max(0.0, min(100.0, float(ela_score)))
    vlm = max(0.0, min(100.0, float(vlm_score)))
    score = ELA_WEIGHT * ela + VLM_WEIGHT * vlm
    verdict = _band(score)
    log.info(
        "consensus.compute",
        extra={
            "elaScore": round(ela, 2),
            "vlmScore": round(vlm, 2),
            "consensusScore": round(score, 2),
            "verdict": verdict,
        },
    )
    return ConsensusResult(
        score=score,
        verdict=verdict,
        ela_score=ela,
        vlm_score=vlm,
        ela_weight=ELA_WEIGHT,
        vlm_weight=VLM_WEIGHT,
    )


def summary_for(
    *, verdict: Verdict, score: float, finding_count: int, vlm_summary: str | None
) -> str:
    """One-line summary the consensus card renders.

    Prefers the VLM's summary when it's available (Claude usually phrases
    the issue concretely). Falls back to a band-appropriate generic.
    """
    if vlm_summary:
        return vlm_summary
    if verdict == "PASS":
        return "All forensic checks consistent with the NAFDAC reference."
    if verdict == "REVIEW":
        return (
            f"Consensus {score:.1f} in ambiguity band — "
            f"{finding_count} finding{'s' if finding_count != 1 else ''}. "
            "Escalating to scratch-code verification."
        )
    return (
        f"Consensus {score:.1f} below threshold — "
        f"{finding_count} finding{'s' if finding_count != 1 else ''}. "
        "Block transfer pending NAFDAC review."
    )


def _band(score: float) -> Verdict:
    if score >= 85.0:
        return "PASS"
    if score >= 60.0:
        return "REVIEW"
    return "FAIL"
