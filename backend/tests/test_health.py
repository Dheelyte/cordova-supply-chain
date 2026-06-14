"""Sanity tests for the health endpoint."""
from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_health_ok(client: httpx.AsyncClient) -> None:
    r = await client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["version"]
    assert body["env"]
    assert body["time"].endswith("Z")
    # Build-stage breadcrumb is set on every response by the middleware.
    assert r.headers.get("x-aegis-build-stage") == "8"
