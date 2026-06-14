"""SSE helpers — translate contract events into sse-starlette frames."""
from __future__ import annotations

from typing import Any, TypedDict

from app.schemas.scan import ScanErrorEvent, ScanPipelineEvent


class SSEFrame(TypedDict, total=False):
    """Shape sse-starlette's `EventSourceResponse` expects per yield."""

    event: str
    data: str
    id: str
    retry: int


def event_to_frame(event: ScanPipelineEvent | ScanErrorEvent) -> SSEFrame:
    """Render a contract event into its SSE wire frame.

    The `event:` line carries the stage discriminant; the `data:` line carries
    the canonical JSON of the full event. Aliasing is enabled so the wire
    uses camelCase (`latencyMs`, `vlmFindings`) per the contract.
    """
    payload_json: str = event.model_dump_json(by_alias=True, exclude_none=True)
    return {"event": event.stage, "data": payload_json}


def keepalive_frame() -> dict[str, Any]:
    """A bare SSE comment line — keeps proxies from idling the connection."""
    return {"comment": "ping"}
