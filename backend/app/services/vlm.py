"""Vision-Language Model stage — Claude Opus 4.7 forensic comparison.

Pure-ish function service. Inputs: captured-pack bytes + NAFDAC golden bytes
+ product context. Output: a `VlmAnalysis` with a 0..100 score, ordered
findings, and a one-line summary. The pipeline orchestrator wraps this in
`asyncio.to_thread()` so the event loop stays responsive.

Design rules (see decisions.md D-0019 / D-0020):

* Model: `claude-opus-4-7` — skill mandate; never downgrade silently.
* Thinking: `adaptive` — forensic comparison reasoning benefits from it,
  and the cost is bounded by `effort`.
* Effort: `high` — the minimum the skill recommends for intelligence-sensitive
  work. `xhigh` is overkill for a single classification call.
* Structured output: `output_config.format` with a `json_schema` derived from
  the local Pydantic model below. Free-text outputs would force regex parsing.
* Streaming: yes, via `client.messages.stream(...)` + `.get_final_message()` —
  vision requests can run 3-8 s and we don't want to hit SDK HTTP timeouts.
* Prompt caching: two breakpoints. (1) Last system block: the analyst prompt
  is identical across every scan. (2) Reference image block: the NAFDAC
  golden image is identical across every scan of the same product. The
  capture image sits *after* both, so it never invalidates them.
"""
from __future__ import annotations

import base64
import logging
import time
from dataclasses import dataclass
from typing import Annotated, Literal

from pydantic import BaseModel, Field, ValidationError

from app.config import get_settings
from app.schemas.scan import VlmFinding

log = logging.getLogger("app.vlm")

# ─── Tuning constants ────────────────────────────────────────────────────

CLAUDE_MODEL = "claude-opus-4-7"
MAX_OUTPUT_TOKENS = 4096
MAX_FINDINGS = 6
# Anything tighter than this and Claude routinely flags compression noise
# on a clean re-render. Anything looser and a real edit produces a higher
# score than its severity warrants.
_COORD_MIN = 0.05
_COORD_MAX = 0.95

_SYSTEM_PROMPT = """You are a senior forensic analyst for the Aegis pharmaceutical authentication network in Nigeria. Your job is to compare a freshly-captured pack image against a known-authentic NAFDAC golden reference and identify visual discrepancies that may indicate counterfeit packaging.

What to look for, in priority order:
* Font weight, kerning, and typeface — particularly on the batch number, expiry date, dosage strength, and the manufacturer/brand wordmark.
* Logo positioning, scale, and colour reproduction. Authentic packaging holds positional tolerance to ≤ 0.3 mm relative.
* Security seal patterns — microprint runs, holographic foil presence/absence, diagonal pattern spacing.
* Colour drift between the brand bar, accent panels, and background.
* Misspellings or incorrect NAFDAC registration numbers.
* Alignment problems — text running off the edge, panels offset, asymmetric margins.
* Print sharpness — inkjet substitution shows softer edges than offset-printed authentic packs.

What to ignore:
* Lighting differences, glare, mild perspective skew (the capture has already been perspective-corrected).
* JPEG compression noise.
* Whitespace differences from the camera framing.

Coordinate convention: each (x, y) is normalised 0..1 from the top-left of the *captured* image, pointing at the centre of the discrepancy. Stay within [0.05, 0.95] so markers don't sit on the image edge.

Score rubric (0..100, higher is cleaner):
* 90-100 — indistinguishable from reference within normal print tolerance.
* 70-89  — minor inconsistencies, likely authentic but worth a second pair of eyes.
* 60-69  — noticeable discrepancies; escalate to scratch-code verification.
* 40-59  — multiple discrepancies, probably counterfeit.
* 0-39   — clear counterfeit (wrong logo, wrong NAFDAC number, severe print quality, missing security features).

Severity per finding:
* "info"     — cosmetic difference within tolerance.
* "warning"  — questionable, worth flagging.
* "critical" — distinguishing feature between authentic and counterfeit.

Return at most six findings, sorted with the most severe first. If the capture matches the reference within tolerance, return an empty findings list and a score in the 90+ band — do not invent issues."""


class _VlmFindingModel(BaseModel):
    """Local schema used to build the structured-output JSON schema."""

    id: Annotated[int, Field(ge=1, le=20)]
    x: Annotated[float, Field(ge=0.0, le=1.0)]
    y: Annotated[float, Field(ge=0.0, le=1.0)]
    title: Annotated[str, Field(min_length=1, max_length=120)]
    detail: Annotated[str, Field(min_length=1, max_length=600)]
    severity: Literal["info", "warning", "critical"]


class _VlmResponseModel(BaseModel):
    vlm_score: Annotated[float, Field(ge=0.0, le=100.0)]
    findings: Annotated[list[_VlmFindingModel], Field(default_factory=list, max_length=10)]
    summary: Annotated[str, Field(min_length=1, max_length=240)]


@dataclass(frozen=True)
class VlmAnalysis:
    score: float
    findings: list[VlmFinding]
    summary: str
    latency_ms: int
    raw_stop_reason: str | None
    # Token telemetry — handy for the forensic trace.
    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: int
    cache_creation_input_tokens: int


class VlmUnavailable(RuntimeError):
    """Raised when the Claude SDK isn't importable or no API key is configured."""


# ─── Feature flag ────────────────────────────────────────────────────────


def is_available() -> bool:
    """True when the SDK is importable AND the API key is set."""
    try:
        import anthropic  # noqa: F401
    except Exception:  # pragma: no cover — best-effort feature flag
        return False
    return bool(get_settings().anthropic_api_key)


# ─── Main entry ──────────────────────────────────────────────────────────


def compute_vlm(
    *,
    capture_bytes: bytes,
    capture_media_type: str,
    reference_bytes: bytes,
    reference_media_type: str,
    reference_reg_number: str,
    product_name: str,
) -> VlmAnalysis:
    """Run the forensic vision comparison through Claude.

    Raises:
        VlmUnavailable: SDK not installed or no API key.
    """
    try:
        import anthropic
    except ImportError as exc:
        raise VlmUnavailable(f"anthropic SDK not installed: {exc}") from exc

    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise VlmUnavailable("AEGIS_ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)

    capture_b64 = base64.b64encode(capture_bytes).decode("ascii")
    reference_b64 = base64.b64encode(reference_bytes).decode("ascii")

    schema = _VlmResponseModel.model_json_schema()

    t0 = time.perf_counter()

    log.info(
        "vlm.start",
        extra={
            "productName": product_name,
            "referenceRegNumber": reference_reg_number,
            "captureBytes": len(capture_bytes),
            "referenceBytes": len(reference_bytes),
            "model": CLAUDE_MODEL,
        },
    )

    # Stream so a slow vision response doesn't hit SDK HTTP timeouts. The
    # context manager assembles the final message via `.get_final_message()`.
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
                # Cache the system prompt — it's identical for every scan.
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
                            f"REFERENCE — NAFDAC golden image for "
                            f"{product_name} (registration {reference_reg_number}). "
                            "Treat this as ground truth."
                        ),
                    },
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": reference_media_type,
                            "data": reference_b64,
                        },
                        # Cache the reference image — identical across every
                        # scan of the same product key. Capture comes after,
                        # so it never invalidates this prefix.
                        "cache_control": {"type": "ephemeral", "ttl": "1h"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "CAPTURE — pack photographed at the procurement gate "
                            "and perspective-corrected. Compare against the reference "
                            "above and emit findings per the schema."
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
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    cache_create = getattr(usage, "cache_creation_input_tokens", 0) or 0

    parsed = _parse_response(message)

    if parsed is None:
        log.warning(
            "vlm.parse_failed",
            extra={
                "stopReason": message.stop_reason,
                "latencyMs": latency_ms,
            },
        )
        return VlmAnalysis(
            score=80.0,
            findings=[],
            summary=(
                "Visual analysis returned an unparsed response. "
                "Treating as soft pass pending human review."
            ),
            latency_ms=latency_ms,
            raw_stop_reason=message.stop_reason,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_input_tokens=cache_read,
            cache_creation_input_tokens=cache_create,
        )

    findings = _coerce_findings(parsed.findings)

    log.info(
        "vlm.complete",
        extra={
            "score": round(parsed.vlm_score, 2),
            "findings": len(findings),
            "latencyMs": latency_ms,
            "inputTokens": usage.input_tokens,
            "outputTokens": usage.output_tokens,
            "cacheReadTokens": cache_read,
            "cacheCreationTokens": cache_create,
            "stopReason": message.stop_reason,
        },
    )

    return VlmAnalysis(
        score=float(parsed.vlm_score),
        findings=findings,
        summary=parsed.summary,
        latency_ms=latency_ms,
        raw_stop_reason=message.stop_reason,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        cache_read_input_tokens=cache_read,
        cache_creation_input_tokens=cache_create,
    )


# ─── Response parsing ────────────────────────────────────────────────────


def _parse_response(message: object) -> _VlmResponseModel | None:
    """Pull the JSON text out of Claude's response and validate it.

    Refusals (`stop_reason == "refusal"`) and unparseable bodies both come
    back as `None`; the caller falls back to a soft-pass score.
    """
    import json

    stop_reason = getattr(message, "stop_reason", None)
    if stop_reason == "refusal":
        log.warning("vlm.refusal", extra={"stopReason": stop_reason})
        return None

    # Concatenate every text block — `output_config.format` should produce a
    # single JSON document but we're defensive.
    text_parts: list[str] = []
    for block in getattr(message, "content", []) or []:
        if getattr(block, "type", None) == "text":
            text_parts.append(getattr(block, "text", "") or "")
    raw = "".join(text_parts).strip()
    if not raw:
        return None

    try:
        return _VlmResponseModel.model_validate_json(raw)
    except (ValidationError, json.JSONDecodeError):
        # Try a permissive parse — Claude very rarely wraps the JSON in
        # a fenced code block when stop_reason is `end_turn` but the schema
        # was enforced. Pull the first balanced `{...}`.
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return _VlmResponseModel.model_validate_json(raw[start : end + 1])
        except (ValidationError, json.JSONDecodeError):
            return None


def _coerce_findings(raw: list[_VlmFindingModel]) -> list[VlmFinding]:
    """Cap count, clamp coords, and renumber to a stable 1..N sequence."""
    coerced: list[VlmFinding] = []
    for i, f in enumerate(raw[:MAX_FINDINGS], start=1):
        coerced.append(
            VlmFinding(
                id=i,
                x=max(_COORD_MIN, min(_COORD_MAX, f.x)),
                y=max(_COORD_MIN, min(_COORD_MAX, f.y)),
                title=f.title,
                detail=f.detail,
                severity=f.severity,
            )
        )
    return coerced
