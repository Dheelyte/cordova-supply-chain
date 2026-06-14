"""Build-stage 1 — capture upload lifecycle + scenario-hint behaviour."""
from __future__ import annotations

import hashlib

import httpx
import pytest


@pytest.mark.asyncio
async def test_post_persists_capture_with_sha256(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """Upload bytes round-trip via the /capture endpoint and match SHA-256."""
    r = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    assert r.status_code == 202, r.text
    session_id = r.json()["sessionId"]

    capture = await client.get(f"/api/scan/{session_id}/capture")
    assert capture.status_code == 200
    assert capture.headers["content-type"].startswith("image/png")
    assert capture.content == png_bytes
    # The backend computes SHA-256 over the same bytes — confirm bit-identity.
    assert hashlib.sha256(capture.content).hexdigest() == hashlib.sha256(
        png_bytes
    ).hexdigest()


@pytest.mark.asyncio
async def test_normalized_endpoint_serves_capture_at_stage_1(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """Stage 1 — /normalized returns the original capture unchanged."""
    r = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    session_id = r.json()["sessionId"]

    normalized = await client.get(f"/api/scan/{session_id}/normalized")
    assert normalized.status_code == 200
    assert normalized.content == png_bytes


@pytest.mark.asyncio
async def test_capture_404_when_session_unknown(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/scan/sess_missing/capture")
    assert r.status_code == 404
    assert r.json()["detail"]["error"] == "session_not_found"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "hint,expected_verdict",
    [
        ("authentic_coartem", "PASS"),
        ("counterfeit_digital", "FAIL"),
        ("counterfeit_print", "FAIL"),
    ],
)
async def test_scenario_hint_pins_terminal_verdict(
    client: httpx.AsyncClient,
    png_bytes: bytes,
    hint: str,
    expected_verdict: str,
) -> None:
    """The `scenario` form field deterministically picks the stub verdict."""
    r = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
        data={"scenario": hint},
    )
    assert r.status_code == 202
    session_id = r.json()["sessionId"]

    # Drive the pipeline to completion via the stream so /result is populated.
    async with client.stream(
        "GET", f"/api/scan/{session_id}/stream", timeout=15.0
    ) as s:
        assert s.status_code == 200
        async for _ in s.aiter_lines():
            pass

    result = await client.get(f"/api/scan/{session_id}/result")
    assert result.status_code == 200
    assert result.json()["verdict"] == expected_verdict


@pytest.mark.asyncio
async def test_invalid_scenario_hint_rejected(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    r = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
        data={"scenario": "not_a_real_scenario"},
    )
    assert r.status_code == 422
    body = r.json()
    assert body["detail"]["error"] == "invalid_scenario_hint"
    assert "authentic_coartem" in body["detail"]["allowed"]


@pytest.mark.asyncio
async def test_stream_normalization_payload_uses_per_session_url(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """The normalization payload should point the frontend at /normalized."""
    import json

    r = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    session_id = r.json()["sessionId"]

    normalization_payload: dict[str, object] | None = None
    async with client.stream(
        "GET", f"/api/scan/{session_id}/stream", timeout=15.0
    ) as s:
        current: str | None = None
        async for line in s.aiter_lines():
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                current = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and current == "normalization_complete":
                normalization_payload = json.loads(line.split(":", 1)[1].strip())[
                    "payload"
                ]
                break

    assert normalization_payload is not None
    assert normalization_payload["sessionId"] == session_id
    assert (
        normalization_payload["normalizedImageUrl"]
        == f"/api/scan/{session_id}/normalized"
    )
