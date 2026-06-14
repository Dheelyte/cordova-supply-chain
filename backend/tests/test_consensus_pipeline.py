"""Build-stage 5 — pipeline-level consensus + cache replay.

  1. A first scan with no API key + scenario hint produces a stub verdict.
  2. A second scan with *identical bytes* hits the verdict cache; the
     pipeline replays the cached `ScanResult` and the wire payloads agree
     with the first run.
  3. The consensus score on the wire matches `compute_consensus(ela, vlm)`
     when real ELA + VLM ran (no hint, no key).
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

pytest.importorskip("cv2", reason="forensic extras not installed")
pytest.importorskip("PIL", reason="forensic extras not installed")


def _photo_jpeg(seed: int = 11, w: int = 600, h: int = 400) -> bytes:
    """Deterministic photo bytes — same seed produces byte-identical output."""
    import io

    import cv2
    import numpy as np

    rng = np.random.default_rng(seed)
    img = rng.integers(low=80, high=200, size=(h, w, 3), dtype=np.uint16).astype(
        np.uint8
    )
    img = cv2.GaussianBlur(img, (5, 5), 0)
    buf = io.BytesIO()
    from PIL import Image

    Image.fromarray(img, mode="RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()


async def _read_stage_payloads(
    client: httpx.AsyncClient, session_id: str
) -> dict[str, dict[str, Any]]:
    """Drain a session's SSE stream and return a `{stage: payload}` map."""
    payloads: dict[str, dict[str, Any]] = {}
    async with client.stream(
        "GET", f"/api/scan/{session_id}/stream", timeout=30.0
    ) as s:
        current: str | None = None
        async for line in s.aiter_lines():
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                current = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and current:
                payloads[current] = json.loads(line.split(":", 1)[1].strip())["payload"]
    return payloads


@pytest.mark.asyncio
async def test_consensus_score_is_weighted_average_when_no_hint(
    client: httpx.AsyncClient,
) -> None:
    """Wire `consensusScore` = 0.55 · elaScore + 0.45 · vlmScore."""
    img = _photo_jpeg()

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", img, "image/jpeg")},
    )
    session_id = accept.json()["sessionId"]

    payloads = await _read_stage_payloads(client, session_id)
    ela = payloads["ela_complete"]["elaScore"]
    vlm = payloads["vlm_complete"]["vlmScore"]
    consensus = payloads["consensus"]["consensusScore"]

    expected = 0.55 * ela + 0.45 * vlm
    assert consensus == pytest.approx(expected, abs=0.05)


@pytest.mark.asyncio
async def test_second_scan_with_same_bytes_hits_cache(
    client: httpx.AsyncClient,
) -> None:
    """Re-uploading the same bytes lands the same verdict via the cache."""
    img = _photo_jpeg(seed=42)

    # First scan — runs the full pipeline, writes the cache.
    accept1 = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", img, "image/jpeg")},
    )
    s1 = accept1.json()["sessionId"]
    p1 = await _read_stage_payloads(client, s1)

    # Second scan — same bytes, different session id. Cache should hit.
    accept2 = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", img, "image/jpeg")},
    )
    s2 = accept2.json()["sessionId"]
    assert s1 != s2  # the sessions differ; the cache should still match by hash

    p2 = await _read_stage_payloads(client, s2)

    # Both scans landed all stages. The identify stage runs whenever the
    # upload doesn't carry a product_name (D-0028); this test does not, so
    # identify_complete is included.
    assert set(p1) == set(p2) == {
        "normalization_complete",
        "identify_complete",
        "ela_complete",
        "vlm_complete",
        "consensus",
    }

    # The terminal verdict + scores are identical (cache hit reproduced them).
    assert p2["consensus"]["verdict"] == p1["consensus"]["verdict"]
    assert p2["consensus"]["consensusScore"] == pytest.approx(
        p1["consensus"]["consensusScore"], abs=0.001
    )
    assert p2["consensus"]["elaScore"] == pytest.approx(p1["consensus"]["elaScore"])
    assert p2["consensus"]["vlmScore"] == pytest.approx(p1["consensus"]["vlmScore"])

    # Session id on the replayed event is the *new* session, not the old one.
    assert p2["consensus"]["sessionId"] == s2
    assert p2["normalization_complete"]["sessionId"] == s2


@pytest.mark.asyncio
async def test_result_endpoint_serves_cached_consensus(
    client: httpx.AsyncClient,
) -> None:
    """The fallback /result endpoint returns the same verdict the stream did."""
    img = _photo_jpeg(seed=7)
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", img, "image/jpeg")},
    )
    session_id = accept.json()["sessionId"]

    payloads = await _read_stage_payloads(client, session_id)
    stream_payload = payloads["consensus"]

    r = await client.get(f"/api/scan/{session_id}/result")
    assert r.status_code == 200
    result = r.json()
    assert result["sessionId"] == session_id
    assert result["verdict"] == stream_payload["verdict"]
    assert result["consensusScore"] == pytest.approx(stream_payload["consensusScore"])
