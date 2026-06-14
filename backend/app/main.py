"""FastAPI application factory + ASGI entrypoint."""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.config import Settings, get_settings
from app.core.logging import configure_logging
from app.routers import health as health_router
from app.routers import scan as scan_router

log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown hooks."""
    settings: Settings = get_settings()
    configure_logging(settings.log_level)
    settings.ensure_upload_dir()
    log.info(
        "lifespan.startup",
        extra={
            "service": settings.app_name,
            "version": __version__,
            "env": settings.app_env,
            "uploadDir": str(settings.upload_dir.resolve()),
        },
    )
    yield
    log.info("lifespan.shutdown")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Aegis · Forensic Backend",
        version=__version__,
        description=(
            "Forensic supply-chain pipeline for the Aegis platform. "
            "Implements the scan-pipeline contract documented at "
            "/contract/README.md."
        ),
        lifespan=lifespan,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
    )

    # CORS — frontend is on a different origin in dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["x-aegis-build-stage"],
    )

    # Tag every response with the current build stage — handy for the frontend
    # network panel during the integration phases.
    @app.middleware("http")
    async def _stage_header(request: Request, call_next):  # type: ignore[no-untyped-def]
        response = await call_next(request)
        response.headers["x-aegis-build-stage"] = "8"
        return response

    # JSON error responses for HTTPException's structured `detail` dicts.
    @app.exception_handler(Exception)
    async def _unhandled(_req: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled.exception", extra={"errorType": type(exc).__name__})
        return JSONResponse(
            status_code=500,
            content={"error": "internal_error", "message": str(exc)},
        )

    # Routers under /api
    app.include_router(health_router.router, prefix="/api")
    app.include_router(scan_router.router, prefix="/api")

    return app


app = create_app()
