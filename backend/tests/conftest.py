"""Shared pytest fixtures."""
from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport

from app.config import Settings, get_settings
from app.main import create_app
from app.services.sessions import SessionRegistry, get_registry
from app.services.verdict_cache import reset_verdict_cache_for_tests


@pytest_asyncio.fixture
async def client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[httpx.AsyncClient]:
    """An httpx AsyncClient bound to a fresh FastAPI app.

    Per-test isolation:
      * `AEGIS_UPLOAD_DIR` points at a `tmp_path` directory so on-disk capture
        bytes are scoped to the test.
      * A fresh `SessionRegistry` is injected via `dependency_overrides` so
        sessions from one test don't leak into the next.
      * The verdict cache singleton is reset so it rebuilds against `tmp_path`,
        keeping cached `(batchHash, captureHash)` entries per-test.
    """
    app = create_app()

    def _settings_with_tmp_upload() -> Settings:
        # Build a fresh Settings instance; tests don't want the cached one.
        return Settings(upload_dir=tmp_path / "uploads")  # type: ignore[call-arg]

    fresh_registry = SessionRegistry()
    app.dependency_overrides[get_settings] = _settings_with_tmp_upload
    app.dependency_overrides[get_registry] = lambda: fresh_registry

    # The verdict cache reads its on-disk path from settings at first use.
    # Override the env var, clear the @lru_cache, and reset the singleton so
    # the next `get_verdict_cache()` lands in `tmp_path`.
    monkeypatch.setenv("AEGIS_UPLOAD_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()
    reset_verdict_cache_for_tests()

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def png_bytes() -> bytes:
    """A minimal valid 1x1 PNG — enough for upload acceptance tests."""
    return bytes.fromhex(
        "89504e470d0a1a0a"
        "0000000d49484452000000010000000108060000001f15c4890000000a4944"
        "4154789c63000100000500010d0a2db40000000049454e44ae426082"
    )
