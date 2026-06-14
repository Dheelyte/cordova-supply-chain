"""Error Level Analysis.

Pure function service. Re-encodes a JPEG at a known quality level, diffs
the decoded re-encoded image against the input, and treats the residual as
a per-pixel "did the camera/encoder produce this region" probability map.

Edited regions — pasted blocks, digital alterations, paint-over text — have
a different compression history than the surrounding pixels, so they light
up in the diff with much higher error than the background.

Algorithm:

    1. Decode input bytes (Pillow, EXIF-aware) → 8-bit RGB.
    2. Re-encode through PIL at `quality` (default Q=85, the de-facto ELA
       reference). Re-decode the re-encoded JPEG.
    3. `abs_diff = |original − re_encoded|`, per channel.
    4. `error_map = max_channel(abs_diff) * scale`, clipped to 0..255.
       The amplification factor (default ×15) is what makes the map
       human-readable; the comparison is honest at any scale.
    5. Compute a **global score**:
         score = 100 − clip(  α · mean(error_map)
                             + β · peak_intensity_of_top_region,
                             0, 100)
       Calibrated so a clean re-rasterised SVG lands ~95 and a tampered
       region drops the score below 60.
    6. Threshold `error_map` at the 95th percentile, dilate to fill gaps,
       find connected components, return the top N (by area) as
       contract-shape `ElaRect`s with `intensity` = mean error in the
       region.
    7. Return the analysis + (optionally) a PNG-encoded raster heatmap for
       any future client that wants pixel-perfect rendering.

CPU-bound. Always invoked via `asyncio.to_thread`.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.schemas.scan import ElaRect

log = logging.getLogger("app.ela")

# ─── Tuning constants ────────────────────────────────────────────────────

DEFAULT_JPEG_QUALITY = 85       # canonical ELA re-encode quality
DEFAULT_AMPLIFY = 15.0          # ×15 makes the residual human-readable
MAX_RECTS = 8                   # cap rect output to prevent noise spam
HOT_PERCENTILE = 95.0           # threshold for hot-region detection
MIN_RECT_AREA_PX = 64           # ignore tiny specks
# Calibration — see decisions.md D-0031. The score function subtracts a
# noise-floor baseline before applying weights so that a clean phone JPEG
# (which carries irreducible compression noise that amplification turns
# into mean_error ≈ 50–70) doesn't get penalised as if it were tampered.
# Re-encoded SVG references have mean_error ≈ 0–5 and clear the baseline
# entirely, scoring ~100.
MEAN_BASELINE = 50.0            # camera-JPEG compression-noise floor (amplified)
PEAK_BASELINE = 0.70            # typical hot-region intensity from compression alone
MEAN_WEIGHT = 1.0               # α — above-baseline broad-spectrum penalty
PEAK_WEIGHT = 0.30              # β — above-baseline concentrated-region penalty


@dataclass(frozen=True)
class ElaAnalysis:
    score: float
    """0..100, higher is cleaner."""
    rects: list[ElaRect]
    heatmap_png: bytes | None
    """Optional raster heatmap; `None` when the caller passed `with_heatmap=False`."""

    # Raw diagnostics — handy for the trace.
    mean_error: float
    peak_error: float
    hot_pixel_ratio: float


def compute_ela(
    image_bytes: bytes,
    *,
    jpeg_quality: int = DEFAULT_JPEG_QUALITY,
    amplify: float = DEFAULT_AMPLIFY,
    max_rects: int = MAX_RECTS,
    with_heatmap: bool = False,
) -> ElaAnalysis:
    rgb = _decode(image_bytes)
    h, w = rgb.shape[:2]
    log.info(
        "ela.start",
        extra={
            "width": w,
            "height": h,
            "inputBytes": len(image_bytes),
            "quality": jpeg_quality,
        },
    )

    error_map = _compute_error_map(rgb, jpeg_quality=jpeg_quality, amplify=amplify)
    mean_error = float(error_map.mean())
    peak_error = float(error_map.max())
    hot_ratio = float((error_map > 64).sum() / error_map.size)

    rects, peak_region_intensity = _extract_rects(
        error_map, max_rects=max_rects, frame_w=w, frame_h=h
    )
    score = _score(mean_error, peak_region_intensity)

    heatmap_png: bytes | None = None
    if with_heatmap:
        heatmap_png = _render_heatmap_png(error_map)

    log.info(
        "ela.complete",
        extra={
            "score": round(score, 2),
            "rects": len(rects),
            "meanError": round(mean_error, 2),
            "peakError": round(peak_error, 2),
            "peakRegionIntensity": round(peak_region_intensity, 3),
            "hotPixelRatio": round(hot_ratio, 4),
        },
    )

    return ElaAnalysis(
        score=score,
        rects=rects,
        heatmap_png=heatmap_png,
        mean_error=mean_error,
        peak_error=peak_error,
        hot_pixel_ratio=hot_ratio,
    )


# ─── Pipeline pieces ─────────────────────────────────────────────────────


def _decode(image_bytes: bytes) -> np.ndarray:
    pil = Image.open(io.BytesIO(image_bytes))
    pil = ImageOps.exif_transpose(pil)
    pil = pil.convert("RGB")
    return np.asarray(pil, dtype=np.uint8)


def _compute_error_map(
    rgb: np.ndarray, *, jpeg_quality: int, amplify: float
) -> np.ndarray:
    """Re-encode through Pillow's JPEG path, diff, amplify."""
    pil = Image.fromarray(rgb, mode="RGB")
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=int(jpeg_quality), optimize=False)
    buf.seek(0)
    re_rgb = np.asarray(Image.open(buf).convert("RGB"), dtype=np.uint8)

    diff = np.abs(rgb.astype(np.int16) - re_rgb.astype(np.int16))
    # Channel-max is more sensitive than mean-of-channels — captures e.g.
    # red-channel-only edits a mean would smear out.
    err = diff.max(axis=2).astype(np.float32)
    err *= float(amplify)
    np.clip(err, 0, 255, out=err)
    return err.astype(np.uint8)


def _extract_rects(
    error_map: np.ndarray,
    *,
    max_rects: int,
    frame_w: int,
    frame_h: int,
) -> tuple[list[ElaRect], float]:
    """Threshold → close → connected-components → top-N rects."""
    threshold = np.percentile(error_map, HOT_PERCENTILE)
    if threshold < 24:
        # The whole frame is quiet — nothing worth flagging. Bias the
        # threshold up so we never light up a flat image.
        threshold = max(threshold, 24)
    mask = (error_map >= threshold).astype(np.uint8) * 255

    # Bridge small gaps so a fragmented hot blob becomes one rect.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    # stats columns: x, y, w, h, area (we skip the 0 label = background).
    candidates: list[tuple[int, int, int, int, float]] = []
    for i in range(1, num):
        x, y, w, h, area = stats[i]
        if area < MIN_RECT_AREA_PX:
            continue
        # Mean error inside the component → intensity 0..1.
        region = error_map[y : y + h, x : x + w]
        component_mask = labels[y : y + h, x : x + w] == i
        if not component_mask.any():
            continue
        intensity = float(region[component_mask].mean() / 255.0)
        candidates.append((x, y, w, h, intensity))

    candidates.sort(key=lambda c: c[2] * c[3], reverse=True)
    candidates = candidates[:max_rects]

    rects: list[ElaRect] = [
        ElaRect(
            x=x / frame_w,
            y=y / frame_h,
            w=w / frame_w,
            h=h / frame_h,
            intensity=max(0.0, min(1.0, intensity)),
        )
        for (x, y, w, h, intensity) in candidates
    ]

    peak_region_intensity = (
        max((c[4] for c in candidates), default=0.0) if candidates else 0.0
    )
    return rects, peak_region_intensity


def _score(mean_error: float, peak_region_intensity: float) -> float:
    """Combine global noise + concentrated-region intensity into 0..100.

    Both terms subtract a baseline before applying weights so that the
    irreducible compression-noise floor of a camera JPEG (mean ≈ 50–70 once
    amplified, peak component intensity ≈ 0.5–0.8) doesn't get penalised.
    Only excess over the baseline counts as evidence of tampering.

    α · max(0, mean − MEAN_BASELINE)              : broad-spectrum noise.
    β · max(0, peak − PEAK_BASELINE) · 255        : concentrated tampering.
    """
    excess_mean = max(0.0, mean_error - MEAN_BASELINE)
    excess_peak = max(0.0, peak_region_intensity - PEAK_BASELINE)
    penalty = MEAN_WEIGHT * excess_mean + PEAK_WEIGHT * excess_peak * 255.0
    raw = 100.0 - penalty
    return float(max(0.0, min(100.0, raw)))


def _render_heatmap_png(error_map: np.ndarray) -> bytes:
    """Render the error map to a yellow→red PNG via OpenCV's HOT colourmap."""
    coloured = cv2.applyColorMap(error_map, cv2.COLORMAP_HOT)
    ok, buf = cv2.imencode(".png", coloured)
    if not ok:
        raise RuntimeError("cv2.imencode failed on heatmap")
    return bytes(buf)
