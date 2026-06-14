"""Pack identification stage — Claude vision classifier.

Stage 8 — runs *before* ELA when the scan was accepted without a
batch-supplied `product_name`. The goal is narrow: tell the rest of the
pipeline what's on the pack and (when possible) which catalogue reference
to compare against.

Design rules mirror vlm.py — single Claude call, adaptive thinking, JSON
schema output, streaming. We do NOT cache the system prompt at the
breakpoint level here (one image, one short prompt, no real win), but we
do keep the model identical to the VLM stage so the operator only ever
pays for one warm Claude session per scan flow.
"""
from __future__ import annotations

import base64
import logging
import time
from dataclasses import dataclass
from typing import Annotated

from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings

log = logging.getLogger("app.identify")

CLAUDE_MODEL = "claude-opus-4-7"
MAX_OUTPUT_TOKENS = 1024

# Canonical catalogue keys the backend has reference PNGs for. Identification
# returns one of these (or `None`) so the pipeline knows whether the VLM
# comparison stage can run. The list mirrors `references._PALETTE`.
KNOWN_REFERENCE_KEYS: frozenset[str] = frozenset({"coartem", "augmentin"})

_SYSTEM_PROMPT = """You are a pharmaceutical pack classifier for the Aegis forensic gateway in Nigeria. Given a photograph of a single drug pack (perspective-corrected), identify the product.

Read the largest visible text. Look for the brand name, the active-ingredient subtitle (e.g. "artemether/lumefantrine"), the dosage strength, and any NAFDAC registration number printed on the pack (usually formatted like "04-1284").

Return strict JSON with these fields:
* `product_name` — the brand or generic name as printed, followed by dosage strength when visible (e.g. "Coartem 80/480mg", "Augmentin 625mg", "Paracetamol 500mg"). If the pack is illegible, partially-visible, or clearly not a pharmaceutical pack, return "Unknown product" verbatim.
* `nafdac_reg_number` — the registration number if printed; otherwise null.
* `confidence` — your self-rated identification confidence, 0..1. Below 0.5 means "the photo is too ambiguous to call".
* `reference_key` — one of: "coartem" (for any Coartem / artemether-lumefantrine pack), "augmentin" (for any Augmentin / amoxicillin-clavulanate pack), or null (for any other product, or when you can't classify confidently).

Do not narrate. Return the JSON object and nothing else."""


class _IdentifyResponseModel(BaseModel):
    product_name: Annotated[str, Field(min_length=1, max_length=120)]
    nafdac_reg_number: str | None = None
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]
    reference_key: str | None = None


@dataclass(frozen=True)
class IdentifyAnalysis:
    product_name: str
    nafdac_reg_number: str | None
    confidence: float
    reference_key: str | None
    latency_ms: int
    input_tokens: int
    output_tokens: int


class IdentifyUnavailable(RuntimeError):
    """SDK not importable or API key missing."""


def is_available() -> bool:
    try:
        import anthropic  # noqa: F401
    except Exception:  # pragma: no cover
        return False
    return bool(get_settings().anthropic_api_key)


def compute_identify(
    *,
    capture_bytes: bytes,
    capture_media_type: str,
) -> IdentifyAnalysis:
    """Classify a pack via Claude vision.

    Raises:
        IdentifyUnavailable: SDK or API key missing.
    """
    try:
        import anthropic
    except ImportError as exc:
        raise IdentifyUnavailable(f"anthropic SDK not installed: {exc}") from exc

    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise IdentifyUnavailable("AEGIS_ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)
    capture_b64 = base64.b64encode(capture_bytes).decode("ascii")
    schema = _IdentifyResponseModel.model_json_schema()

    t0 = time.perf_counter()

    log.info(
        "identify.start",
        extra={"captureBytes": len(capture_bytes), "model": CLAUDE_MODEL},
    )

    with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=MAX_OUTPUT_TOKENS,
        thinking={"type": "adaptive"},
        output_config={
            "effort": "high",
            "format": {"type": "json_schema", "schema": schema},
        },
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral", "ttl": "1h"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Classify the pack in this photo per the schema."
                        ),
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": capture_media_type,
                            "data": capture_b64,
                        },
                    },
                ],
            }
        ],
    ) as stream:
        message = stream.get_final_message()

    latency_ms = int((time.perf_counter() - t0) * 1000)
    usage = message.usage

    parsed = _parse(message)
    if parsed is None:
        log.warning(
            "identify.parse_failed",
            extra={"stopReason": getattr(message, "stop_reason", None), "latencyMs": latency_ms},
        )
        return IdentifyAnalysis(
            product_name="Unknown product",
            nafdac_reg_number=None,
            confidence=0.0,
            reference_key=None,
            latency_ms=latency_ms,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
        )

    # Normalize reference_key — Claude sometimes returns the brand name itself
    # rather than the catalogue key. Coerce to canonical or null.
    raw_key = (parsed.reference_key or "").strip().lower()
    reference_key: str | None = raw_key if raw_key in KNOWN_REFERENCE_KEYS else None
    if reference_key is None:
        # Heuristic fallback: try to match on product_name.
        name = parsed.product_name.lower()
        if "coartem" in name or "artemether" in name:
            reference_key = "coartem"
        elif "augmentin" in name or "amoxicillin" in name:
            reference_key = "augmentin"

    log.info(
        "identify.complete",
        extra={
            "productName": parsed.product_name,
            "regNumber": parsed.nafdac_reg_number,
            "confidence": round(parsed.confidence, 2),
            "referenceKey": reference_key,
            "latencyMs": latency_ms,
            "inputTokens": usage.input_tokens,
            "outputTokens": usage.output_tokens,
        },
    )

    return IdentifyAnalysis(
        product_name=parsed.product_name,
        nafdac_reg_number=parsed.nafdac_reg_number,
        confidence=float(parsed.confidence),
        reference_key=reference_key,
        latency_ms=latency_ms,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
    )


def _parse(message: object) -> _IdentifyResponseModel | None:
    import json

    if getattr(message, "stop_reason", None) == "refusal":
        return None

    text_parts: list[str] = []
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            text_parts.append(getattr(block, "text", "") or "")
    raw = "".join(text_parts).strip()
    if not raw:
        return None

    try:
        return _IdentifyResponseModel.model_validate_json(raw)
    except (ValidationError, json.JSONDecodeError):
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return _IdentifyResponseModel.model_validate_json(raw[start : end + 1])
        except (ValidationError, json.JSONDecodeError):
            return None
