"""Perspective normalization — label detection + homography warp.

Pure function service. The router/pipeline hand bytes in; we return the
detected bbox + the warped JPEG bytes. Everything else (writing to disk,
emitting events) lives outside.

Algorithm (the standard 4-point label-document warp):

    1. Pillow decodes the upload to an 8-bit RGB array.
    2. Greyscale + Gaussian blur + Canny edges (auto-tuned thresholds).
    3. `cv2.findContours` → sort by area → walk down looking for an
       approxPolyDP that returns exactly 4 vertices and is convex.
    4. The first match becomes the source quad. Corners are ordered
       (top-left, top-right, bottom-right, bottom-left).
    5. The destination is a canonical rectangle whose width is
       `target_width` and whose height preserves the quad's aspect ratio.
    6. `cv2.getPerspectiveTransform` + `cv2.warpPerspective` produce the
       flattened image. Re-encoded to JPEG at quality 92.
    7. If no usable quad is found, we fall back to identity: the caller
       still gets a valid normalized image (the original re-encoded) and
       a full-frame bbox so the contract is satisfied.

The function is synchronous and CPU-bound. The pipeline wraps it in
`asyncio.to_thread()` so the event loop stays responsive.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, ImageOps

log = logging.getLogger("app.normalize")

# Defaults chosen for pharmaceutical pack photos at typical phone resolutions.
DEFAULT_TARGET_WIDTH = 1024
MIN_QUAD_AREA_RATIO = 0.10      # ignore quads smaller than 10% of the frame
APPROX_POLY_EPS_RATIO = 0.02    # ε for cv2.approxPolyDP, % of contour perimeter
CANNY_SIGMA = 0.33              # auto threshold spread around median
JPEG_QUALITY = 92


@dataclass(frozen=True)
class NormalizedCapture:
    """Output of `normalize_capture`."""

    image_bytes: bytes
    content_type: str
    width: int
    height: int
    bbox: tuple[float, float, float, float]
    """Normalised `[x, y, w, h]` of the detected label in the *input* frame."""

    detection_confidence: float
    """0–1 confidence the detection actually found a label quad (vs identity fallback)."""


def normalize_capture(
    image_bytes: bytes,
    *,
    target_width: int = DEFAULT_TARGET_WIDTH,
) -> NormalizedCapture:
    """Detect the largest 4-corner contour and warp the capture flat."""
    rgb = _decode(image_bytes)
    src_h, src_w = rgb.shape[:2]
    log.info(
        "normalize.start",
        extra={"inputBytes": len(image_bytes), "width": src_w, "height": src_h},
    )

    quad = _find_label_quad(rgb)
    if quad is None:
        log.info("normalize.fallback_identity")
        warped = rgb
        bbox = (0.0, 0.0, 1.0, 1.0)
        confidence = 0.0
    else:
        bbox = _quad_to_bbox(quad, src_w, src_h)
        warped = _warp_quad(rgb, quad, target_width=target_width)
        confidence = _confidence(quad, src_w, src_h)
        log.info(
            "normalize.warp_ok",
            extra={
                "bbox": [round(v, 4) for v in bbox],
                "confidence": round(confidence, 3),
                "outWidth": warped.shape[1],
                "outHeight": warped.shape[0],
            },
        )

    out_bytes = _encode_jpeg(warped, quality=JPEG_QUALITY)
    return NormalizedCapture(
        image_bytes=out_bytes,
        content_type="image/jpeg",
        width=int(warped.shape[1]),
        height=int(warped.shape[0]),
        bbox=bbox,
        detection_confidence=confidence,
    )


# ─── Decoding ─────────────────────────────────────────────────────────────


def _decode(image_bytes: bytes) -> np.ndarray:
    """Pillow → 8-bit RGB numpy array. Honours EXIF orientation."""
    pil = Image.open(io.BytesIO(image_bytes))
    pil = ImageOps.exif_transpose(pil)  # respect camera rotation
    pil = pil.convert("RGB")
    return np.asarray(pil, dtype=np.uint8)


def _encode_jpeg(rgb: np.ndarray, *, quality: int) -> bytes:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("cv2.imencode failed")
    return bytes(buf)


# ─── Label detection ──────────────────────────────────────────────────────


def _find_label_quad(rgb: np.ndarray) -> np.ndarray | None:
    """Return a 4×2 array of the largest convex 4-vertex contour, or None."""
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = _auto_canny(blurred)
    # Close small gaps so the label outline is one contour.
    edges = cv2.morphologyEx(
        edges, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    )

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    frame_area = float(h * w)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    for c in contours:
        area = cv2.contourArea(c)
        if area < MIN_QUAD_AREA_RATIO * frame_area:
            break  # everything smaller is too small to be the label
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, APPROX_POLY_EPS_RATIO * peri, True)
        if len(approx) == 4 and cv2.isContourConvex(approx):
            return approx.reshape(4, 2).astype(np.float32)
    return None


def _auto_canny(gray: np.ndarray, sigma: float = CANNY_SIGMA) -> np.ndarray:
    median = float(np.median(gray))
    lo = int(max(0, (1.0 - sigma) * median))
    hi = int(min(255, (1.0 + sigma) * median))
    return cv2.Canny(gray, lo, hi)


# ─── Warp ─────────────────────────────────────────────────────────────────


def _warp_quad(
    rgb: np.ndarray, quad: np.ndarray, *, target_width: int
) -> np.ndarray:
    """Order the corners + warp the quad to a target-width canonical rect."""
    src = _order_corners(quad)
    # Compute the target's aspect ratio from the actual quad.
    width_top = _euclid(src[0], src[1])
    width_bottom = _euclid(src[3], src[2])
    height_left = _euclid(src[0], src[3])
    height_right = _euclid(src[1], src[2])
    avg_w = max(width_top, width_bottom, 1.0)
    avg_h = max(height_left, height_right, 1.0)
    target_h = int(round(target_width * (avg_h / avg_w)))

    dst = np.array(
        [
            [0, 0],
            [target_width - 1, 0],
            [target_width - 1, target_h - 1],
            [0, target_h - 1],
        ],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(rgb, M, (target_width, target_h))
    return warped


def _order_corners(pts: np.ndarray) -> np.ndarray:
    """Return points ordered as [top-left, top-right, bottom-right, bottom-left]."""
    pts = pts.astype(np.float32)
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # top-left has the smallest x+y
    rect[2] = pts[np.argmax(s)]  # bottom-right has the largest x+y
    d = np.diff(pts, axis=1).flatten()
    rect[1] = pts[np.argmin(d)]  # top-right has the smallest y-x
    rect[3] = pts[np.argmax(d)]  # bottom-left has the largest y-x
    return rect


def _euclid(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(a - b))


# ─── Bbox + confidence ────────────────────────────────────────────────────


def _quad_to_bbox(
    quad: np.ndarray, src_w: int, src_h: int
) -> tuple[float, float, float, float]:
    """Axis-aligned bounding box of the detected quad in normalised coords."""
    xs = quad[:, 0]
    ys = quad[:, 1]
    x0 = float(max(0.0, xs.min() / src_w))
    y0 = float(max(0.0, ys.min() / src_h))
    x1 = float(min(1.0, xs.max() / src_w))
    y1 = float(min(1.0, ys.max() / src_h))
    return (x0, y0, x1 - x0, y1 - y0)


def _confidence(quad: np.ndarray, src_w: int, src_h: int) -> float:
    """Heuristic 0–1 confidence: how much of the frame the label occupies."""
    bbox = _quad_to_bbox(quad, src_w, src_h)
    coverage = bbox[2] * bbox[3]  # area in normalised units (0..1)
    return float(min(1.0, coverage * 1.6))  # 60% coverage → 0.96 confidence
