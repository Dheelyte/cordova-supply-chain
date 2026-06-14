"""Build-stage 4 — VLM via Claude vision.

Tests are split:

  * `test_vlm.py` (this file) — unit-tests `compute_vlm` against a mocked
    Anthropic SDK so they run offline. Asserts response parsing, schema
    enforcement, coord clamping, refusal/empty-body fallback, and the
    `is_available` feature flag.

  * `test_vlm_pipeline.py` — integration tests against the FastAPI stack.
    Verifies: without an API key the pipeline emits the stub; with a
    monkey-patched `compute_vlm` the wire payload reflects real findings;
    with a `scenario` hint the wire still pins to the stub.

A real-Claude smoke test would belong in `test_vlm_smoke.py` and is
skipped automatically when `AEGIS_ANTHROPIC_API_KEY` isn't set. We don't
include it in the standing suite — it costs money and rate-limit budget.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import pytest

pytest.importorskip("PIL", reason="forensic extras not installed")
pytest.importorskip("anthropic", reason="vlm extras not installed")

from app.services import vlm as vlm_module
from app.services.vlm import VlmAnalysis, VlmUnavailable, compute_vlm


# ─── Fakes that match the parts of the Anthropic SDK we touch ────────────


@dataclass
class _FakeTextBlock:
    text: str
    type: str = "text"


@dataclass
class _FakeUsage:
    input_tokens: int = 1200
    output_tokens: int = 350
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0


@dataclass
class _FakeMessage:
    content: list[_FakeTextBlock]
    stop_reason: str = "end_turn"
    usage: _FakeUsage | None = None

    def __post_init__(self) -> None:
        if self.usage is None:
            self.usage = _FakeUsage()


class _FakeStream:
    """Minimal context manager matching `client.messages.stream(...)`."""

    def __init__(self, message: _FakeMessage, *, captured: dict[str, Any]) -> None:
        self._message = message
        self._captured = captured

    def __enter__(self) -> "_FakeStream":
        return self

    def __exit__(self, *_exc: object) -> None:
        return None

    def get_final_message(self) -> _FakeMessage:
        return self._message


class _FakeMessages:
    def __init__(self, message: _FakeMessage, captured: dict[str, Any]) -> None:
        self._message = message
        self._captured = captured

    def stream(self, **kwargs: Any) -> _FakeStream:
        self._captured.update(kwargs)
        return _FakeStream(self._message, captured=self._captured)


class _FakeAnthropicClient:
    def __init__(self, message: _FakeMessage) -> None:
        self.captured: dict[str, Any] = {}
        self.messages = _FakeMessages(message, self.captured)


# ─── Helpers ─────────────────────────────────────────────────────────────


def _install_fake(monkeypatch: pytest.MonkeyPatch, message: _FakeMessage) -> _FakeAnthropicClient:
    """Replace `anthropic.Anthropic` so `compute_vlm` builds our fake client."""
    fake_client = _FakeAnthropicClient(message)

    class _FakeAnthropicModule:
        @staticmethod
        def Anthropic(**_kwargs: Any) -> _FakeAnthropicClient:  # noqa: N802
            return fake_client

    # Inject into both sys.modules and the import path inside `compute_vlm`.
    import sys

    monkeypatch.setitem(sys.modules, "anthropic", _FakeAnthropicModule)
    monkeypatch.setenv("AEGIS_ANTHROPIC_API_KEY", "sk-test-key")
    # Bust the cached settings so the test's env var takes effect.
    from app.config import get_settings

    get_settings.cache_clear()
    return fake_client


def _png_bytes() -> bytes:
    """A small valid PNG — enough to encode as base64."""
    return bytes.fromhex(
        "89504e470d0a1a0a"
        "0000000d49484452000000010000000108060000001f15c4890000000a4944"
        "4154789c63000100000500010d0a2db40000000049454e44ae426082"
    )


def _claude_response_json(score: float, findings: list[dict[str, Any]]) -> str:
    return json.dumps(
        {
            "vlm_score": score,
            "findings": findings,
            "summary": "Test summary for the analyst pane.",
        }
    )


# ─── Tests ───────────────────────────────────────────────────────────────


def test_is_available_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AEGIS_ANTHROPIC_API_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()
    assert vlm_module.is_available() is False


def test_compute_vlm_parses_structured_response(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = _claude_response_json(
        62.5,
        [
            {
                "id": 1,
                "x": 0.74,
                "y": 0.16,
                "title": "Expiry-date region resampled",
                "detail": "Pixel-level inconsistencies suggest digital alteration.",
                "severity": "critical",
            },
            {
                "id": 2,
                "x": 0.18,
                "y": 0.22,
                "title": "Batch number font 18% lighter",
                "detail": "Inkjet substitution suspected.",
                "severity": "warning",
            },
        ],
    )
    fake_client = _install_fake(
        monkeypatch,
        _FakeMessage(
            content=[_FakeTextBlock(text=raw)],
            usage=_FakeUsage(cache_read_input_tokens=4096, cache_creation_input_tokens=0),
        ),
    )

    result = compute_vlm(
        capture_bytes=_png_bytes(),
        capture_media_type="image/png",
        reference_bytes=_png_bytes(),
        reference_media_type="image/png",
        reference_reg_number="04-1284",
        product_name="Coartem 80/480mg",
    )

    assert isinstance(result, VlmAnalysis)
    assert result.score == pytest.approx(62.5)
    assert len(result.findings) == 2
    assert result.findings[0].id == 1
    assert result.findings[0].severity == "critical"
    assert 0.05 <= result.findings[0].x <= 0.95
    assert result.summary
    assert result.cache_read_input_tokens == 4096

    # The request payload should carry exactly two cache_control breakpoints —
    # last system block + reference image block.
    captured = fake_client.captured
    system_blocks = captured["system"]
    assert system_blocks[-1].get("cache_control", {}).get("type") == "ephemeral"

    user_content = captured["messages"][0]["content"]
    image_blocks = [b for b in user_content if b["type"] == "image"]
    assert len(image_blocks) == 2  # reference + capture
    assert image_blocks[0].get("cache_control", {}).get("type") == "ephemeral"
    assert "cache_control" not in image_blocks[1]  # capture comes after the breakpoint

    # Model + knobs match the design rules.
    assert captured["model"] == "claude-opus-4-7"
    assert captured["thinking"] == {"type": "adaptive"}
    assert captured["output_config"]["effort"] == "high"
    assert captured["output_config"]["format"]["type"] == "json_schema"


def test_compute_vlm_clamps_out_of_range_coords(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = _claude_response_json(
        88.0,
        [
            {
                "id": 1,
                "x": 0.0,   # out of allowed render band
                "y": 1.0,   # out of allowed render band
                "title": "Edge marker",
                "detail": "Detail.",
                "severity": "info",
            }
        ],
    )
    _install_fake(monkeypatch, _FakeMessage(content=[_FakeTextBlock(text=raw)]))

    result = compute_vlm(
        capture_bytes=_png_bytes(),
        capture_media_type="image/png",
        reference_bytes=_png_bytes(),
        reference_media_type="image/png",
        reference_reg_number="04-1284",
        product_name="Coartem 80/480mg",
    )
    assert result.findings[0].x == pytest.approx(0.05)
    assert result.findings[0].y == pytest.approx(0.95)


def test_compute_vlm_caps_findings_at_max(monkeypatch: pytest.MonkeyPatch) -> None:
    many = [
        {
            "id": i + 1,
            "x": 0.5,
            "y": 0.5,
            "title": f"Finding {i + 1}",
            "detail": "Detail.",
            "severity": "info",
        }
        for i in range(10)
    ]
    raw = _claude_response_json(50.0, many)
    _install_fake(monkeypatch, _FakeMessage(content=[_FakeTextBlock(text=raw)]))

    result = compute_vlm(
        capture_bytes=_png_bytes(),
        capture_media_type="image/png",
        reference_bytes=_png_bytes(),
        reference_media_type="image/png",
        reference_reg_number="04-1284",
        product_name="Coartem 80/480mg",
    )
    assert len(result.findings) == vlm_module.MAX_FINDINGS
    # Renumbered to a clean 1..N sequence.
    assert [f.id for f in result.findings] == list(range(1, vlm_module.MAX_FINDINGS + 1))


def test_compute_vlm_returns_soft_pass_on_refusal(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_fake(
        monkeypatch,
        _FakeMessage(content=[_FakeTextBlock(text="")], stop_reason="refusal"),
    )

    result = compute_vlm(
        capture_bytes=_png_bytes(),
        capture_media_type="image/png",
        reference_bytes=_png_bytes(),
        reference_media_type="image/png",
        reference_reg_number="04-1284",
        product_name="Coartem 80/480mg",
    )
    assert result.findings == []
    assert result.score == pytest.approx(80.0)
    assert "unparsed" in result.summary.lower()


def test_compute_vlm_recovers_from_fenced_json(monkeypatch: pytest.MonkeyPatch) -> None:
    raw = (
        "Here is the analysis:\n"
        "```json\n"
        + _claude_response_json(95.0, [])
        + "\n```\nLet me know if you need a second pass."
    )
    _install_fake(monkeypatch, _FakeMessage(content=[_FakeTextBlock(text=raw)]))

    result = compute_vlm(
        capture_bytes=_png_bytes(),
        capture_media_type="image/png",
        reference_bytes=_png_bytes(),
        reference_media_type="image/png",
        reference_reg_number="04-1284",
        product_name="Coartem 80/480mg",
    )
    assert result.score == pytest.approx(95.0)
    assert result.findings == []


def test_compute_vlm_raises_when_no_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AEGIS_ANTHROPIC_API_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(VlmUnavailable):
        compute_vlm(
            capture_bytes=_png_bytes(),
            capture_media_type="image/png",
            reference_bytes=_png_bytes(),
            reference_media_type="image/png",
            reference_reg_number="04-1284",
            product_name="Coartem 80/480mg",
        )
