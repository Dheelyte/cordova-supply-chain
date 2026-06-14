"""`GET /api/health` — liveness + build metadata."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app import __version__
from app.config import Settings, get_settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    now = (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    return HealthResponse(
        service=settings.app_name,
        version=__version__,
        env=settings.app_env,
        time=now,
    )
