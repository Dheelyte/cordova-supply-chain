"""Domain errors + their HTTP translation."""
from __future__ import annotations

from fastapi import HTTPException, status


class SessionNotFound(HTTPException):
    def __init__(self, session_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "session_not_found", "sessionId": session_id},
        )


class SessionNotComplete(HTTPException):
    def __init__(self, session_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "session_not_complete", "sessionId": session_id},
        )


class UploadTooLarge(HTTPException):
    def __init__(self, size: int, limit: int) -> None:
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": "upload_too_large", "size": size, "limit": limit},
        )


class UnsupportedMedia(HTTPException):
    def __init__(self, content_type: str | None) -> None:
        super().__init__(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": "unsupported_media", "contentType": content_type},
        )


class InvalidScenarioHint(HTTPException):
    def __init__(self, hint: str, allowed: list[str]) -> None:
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "invalid_scenario_hint",
                "hint": hint,
                "allowed": allowed,
            },
        )


class CaptureNotAvailable(HTTPException):
    def __init__(self, session_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "capture_not_available", "sessionId": session_id},
        )
