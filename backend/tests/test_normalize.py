"""Build-stage 2 — perspective normalization.

Two tests:

  1. *Unit* — `normalize_capture` recovers a synthetically-skewed image:
     we render a flat reference, apply a known perspective warp, hand the
     skewed bytes to the service, and assert the recovered image is roughly
     rectangular again (bbox is non-trivial and confidence > 0).

  2. *Integration* — `GET /api/scan/{id}/normalized` returns the warped
     JPEG (not the original bytes) after the pipeline runs.

The forensic extras (opencv, pillow, numpy) are required for these tests;
they're auto-skipped if not installed so a Stage-0/1 partial install can
still run `pytest`.
"""
from __future__ import annotations

import io

import httpx
import pytest

pytest.importorskip("cv2", reason="forensic extras not installed")
pytest.importorskip("numpy", reason="forensic extras not installed")
pytest.importorskip("PIL", reason="forensic extras not installed")

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from app.services.normalize import normalize_capture  # noqa: E402


def _solid_rectangle_jpeg(w: int = 800, h: int = 560) -> bytes:
    """A high-contrast 'pack' on a dark background — gives the contour
    finder a strong rectangle to lock onto."""
    img = np.full((h, w, 3), 12, dtype=np.uint8)  # dark grey background
    pad_x, pad_y = 100, 80
    img[pad_y : h - pad_y, pad_x : w - pad_x] = (235, 230, 215)  # off-white pack
    # Stripe a couple of bands so Canny has interior edges too.
    img[pad_y : pad_y + 30, pad_x : w - pad_x] = (168, 56, 56)
    img[h - pad_y - 30 : h - pad_y, pad_x : w - pad_x] = (168, 56, 56)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(img, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    assert ok
    return bytes(buf)


def _apply_perspective_skew(jpeg_bytes: bytes) -> bytes:
    """Project the flat image through a known homography to simulate a
    handheld phone capture taken at an angle."""
    pil = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")
    rgb = np.asarray(pil, dtype=np.uint8)
    h, w = rgb.shape[:2]
    # Pad with dark background so the warped corners stay in frame.
    pad = 80
    padded = cv2.copyMakeBorder(
        rgb, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(12, 12, 12)
    )
    H, W = padded.shape[:2]
    src = np.array(
        [
            [pad, pad],
            [pad + w - 1, pad],
            [pad + w - 1, pad + h - 1],
            [pad, pad + h - 1],
        ],
        dtype=np.float32,
    )
    # Hand-picked skew: top edge tilts left, right edge tilts down. Mimics a
    # camera held at an angle to the pack.
    dst = np.array(
        [
            [pad + 40, pad + 10],
            [W - pad - 70, pad + 60],
            [W - pad - 30, H - pad - 30],
            [pad + 70, H - pad - 60],
        ],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(padded, M, (W, H), borderValue=(12, 12, 12))
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(warped, cv2.COLOR_RGB2BGR), [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    assert ok
    return bytes(buf)


def test_normalize_recovers_a_skewed_pack() -> None:
    """The recovered image's outline should be approximately a rectangle.

    We don't ask for pixel-exact recovery (would require a synthetic reference
    *post-warp* with known correspondences); we assert the structural claims
    the contract makes: (a) bbox is non-trivial, (b) detection confidence > 0,
    (c) the output decodes as a JPEG.
    """
    flat = _solid_rectangle_jpeg()
    skewed = _apply_perspective_skew(flat)

    result = normalize_capture(skewed)

    assert result.content_type == "image/jpeg"
    # bbox covers something more than a quarter of the frame.
    x, y, w, h = result.bbox
    assert 0.0 <= x < 0.8
    assert 0.0 <= y < 0.8
    assert w * h > 0.25, result.bbox
    # The detector found something — not the identity fallback.
    assert result.detection_confidence > 0.0
    # Output decodes.
    out = Image.open(io.BytesIO(result.image_bytes))
    assert out.format == "JPEG"
    assert out.size[0] > 0 and out.size[1] > 0


def test_normalize_falls_back_to_identity_on_featureless_input() -> None:
    """A solid grey frame has no quad; the service should return identity."""
    blank = np.full((400, 600, 3), 128, dtype=np.uint8)
    ok, buf = cv2.imencode(".jpg", blank, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    assert ok
    result = normalize_capture(bytes(buf))
    assert result.detection_confidence == 0.0
    assert result.bbox == (0.0, 0.0, 1.0, 1.0)


@pytest.mark.asyncio
async def test_normalized_endpoint_serves_warped_jpeg(
    client: httpx.AsyncClient,
) -> None:
    """After the pipeline runs, /normalized returns the warped JPEG, not the
    original bytes."""
    flat = _solid_rectangle_jpeg()
    skewed = _apply_perspective_skew(flat)

    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.jpg", skewed, "image/jpeg")},
    )
    assert accept.status_code == 202
    session_id = accept.json()["sessionId"]

    # Drive the pipeline to completion via the stream so normalization runs.
    async with client.stream(
        "GET", f"/api/scan/{session_id}/stream", timeout=20.0
    ) as s:
        async for _ in s.aiter_lines():
            pass

    normalized = await client.get(f"/api/scan/{session_id}/normalized")
    assert normalized.status_code == 200
    assert normalized.headers["content-type"].startswith("image/jpeg")
    # The warped bytes must NOT equal the original — the pipeline did work.
    assert normalized.content != skewed
    # And it must decode as a valid JPEG.
    img = Image.open(io.BytesIO(normalized.content))
    assert img.format == "JPEG"
