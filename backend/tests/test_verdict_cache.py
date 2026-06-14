"""Build-stage 5 — verdict cache round-trip + persistence."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.schemas.scan import ElaRect, ScanResult, VlmFinding
from app.services.verdict_cache import CACHE_FORMAT_VERSION, VerdictCache


def _scan_result(*, session_id: str = "sess_abc123", verdict: str = "FAIL") -> ScanResult:
    return ScanResult(
        session_id=session_id,
        product_name="Coartem 80/480mg",
        batch_id="batch_001",
        captured_at="2026-05-15T12:00:00.000Z",
        ela_score=24.8,
        vlm_score=78.4,
        consensus_score=41.2,
        verdict=verdict,  # type: ignore[arg-type]
        ela_map=[ElaRect(x=0.6, y=0.1, w=0.3, h=0.1, intensity=0.95)],
        vlm_findings=[
            VlmFinding(
                id=1,
                x=0.74,
                y=0.16,
                title="Expiry-date region resampled",
                detail="Pixel noise concentrated on the expiry block.",
                severity="critical",
            )
        ],
        summary="Expiry date appears digitally altered. Block transfer.",
        reference_image="/reference/coartem.svg",
    )


@pytest.mark.asyncio
async def test_round_trip_returns_equivalent_result(tmp_path: Path) -> None:
    cache = VerdictCache(tmp_path / "cache.json")
    original = _scan_result()

    await cache.put(
        batch_id=original.batch_id,
        capture_hash="abc123def456",
        result=original,
    )
    retrieved = await cache.get(batch_id=original.batch_id, capture_hash="abc123def456")

    assert retrieved is not None
    assert retrieved.verdict == original.verdict
    assert retrieved.consensus_score == pytest.approx(original.consensus_score)
    assert len(retrieved.vlm_findings) == 1
    assert retrieved.vlm_findings[0].title == original.vlm_findings[0].title


@pytest.mark.asyncio
async def test_distinct_captures_dont_collide(tmp_path: Path) -> None:
    cache = VerdictCache(tmp_path / "cache.json")
    await cache.put(
        batch_id="batch_A",
        capture_hash="hashA",
        result=_scan_result(session_id="sess_A", verdict="PASS"),
    )
    await cache.put(
        batch_id="batch_A",
        capture_hash="hashB",
        result=_scan_result(session_id="sess_B", verdict="FAIL"),
    )
    a = await cache.get(batch_id="batch_A", capture_hash="hashA")
    b = await cache.get(batch_id="batch_A", capture_hash="hashB")
    assert a is not None and a.verdict == "PASS"
    assert b is not None and b.verdict == "FAIL"
    assert await cache.size() == 2


@pytest.mark.asyncio
async def test_get_with_no_capture_hash_returns_none(tmp_path: Path) -> None:
    cache = VerdictCache(tmp_path / "cache.json")
    await cache.put(
        batch_id="batch_A",
        capture_hash="hashA",
        result=_scan_result(),
    )
    assert await cache.get(batch_id="batch_A", capture_hash=None) is None
    assert await cache.get(batch_id="batch_A", capture_hash="") is None


@pytest.mark.asyncio
async def test_batch_id_none_works_independent_of_a_batch(tmp_path: Path) -> None:
    """Scans without a batch context still cache by capture-hash alone."""
    cache = VerdictCache(tmp_path / "cache.json")
    await cache.put(
        batch_id=None,
        capture_hash="orphanhash",
        result=_scan_result(verdict="PASS"),
    )
    assert (
        await cache.get(batch_id=None, capture_hash="orphanhash")
    ) is not None


@pytest.mark.asyncio
async def test_corrupted_disk_doesnt_kill_lookups(tmp_path: Path) -> None:
    path = tmp_path / "cache.json"
    path.write_text("definitely not json {{{ ")
    cache = VerdictCache(path)
    # Read survives a corrupted file by treating it as an empty store.
    assert await cache.get(batch_id="x", capture_hash="y") is None
    # And subsequent writes overwrite cleanly.
    await cache.put(batch_id="x", capture_hash="y", result=_scan_result())
    on_disk = json.loads(path.read_text())
    assert on_disk["version"] == CACHE_FORMAT_VERSION
    assert len(on_disk["entries"]) == 1


@pytest.mark.asyncio
async def test_version_skew_clears_old_entries(tmp_path: Path) -> None:
    path = tmp_path / "cache.json"
    path.write_text(json.dumps({"version": 999, "entries": {"x::y": {"junk": True}}}))
    cache = VerdictCache(path)
    assert await cache.get(batch_id="x", capture_hash="y") is None
