"""Build-stage 5 — consensus weighting and band classification."""
from __future__ import annotations

import pytest

from app.services.consensus import (
    ELA_WEIGHT,
    VLM_WEIGHT,
    ConsensusResult,
    compute_consensus,
    summary_for,
)


@pytest.mark.parametrize(
    "ela,vlm,expected_verdict",
    [
        (96.2, 94.4, "PASS"),    # both clean → PASS band
        (90.0, 90.0, "PASS"),    # at boundary
        (84.9, 90.0, "REVIEW"),  # weighted slightly under 85 → REVIEW
        (60.0, 60.0, "REVIEW"),  # lower edge of REVIEW
        (24.8, 78.4, "FAIL"),    # counterfeit-digital shape — ELA dominates
        (10.0, 10.0, "FAIL"),    # clear FAIL
    ],
)
def test_band_mapping(ela: float, vlm: float, expected_verdict: str) -> None:
    result = compute_consensus(ela_score=ela, vlm_score=vlm)
    assert isinstance(result, ConsensusResult)
    assert result.verdict == expected_verdict


def test_weights_sum_to_one() -> None:
    assert abs(ELA_WEIGHT + VLM_WEIGHT - 1.0) < 1e-9


def test_score_is_weighted_average() -> None:
    result = compute_consensus(ela_score=80.0, vlm_score=60.0)
    expected = ELA_WEIGHT * 80.0 + VLM_WEIGHT * 60.0
    assert result.score == pytest.approx(expected)


def test_score_clamped_to_band() -> None:
    """Scores outside [0, 100] are clamped before weighting."""
    result = compute_consensus(ela_score=-15.0, vlm_score=110.0)
    assert result.ela_score == 0.0
    assert result.vlm_score == 100.0
    assert result.score == pytest.approx(VLM_WEIGHT * 100.0)


def test_summary_prefers_vlm_summary() -> None:
    out = summary_for(
        verdict="FAIL", score=41.2, finding_count=3, vlm_summary="Logo offset."
    )
    assert out == "Logo offset."


def test_summary_falls_back_per_band() -> None:
    pass_msg = summary_for(verdict="PASS", score=95.0, finding_count=0, vlm_summary=None)
    review_msg = summary_for(
        verdict="REVIEW", score=62.0, finding_count=1, vlm_summary=None
    )
    fail_msg = summary_for(
        verdict="FAIL", score=41.0, finding_count=3, vlm_summary=None
    )
    assert "consistent" in pass_msg.lower()
    assert "scratch" in review_msg.lower()
    assert "block" in fail_msg.lower()
