"""Stage 8 — identify stage emission + batch-context skip + no-reference fallback.

These tests don't need a real Claude key; the identify service degrades to a
stub identity when the API key is missing, which keeps the pipeline emitting
contract-conformant events.
"""
from __future__ import annotations

import json
from typing import Any

import httpx
import pytest


async def _drain_stream(
    client: httpx.AsyncClient, session_id: str
) -> list[tuple[str, dict[str, Any]]]:
    """Return an ordered [(stage, payload), ...] list from the SSE stream."""
    events: list[tuple[str, dict[str, Any]]] = []
    async with client.stream(
        "GET", f"/api/scan/{session_id}/stream", timeout=30.0
    ) as s:
        current: str | None = None
        async for line in s.aiter_lines():
            if line.startswith(":"):
                continue
            if line.startswith("event:"):
                current = line.split(":", 1)[1].strip()
            elif line.startswith("data:") and current:
                events.append(
                    (current, json.loads(line.split(":", 1)[1].strip())["payload"])
                )
    return events


@pytest.mark.asyncio
async def test_no_batch_context_emits_identify_stage(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """Without product_name on the upload, the identify stage runs and emits."""
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
    )
    session_id = accept.json()["sessionId"]

    events = await _drain_stream(client, session_id)
    stages = [s for s, _ in events]

    assert "identify_complete" in stages, (
        f"expected identify_complete in stream, got {stages}"
    )
    # Ordering — identify must land after normalize and before ELA.
    assert stages.index("normalization_complete") < stages.index("identify_complete")
    assert stages.index("identify_complete") < stages.index("ela_complete")

    identify_payload = next(p for s, p in events if s == "identify_complete")
    assert identify_payload["sessionId"] == session_id
    assert isinstance(identify_payload["productName"], str)
    assert 0.0 <= identify_payload["confidence"] <= 1.0


@pytest.mark.asyncio
async def test_batch_context_skips_identify_stage(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """With product_name supplied, identify is skipped — saving a Claude call."""
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
        data={
            "product_name": "Coartem 80/480mg",
            "nafdac_reg_number": "04-1284",
        },
    )
    session_id = accept.json()["sessionId"]

    events = await _drain_stream(client, session_id)
    stages = [s for s, _ in events]

    assert "identify_complete" not in stages, (
        f"identify should be skipped when product_name supplied, got {stages}"
    )
    # The other four stages must still all be present, in order.
    assert stages == [
        "normalization_complete",
        "ela_complete",
        "vlm_complete",
        "consensus",
    ]


@pytest.mark.asyncio
async def test_batch_context_propagates_product_name(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """The supplied product name shows up on every downstream wire payload."""
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
        data={"product_name": "Augmentin 625mg"},
    )
    session_id = accept.json()["sessionId"]

    events = await _drain_stream(client, session_id)

    # Every payload that has a productName field carries the supplied one.
    for stage, payload in events:
        if "productName" in payload:
            assert payload["productName"] == "Augmentin 625mg", (
                f"stage={stage} payload.productName={payload.get('productName')!r}"
            )


@pytest.mark.asyncio
async def test_consensus_carries_reference_available_flag(
    client: httpx.AsyncClient, png_bytes: bytes
) -> None:
    """Terminal ScanResult must include the boolean flag (additivity guard)."""
    accept = await client.post(
        "/api/scan",
        files={"image": ("capture.png", png_bytes, "image/png")},
        data={"product_name": "Coartem 80/480mg"},
    )
    session_id = accept.json()["sessionId"]

    events = await _drain_stream(client, session_id)
    consensus_payload = next(p for s, p in events if s == "consensus")

    assert "referenceAvailable" in consensus_payload
    assert isinstance(consensus_payload["referenceAvailable"], bool)
