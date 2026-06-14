"""Build-stage 4 — pipeline-level VLM behaviour.

  1. Without an API key the pipeline emits the stub VLM payload.
  2. With a monkey-patched `compute_vlm` (no real Claude calls) the wire
     payload reflects the real findings when no scenario hint is set.
  3. With a scenario hint the wire still pins to the stub even when real
     analysis ran — demo determinism for Recent-Captures.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

pytest.importorskip("cv2", reason="forensic extras not installed")
pytest.importorskip("PIL", reason="forensic extras not installed")
pytest.importorskip("anthropic", reason="vlm extras not installed")

from app.schemas.scan import VlmFinding
from app.services import vlm as vlm_module
from app.services.vlm import VlmAnalysis


def _photo_jpeg(w: int = 600, h: int = 400) -> bytes:
    """Solid background — sufficient input for the upload path; the VLM
    call itself is mocked, so content doesn't matter."""
    import io

    import cv2
    import numpy as np

    img = np.full((h, w, 3), 220, dtype=np.uint8)
    img[20:40, 20:200] = (40, 40, 200)
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    assert ok
    return bytes(buf)


def _real_analysis() -> VlmAnalysis:
    return VlmAnalysis(
        score=63.4,
        findings=[
            VlmFinding(
                id=1,
                x=0.71,
                y=0.18,
                title="Expiry-date pixels resampled",
                detail="ELA-like noise concentrated on the expiry block.",
                severity="critical",
            )
        ],
        summary="Likely digital tampering on the expiry-date region.",
        latency_ms=2400,
        raw_stop_reason="end_turn",
        input_tokens=1280,
        output_tokens=340,
        cache_read_input_tokens=4096,
        cache_creation_input_tokens=0,
    )


async def _read_stage_payload(
    client: httpx.AsyncClient, session_id: str, stage: str
) -> dict[str, Any]:
    payload: dict[str, Any] | None = None
    async with client.stream(
        "GET", f"/api/scan/{session_id}/stream", timeout=30.0
    ) as s:
        current: str | None = None
        async for line in s.aiter_lines():
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                current = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and current == stage:
                payload = json.loads(line.split(":", 1)[1].strip())["payload"]
                break
    assert payload is not None, f"never saw {stage} event"
    return payload


@pytest.mark.asyncio
async def test_pipeline_emits_stub_when_no_api_key(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("AEGIS_ANTHROPIC_API_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", _photo_jpeg(), "image/jpeg")},
    )
    session_id = accept.json()["sessionId"]
    payload = await _read_stage_payload(client, session_id, "vlm_complete")

    # Stub for the round-robin scenario is one of the catalogued ones —
    # asserting the wire shape is well-formed is enough here.
    assert payload["sessionId"] == session_id
    assert 0.0 <= payload["vlmScore"] <= 100.0
    assert isinstance(payload["vlmFindings"], list)
    assert payload["referenceImage"].startswith("/reference/")


@pytest.mark.asyncio
async def test_pipeline_emits_real_vlm_without_hint(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("AEGIS_ANTHROPIC_API_KEY", "sk-test")
    from app.config import get_settings

    get_settings.cache_clear()

    captured: dict[str, Any] = {}

    def _fake_compute_vlm(**kwargs: Any) -> VlmAnalysis:
        captured.update(kwargs)
        return _real_analysis()

    monkeypatch.setattr(vlm_module, "is_available", lambda: True)
    monkeypatch.setattr(vlm_module, "compute_vlm", _fake_compute_vlm)

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", _photo_jpeg(), "image/jpeg")},
    )
    session_id = accept.json()["sessionId"]
    payload = await _read_stage_payload(client, session_id, "vlm_complete")

    assert payload["sessionId"] == session_id
    # Wire reflects the real analysis we mocked in.
    assert payload["vlmScore"] == pytest.approx(63.4)
    assert len(payload["vlmFindings"]) == 1
    assert payload["vlmFindings"][0]["title"].startswith("Expiry-date")
    assert payload["referenceImage"]
    assert payload["referenceRegNumber"]

    # And the mock was called with the right pieces.
    assert captured["product_name"]
    assert captured["reference_media_type"] == "image/png"
    assert isinstance(captured["capture_bytes"], (bytes, bytearray))


@pytest.mark.asyncio
async def test_scenario_hint_pins_vlm_payload_to_stub(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The hint short-circuits the wire payload but the real call still ran."""
    monkeypatch.setenv("AEGIS_ANTHROPIC_API_KEY", "sk-test")
    from app.config import get_settings

    get_settings.cache_clear()

    call_count = {"n": 0}

    def _fake_compute_vlm(**_kwargs: Any) -> VlmAnalysis:
        call_count["n"] += 1
        return _real_analysis()

    monkeypatch.setattr(vlm_module, "is_available", lambda: True)
    monkeypatch.setattr(vlm_module, "compute_vlm", _fake_compute_vlm)

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", _photo_jpeg(), "image/jpeg")},
        data={"scenario": "counterfeit_print"},
    )
    session_id = accept.json()["sessionId"]
    payload = await _read_stage_payload(client, session_id, "vlm_complete")

    # counterfeit_print stub: vlm_score is 32.8 — NOT the real 63.4 we mocked.
    assert payload["vlmScore"] == pytest.approx(32.8, abs=0.01)
    # And we still actually ran the real analysis (logged + cached on session).
    assert call_count["n"] == 1
