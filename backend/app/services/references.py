"""NAFDAC golden-reference image bank.

The frontend ships SVG references in `/public/reference/` for the side-by-side
view; those are display assets. Claude vision needs *bitmaps*, so the backend
owns its own PNG copy rendered with Pillow on first request and cached on disk.

Rendering is deterministic — same seed produces identical bytes, which keeps
Claude's prompt cache hits stable across restarts.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.config import get_settings

log = logging.getLogger("app.references")

# Mirrors the frontend's reference catalogue in /public/reference/.
# Keep the colour palette aligned with the SVG version so the bitmap looks
# similar to what the user sees side-by-side.
_PALETTE = {
    "coartem": {
        "product_name": "Coartem 80/480mg",
        "subtitle": "artemether / lumefantrine",
        "strength": "80 / 480 mg",
        "bg_top": (243, 238, 223),
        "bg_bottom": (230, 223, 199),
        "brand": (168, 56, 56),
        "ink": (58, 44, 16),
        "muted": (122, 110, 79),
        "batch": "LP-COART-2026-001",
        "expiry": "03 / 2028",
        "nafdac": "04-1284",
    },
    "augmentin": {
        "product_name": "Augmentin 625mg",
        "subtitle": "amoxicillin / clavulanate",
        "strength": "625 mg",
        "bg_top": (234, 243, 234),
        "bg_bottom": (214, 228, 210),
        "brand": (42, 106, 64),
        "ink": (29, 58, 35),
        "muted": (87, 110, 87),
        "batch": "MB-AUG-2026-002",
        "expiry": "02 / 2028",
        "nafdac": "04-2918",
    },
}

# Bigger than the frontend SVG (400×280) — Claude vision benefits from
# more pixels per discrepancy.
_TARGET_WIDTH = 1024
_TARGET_HEIGHT = 716


@dataclass(frozen=True)
class ReferenceImage:
    product_key: str
    png_bytes: bytes
    media_type: str
    path: Path


def get_reference(product_key: str) -> ReferenceImage:
    """Load (or lazily render) the reference PNG for a product key."""
    if product_key not in _PALETTE:
        raise ValueError(f"unknown reference product key: {product_key}")

    settings = get_settings()
    cache_dir = settings.upload_dir / "_references"
    cache_dir.mkdir(parents=True, exist_ok=True)
    out_path = cache_dir / f"{product_key}.png"

    if not out_path.exists():
        png_bytes = _render(product_key)
        out_path.write_bytes(png_bytes)
        log.info(
            "references.rendered",
            extra={
                "productKey": product_key,
                "bytes": len(png_bytes),
                "path": str(out_path),
            },
        )
    else:
        png_bytes = out_path.read_bytes()

    return ReferenceImage(
        product_key=product_key,
        png_bytes=png_bytes,
        media_type="image/png",
        path=out_path,
    )


def product_key_for_scenario(scenario_id: str) -> str:
    """Map a stub scenario id → which reference the VLM should compare against."""
    if scenario_id in ("counterfeit_print",):
        return "augmentin"
    return "coartem"


# ─── Rendering ───────────────────────────────────────────────────────────


def _render(product_key: str) -> bytes:
    palette = _PALETTE[product_key]
    w, h = _TARGET_WIDTH, _TARGET_HEIGHT

    img = Image.new("RGB", (w, h), palette["bg_top"])

    # Vertical gradient background.
    grad = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(palette["bg_top"][0] * (1 - t) + palette["bg_bottom"][0] * t)
        g = int(palette["bg_top"][1] * (1 - t) + palette["bg_bottom"][1] * t)
        b = int(palette["bg_top"][2] * (1 - t) + palette["bg_bottom"][2] * t)
        grad.putpixel((0, y), (r, g, b))
    img.paste(grad.resize((w, h)), (0, 0))

    draw = ImageDraw.Draw(img)

    # Top brand bar.
    brand_h = int(h * 0.13)
    draw.rectangle((0, 0, w, brand_h), fill=palette["brand"])

    # Strength badge.
    badge_x, badge_y = int(w * 0.05), int(h * 0.21)
    badge_w, badge_h = int(w * 0.26), int(h * 0.12)
    draw.rectangle(
        (badge_x, badge_y, badge_x + badge_w, badge_y + badge_h),
        fill=palette["brand"],
    )

    # Batch + expiry panel (white, with hairline border).
    panel_x = int(w * 0.05)
    panel_y = int(h * 0.78)
    panel_w = int(w * 0.42)
    panel_h = int(h * 0.16)
    draw.rectangle(
        (panel_x, panel_y, panel_x + panel_w, panel_y + panel_h),
        fill=(255, 255, 255),
        outline=palette["muted"],
        width=1,
    )

    # NAFDAC strip (brand colour).
    naf_x = panel_x + panel_w + int(w * 0.02)
    naf_w = w - naf_x - int(w * 0.05)
    draw.rectangle(
        (naf_x, panel_y, naf_x + naf_w, panel_y + panel_h),
        fill=palette["brand"],
    )

    # Capsule/tablet illustration block (top-right white rect with mid-line).
    cap_x = int(w * 0.55)
    cap_y = int(h * 0.33)
    cap_w = int(w * 0.30)
    cap_h = int(h * 0.22)
    draw.rounded_rectangle(
        (cap_x, cap_y, cap_x + cap_w, cap_y + cap_h),
        radius=int(min(cap_w, cap_h) * 0.18),
        fill=(255, 255, 255),
        outline=palette["muted"],
        width=2,
    )
    draw.line(
        (cap_x + 16, cap_y + cap_h // 2, cap_x + cap_w - 16, cap_y + cap_h // 2),
        fill=palette["muted"],
        width=2,
    )

    # Text. Pillow defaults to a bitmap font if no TTF is found; that's still
    # readable enough for Claude. Try a few common system fonts for a nicer
    # render where available.
    body_font = _load_font(20)
    title_font = _load_font(34, bold=True)
    badge_font = _load_font(22, bold=True)
    mono_font = _load_font(16, mono=True)
    mono_label_font = _load_font(11, mono=True)

    draw.text((24, 18), palette["product_name"], fill=(255, 255, 255), font=title_font)
    draw.text(
        (24, 18 + 40),
        palette["subtitle"],
        fill=(255, 255, 255),
        font=body_font,
    )

    # Strength label
    sx = badge_x + badge_w // 2
    sy = badge_y + badge_h // 2
    _centered_text(draw, (sx, sy), palette["strength"], fill=(255, 255, 255), font=badge_font)

    # Panel labels
    draw.text(
        (panel_x + 14, panel_y + 10),
        "BATCH",
        fill=palette["muted"],
        font=mono_label_font,
    )
    draw.text(
        (panel_x + 14, panel_y + 36),
        palette["batch"],
        fill=palette["ink"],
        font=mono_font,
    )
    draw.text(
        (panel_x + 14, panel_y + 68),
        "EXP",
        fill=palette["muted"],
        font=mono_label_font,
    )
    draw.text(
        (panel_x + 14, panel_y + 92),
        palette["expiry"],
        fill=palette["ink"],
        font=mono_font,
    )

    # NAFDAC reg
    draw.text(
        (naf_x + 18, panel_y + 18),
        "NAFDAC REG",
        fill=(255, 255, 255),
        font=mono_label_font,
    )
    draw.text(
        (naf_x + 18, panel_y + 50),
        palette["nafdac"],
        fill=(255, 255, 255),
        font=_load_font(28, bold=True, mono=True),
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _load_font(
    size: int, *, bold: bool = False, mono: bool = False
) -> ImageFont.ImageFont:
    """Best-effort font loader. Falls back to the bitmap default if no TTF."""
    candidates: list[str] = []
    if mono:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        ]
    else:
        candidates += [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _centered_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    *,
    fill: tuple[int, int, int],
    font: ImageFont.ImageFont,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text((xy[0] - tw // 2, xy[1] - th // 2), text, fill=fill, font=font)
