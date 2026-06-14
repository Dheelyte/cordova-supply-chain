"""Scan router — POST upload, GET SSE stream, GET fallback result + capture."""
from __future__ import annotations

import hashlib
import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import aiofiles
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from app.config import Settings, get_settings
from app.core.errors import (
    CaptureNotAvailable,
    InvalidScenarioHint,
    SessionNotComplete,
    SessionNotFound,
    UnsupportedMedia,
    UploadTooLarge,
)
from app.core.sse import event_to_frame
from app.schemas.scan import ScanAcceptResponse, ScanResult
from app.services import pipeline as pipeline_service
from app.services.sessions import (
    ALLOWED_SCENARIO_HINTS,
    SessionRegistry,
    get_registry,
)

log = logging.getLogger("app.scan")
router = APIRouter(prefix="/scan", tags=["scan"])

# Bitmap formats only — Stage 2's OpenCV normalizer can't decode SVG, and a
# real production capture is always a phone-camera raster anyway. The
# frontend's Recent-Captures rail rasterizes the SVG references to PNG via
# canvas before upload.
_ALLOWED_CONTENT_TYPES = frozenset(
    {"image/jpeg", "image/jpg", "image/png", "image/webp"}
)
_EXT_BY_CT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


# ── POST /api/scan ───────────────────────────────────────────────────────


@router.post("", response_model=ScanAcceptResponse, status_code=202)
async def accept_scan(
    image: UploadFile = File(..., description="Captured pack image"),
    batch_id: str | None = Form(default=None),
    product_name: str | None = Form(
        default=None,
        description=(
            "Batch-supplied product name. When present, the pipeline skips "
            "the `identify` stage and uses this as ground truth. When "
            "absent, Claude classifies the pack and emits an "
            "`identify_complete` event before ELA."
        ),
    ),
    nafdac_reg_number: str | None = Form(
        default=None,
        description="Batch-supplied NAFDAC registration number (paired with product_name).",
    ),
    scenario: str | None = Form(
        default=None,
        description=(
            "Stage 0/1 only — hints the stub pipeline at which scenario to "
            "play. Ignored from Stage 2 onward."
        ),
    ),
    settings: Settings = Depends(get_settings),
    registry: SessionRegistry = Depends(get_registry),
) -> ScanAcceptResponse:
    """Accept a captured pack image and open a forensic session.

    Stage 1 — persists the capture bytes to `AEGIS_UPLOAD_DIR/<session>/<file>`,
    records the SHA-256 of the bytes, and (optionally) honours a scenario hint
    so the frontend's Recent-Captures rail picks the matching stub verdict.
    Stage 2 will hand the persisted bytes to the OpenCV normalizer.
    """
    if image.content_type not in _ALLOWED_CONTENT_TYPES:
        raise UnsupportedMedia(image.content_type)
    if scenario is not None and scenario not in ALLOWED_SCENARIO_HINTS:
        raise InvalidScenarioHint(scenario, sorted(ALLOWED_SCENARIO_HINTS))

    # Stream-read with a hard cap. We hash on the fly so we don't hold the
    # whole image in memory twice.
    upload_dir = settings.ensure_upload_dir()
    session = await registry.create(
        batch_id=batch_id,
        scenario_hint=scenario,
        supplied_product_name=product_name,
        supplied_nafdac_reg_number=nafdac_reg_number,
    )
    ext = _EXT_BY_CT.get(image.content_type or "", ".bin")
    target_dir = upload_dir / session.session_id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"capture{ext}"

    sha = hashlib.sha256()
    total = 0
    try:
        async with aiofiles.open(target_path, "wb") as fh:
            while True:
                chunk = await image.read(64 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    await fh.close()
                    target_path.unlink(missing_ok=True)
                    raise UploadTooLarge(size=total, limit=settings.max_upload_bytes)
                sha.update(chunk)
                await fh.write(chunk)
    finally:
        await image.close()

    await registry.attach_capture(
        session.session_id,
        image_path=target_path,
        image_sha256=sha.hexdigest(),
        content_type=image.content_type or "application/octet-stream",
        byte_size=total,
    )
    log.info(
        "scan.accept",
        extra={
            "sessionId": session.session_id,
            "bytes": total,
            "contentType": image.content_type,
            "batchId": batch_id,
            "scenarioHint": scenario,
            "suppliedProductName": product_name,
            "sha256": sha.hexdigest(),
        },
    )
    return ScanAcceptResponse(
        session_id=session.session_id,
        accepted_at=session.accepted_at,
    )


# ── GET /api/scan/{id}/stream ────────────────────────────────────────────


@router.get("/{session_id}/stream")
async def stream_scan(
    session_id: str,
    settings: Settings = Depends(get_settings),
    registry: SessionRegistry = Depends(get_registry),
) -> EventSourceResponse:
    """Subscribe to the forensic pipeline for a session."""
    session = await registry.get(session_id)
    if session is None:
        raise SessionNotFound(session_id)

    async def event_source() -> AsyncIterator[dict[str, Any]]:
        try:
            async for evt in pipeline_service.run_pipeline(session, registry):
                yield event_to_frame(evt)
        except Exception as exc:  # noqa: BLE001 — log + re-emit as contract error
            log.exception(
                "stream.pipeline_crashed",
                extra={
                    "sessionId": session_id,
                    "errorType": type(exc).__name__,
                },
            )
            # Surface a contract-shaped error frame so the frontend can
            # render the recoverable-error UX instead of a bare transport drop.
            yield {
                "event": "error",
                "data": (
                    f'{{"stage":"error","timestamp":"","failedStage":"upload",'
                    f'"message":"Pipeline crashed: {type(exc).__name__}",'
                    f'"recoverable":false}}'
                ),
            }

    return EventSourceResponse(
        event_source(),
        ping=settings.sse_keepalive_seconds,
        send_timeout=None,
    )


# ── GET /api/scan/{id}/result ────────────────────────────────────────────


@router.get("/{session_id}/result", response_model=ScanResult)
async def get_result(
    session_id: str,
    registry: SessionRegistry = Depends(get_registry),
) -> ScanResult:
    """Fallback — fetch the terminal ScanResult after the stream completes."""
    session = await registry.get(session_id)
    if session is None:
        raise SessionNotFound(session_id)
    if session.result is None:
        raise SessionNotComplete(session_id)
    return session.result


# ── GET /api/scan/{id}/capture ───────────────────────────────────────────


@router.get("/{session_id}/capture")
async def get_capture(
    session_id: str,
    registry: SessionRegistry = Depends(get_registry),
) -> FileResponse:
    """Serve the original uploaded capture bytes (private to the session)."""
    session = await registry.get(session_id)
    if session is None:
        raise SessionNotFound(session_id)
    if session.image_path is None or not Path(session.image_path).exists():
        raise CaptureNotAvailable(session_id)
    return FileResponse(
        path=session.image_path,
        media_type=session.content_type or "application/octet-stream",
        filename=Path(session.image_path).name,
        headers={"cache-control": "private, max-age=300"},
    )


# ── GET /api/scan/{id}/normalized ────────────────────────────────────────


@router.get("/{session_id}/normalized")
async def get_normalized(
    session_id: str,
    registry: SessionRegistry = Depends(get_registry),
) -> FileResponse:
    """Serve the perspective-corrected capture.

    Build stage 2 — once the pipeline's normalization step has run, this
    serves the warped JPEG written by `app.services.normalize.normalize_capture`.
    Before the warp lands (e.g. an early consumer racing the stream), or when
    the `[forensic]` extras aren't installed, it falls back to the raw upload
    so the contract URL never 404s on a live session.
    """
    session = await registry.get(session_id)
    if session is None:
        raise SessionNotFound(session_id)

    # Prefer the warped artefact.
    if (
        session.normalized_path is not None
        and Path(session.normalized_path).exists()
    ):
        return FileResponse(
            path=session.normalized_path,
            media_type=session.normalized_content_type or "image/jpeg",
            filename=f"normalized-{session_id}{Path(session.normalized_path).suffix}",
            headers={"cache-control": "private, max-age=300"},
        )

    # Fall back to the original capture.
    if session.image_path is None or not Path(session.image_path).exists():
        raise CaptureNotAvailable(session_id)
    return FileResponse(
        path=session.image_path,
        media_type=session.content_type or "application/octet-stream",
        filename=f"normalized-{session_id}{Path(session.image_path).suffix}",
        headers={"cache-control": "private, max-age=300"},
    )
