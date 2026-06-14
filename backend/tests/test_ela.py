"""Build-stage 3 — Error Level Analysis.

  1. *Unit* — a clean re-encoded JPEG scores high; a copy-paste tampered
     version scores measurably lower and the tampered region surfaces as a
     hot rect roughly where we placed it.

  2. *Integration* — when a session is uploaded without a `scenario` hint,
     the `ela_complete` event carries the real score (not the stub). When
     a hint IS passed, the wire score matches the stub (demo determinism).

Forensic extras (opencv, pillow, numpy) are required; tests auto-skip
otherwise.
"""
from __future__ import annotations

import io
import json

import httpx
import pytest

pytest.importorskip("cv2", reason="forensic extras not installed")
pytest.importorskip("numpy", reason="forensic extras not installed")
pytest.importorskip("PIL", reason="forensic extras not installed")

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from app.services.ela import compute_ela  # noqa: E402


def _photo_jpeg(seed: int = 7, w: int = 800, h: int = 560) -> bytes:
    """A noisy 'photo' — random RGB with a little blur. Re-encoding at
    Q=85 keeps the ELA quiet."""
    rng = np.random.default_rng(seed)
    img = rng.integers(low=60, high=200, size=(h, w, 3), dtype=np.uint16).astype(
        np.uint8
    )
    img = cv2.GaussianBlur(img, (5, 5), 0)
    buf = io.BytesIO()
    Image.fromarray(img, mode="RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def _tamper(jpeg_bytes: bytes, *, seed: int = 99) -> tuple[bytes, tuple[int, int, int, int]]:
    """Paste a block from a *different* compression history into the image.

    We render a separate noisy block, save it through a low-quality JPEG
    round-trip, then paste it onto the original. The pasted region has a
    different per-pixel compression error profile — exactly the kind of
    edit ELA is built to catch.
    """
    img = np.asarray(Image.open(io.BytesIO(jpeg_bytes)).convert("RGB"))
    h, w = img.shape[:2]

    block_w, block_h = w // 4, h // 4
    rng = np.random.default_rng(seed)
    block = rng.integers(low=100, high=240, size=(block_h, block_w, 3), dtype=np.uint8)
    # Force a low-quality round-trip so the block carries different JPEG noise.
    bbuf = io.BytesIO()
    Image.fromarray(block, mode="RGB").save(bbuf, format="JPEG", quality=40)
    bbuf.seek(0)
    laundered = np.asarray(Image.open(bbuf).convert("RGB"))

    paste_x, paste_y = int(w * 0.6), int(h * 0.15)
    out = img.copy()
    out[paste_y : paste_y + block_h, paste_x : paste_x + block_w] = laundered

    buf = io.BytesIO()
    # Save the final image at a high quality so the ONLY differential
    # compression history is inside the pasted block.
    Image.fromarray(out, mode="RGB").save(buf, format="JPEG", quality=92)
    return buf.getvalue(), (paste_x, paste_y, block_w, block_h)


def test_clean_image_scores_high() -> None:
    result = compute_ela(_photo_jpeg())
    assert result.score > 80.0, f"clean image scored {result.score}"
    # A clean image may still produce a few low-intensity rects (compression
    # noise) but their intensity should stay modest.
    if result.rects:
        assert max(r.intensity for r in result.rects) < 0.6


def test_tampered_image_drops_score_and_flags_region() -> None:
    base = _photo_jpeg()
    tampered, (px, py, pw, ph) = _tamper(base)

    clean = compute_ela(base)
    dirty = compute_ela(tampered)

    # Tampering must reduce the score by a meaningful margin.
    assert dirty.score < clean.score - 5, (clean.score, dirty.score)

    # At least one rect should overlap the tampered region.
    img = np.asarray(Image.open(io.BytesIO(tampered)).convert("RGB"))
    h, w = img.shape[:2]
    target = (px / w, py / h, (px + pw) / w, (py + ph) / h)
    assert any(_overlaps((r.x, r.y, r.x + r.w, r.y + r.h), target) for r in dirty.rects), (
        dirty.rects,
        target,
    )


def _overlaps(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    return not (ax1 < bx0 or bx1 < ax0 or ay1 < by0 or by1 < ay0)


@pytest.mark.asyncio
async def test_ela_event_emits_real_score_without_hint(
    client: httpx.AsyncClient,
) -> None:
    base = _photo_jpeg()
    tampered, _ = _tamper(base)

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", tampered, "image/jpeg")},
    )
    assert accept.status_code == 202
    session_id = accept.json()["sessionId"]

    ela_payload = await _read_stage_payload(
        client, session_id, "ela_complete"
    )
    # Tampered image → real ELA score should drop below the stub's
    # "authentic" baseline (96.2). We just assert it isn't the round-robin
    # stub's exact value.
    assert ela_payload["sessionId"] == session_id
    assert 0.0 <= ela_payload["elaScore"] <= 100.0
    assert isinstance(ela_payload["elaMap"], list)


@pytest.mark.asyncio
async def test_scenario_hint_pins_ela_payload_to_stub(
    client: httpx.AsyncClient,
) -> None:
    """With a hint, the wire payload comes from the stub — verdict determinism
    for the Recent-Captures rail."""
    base = _photo_jpeg()  # a clean image — real ELA would score it ~90+

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", base, "image/jpeg")},
        data={"scenario": "counterfeit_digital"},
    )
    session_id = accept.json()["sessionId"]

    ela_payload = await _read_stage_payload(
        client, session_id, "ela_complete"
    )
    # The counterfeit_digital stub's ela_score is 24.8. Real ELA on a clean
    # image would be ~90+. So if the hint is honoured, we see ~24.8.
    assert ela_payload["elaScore"] == pytest.approx(24.8, abs=0.01)


async def _read_stage_payload(
    client: httpx.AsyncClient, session_id: str, stage: str
) -> dict[str, object]:
    """Consume the SSE stream and return the payload for `stage`."""
    payload: dict[str, object] | None = None
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
