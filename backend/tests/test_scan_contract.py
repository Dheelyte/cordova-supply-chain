"""Contract-conformance tests for the scan pipeline.

Asserts the wire shape the frontend depends on. If any of these break, the
TS contract has drifted and the frontend will break in lockstep — that's the
intent: the contract is enforced at the seam.
"""
from __future__ import annotations

import json
import re
from typing import Any

import httpx
import pytest

_SESSION_ID_PATTERN = re.compile(r"^sess_[a-f0-9]{12}$")
_ISO_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


@pytest.mark.asyncio
async def test_post_scan_returns_session_id(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    r = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    assert r.status_code == 202, r.text
    body = r.json()
    assert _SESSION_ID_PATTERN.match(body["sessionId"]), body
    assert _ISO_PATTERN.match(body["acceptedAt"]), body


@pytest.mark.asyncio
async def test_post_scan_rejects_unsupported_media(
    client: httpx.AsyncClient,
) -> None:
    r = await client.post(
        "/api/scan",
        files={"image": ("capture.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 415
    assert r.json()["detail"]["error"] == "unsupported_media"


@pytest.mark.asyncio
async def test_stream_emits_four_ordered_events(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    session_id = accept.json()["sessionId"]

    events = await _consume_sse(client, f"/api/scan/{session_id}/stream")
    stages = [e["stage"] for e in events]
    assert stages == [
        "normalization_complete",
        "ela_complete",
        "vlm_complete",
        "consensus",
    ]

    # Each event has the common envelope.
    for evt in events:
        assert _ISO_PATTERN.match(evt["timestamp"])
        assert isinstance(evt["latencyMs"], int)
        assert evt["latencyMs"] >= 0
        assert isinstance(evt["payload"], dict)

    # Per-stage payload shape checks.
    norm = events[0]["payload"]
    assert norm["sessionId"] == session_id
    assert isinstance(norm["productName"], str)
    bbox = norm["bbox"]
    assert isinstance(bbox, list) and len(bbox) == 4
    assert all(0.0 <= v <= 1.0 for v in bbox)
    assert norm["normalizedImageUrl"]

    ela = events[1]["payload"]
    assert ela["sessionId"] == session_id
    assert 0.0 <= ela["elaScore"] <= 100.0
    assert isinstance(ela["elaMap"], list)
    for rect in ela["elaMap"]:
        for k in ("x", "y", "w", "h", "intensity"):
            assert 0.0 <= rect[k] <= 1.0, rect

    vlm = events[2]["payload"]
    assert vlm["sessionId"] == session_id
    assert 0.0 <= vlm["vlmScore"] <= 100.0
    assert isinstance(vlm["vlmFindings"], list)
    for f in vlm["vlmFindings"]:
        assert f["id"] >= 1
        assert 0.0 <= f["x"] <= 1.0
        assert 0.0 <= f["y"] <= 1.0
        assert f["severity"] in {"info", "warning", "critical"}
    assert vlm["referenceImage"]
    assert vlm["referenceRegNumber"]

    consensus = events[3]["payload"]
    assert consensus["sessionId"] == session_id
    assert consensus["verdict"] in {"PASS", "REVIEW", "FAIL"}
    assert 0.0 <= consensus["consensusScore"] <= 100.0
    # The terminal payload carries everything the verdict screen renders.
    assert "elaMap" in consensus and "vlmFindings" in consensus
    assert consensus["summary"]
    assert consensus["referenceImage"]


@pytest.mark.asyncio
async def test_stream_404_for_unknown_session(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/scan/sess_unknown/stream")
    assert r.status_code == 404
    assert r.json()["detail"]["error"] == "session_not_found"


@pytest.mark.asyncio
async def test_result_endpoint_returns_consensus(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    session_id = accept.json()["sessionId"]

    # Drive the pipeline to completion via the stream.
    events = await _consume_sse(client, f"/api/scan/{session_id}/stream")
    expected = events[-1]["payload"]

    r = await client.get(f"/api/scan/{session_id}/result")
    assert r.status_code == 200
    body = r.json()
    assert body["sessionId"] == session_id
    assert body["verdict"] == expected["verdict"]
    assert body["consensusScore"] == expected["consensusScore"]


@pytest.mark.asyncio
async def test_result_409_when_pipeline_not_run(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    session_id = accept.json()["sessionId"]
    r = await client.get(f"/api/scan/{session_id}/result")
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "session_not_complete"


# ─── helpers ──────────────────────────────────────────────────────────────


async def _consume_sse(client: httpx.AsyncClient, path: str) -> list[dict[str, Any]]:
    """Read an SSE response to completion, returning the parsed events."""
    events: list[dict[str, Any]] = []
    async with client.stream("GET", path, timeout=15.0) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        current_event: str | None = None
        async for line in response.aiter_lines():
            if line.startswith(":"):
                continue  # SSE comment / keepalive
            if line.startswith("event:"):
                current_event = line[len("event:"):].strip()
            elif line.startswith("data:") and current_event is not None:
                data = json.loads(line[len("data:"):].strip())
                # The data line is the full event JSON — verify discriminant agrees.
                assert data["stage"] == current_event
                events.append(data)
                current_event = None
    return events
