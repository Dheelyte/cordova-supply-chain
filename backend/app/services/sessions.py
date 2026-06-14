"""In-memory scan-session registry.

Build stage 1 — sessions now carry the persisted capture bytes' SHA-256 hash
and on-disk path. Stage 5 will swap this for a persistent store keyed by
`(batchHash, captureHash)` so re-scans of the same pack are O(1).
"""
from __future__ import annotations

import asyncio
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.schemas.scan import ScanResult


def _iso_now() -> str:
    """ISO-8601 UTC with millisecond precision, `Z` suffix."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


# ─── Allowed scenario hints (Stage 0/1 only — see decisions.md D-0008) ───
#
# A Stage-1 affordance for the frontend's "Recent captures" rail: the client
# can hint which stub scenario the pipeline should play. Stage 2 onward this
# hint is ignored — the real ELA + Claude VLM derive everything from the
# uploaded image bytes.
ALLOWED_SCENARIO_HINTS: frozenset[str] = frozenset(
    {"authentic_coartem", "counterfeit_digital", "counterfeit_print"}
)


@dataclass
class ScanSession:
    """One scan session — accepted upload + warped capture + terminal result."""

    session_id: str
    accepted_at: str
    batch_id: str | None
    image_path: Path | None = None
    image_sha256: str | None = None
    content_type: str | None = None
    byte_size: int = 0
    scenario_hint: str | None = None
    # Stage 8 — batch-supplied product context. When present, the pipeline
    # skips the `identify` stage and uses these as ground truth.
    supplied_product_name: str | None = None
    supplied_nafdac_reg_number: str | None = None
    # Stage 8 — identify stage outputs (set when identify ran).
    identified_product_name: str | None = None
    identified_nafdac_reg_number: str | None = None
    identified_confidence: float | None = None
    identified_reference_key: str | None = None
    # Build stage 2 — perspective-normalized artefact, served at /normalized.
    normalized_path: Path | None = None
    normalized_content_type: str | None = None
    normalization_bbox: tuple[float, float, float, float] | None = None
    normalization_confidence: float | None = None
    # Build stage 3 — ELA analysis cached on the session for Stage 5's reuse.
    ela_score: float | None = None
    ela_mean_error: float | None = None
    ela_peak_intensity: float | None = None
    ela_hot_pixel_ratio: float | None = None
    # Build stage 4 — VLM analysis cached on the session for Stage 5's reuse.
    vlm_score: float | None = None
    vlm_finding_count: int | None = None
    vlm_summary: str | None = None
    vlm_cache_read_tokens: int | None = None
    vlm_cache_creation_tokens: int | None = None
    result: ScanResult | None = None
    completed_at: str | None = None
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)


class SessionRegistry:
    """Tiny async-safe in-memory store."""

    def __init__(self) -> None:
        self._sessions: dict[str, ScanSession] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _mint() -> str:
        return f"sess_{secrets.token_hex(6)}"

    async def create(
        self,
        *,
        batch_id: str | None,
        scenario_hint: str | None = None,
        supplied_product_name: str | None = None,
        supplied_nafdac_reg_number: str | None = None,
    ) -> ScanSession:
        async with self._lock:
            session = ScanSession(
                session_id=self._mint(),
                accepted_at=_iso_now(),
                batch_id=batch_id,
                scenario_hint=scenario_hint,
                supplied_product_name=supplied_product_name,
                supplied_nafdac_reg_number=supplied_nafdac_reg_number,
            )
            self._sessions[session.session_id] = session
            return session

    async def attach_identify(
        self,
        session_id: str,
        *,
        product_name: str,
        nafdac_reg_number: str | None,
        confidence: float,
        reference_key: str | None,
    ) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        async with session._lock:
            session.identified_product_name = product_name
            session.identified_nafdac_reg_number = nafdac_reg_number
            session.identified_confidence = confidence
            session.identified_reference_key = reference_key

    async def get(self, session_id: str) -> ScanSession | None:
        async with self._lock:
            return self._sessions.get(session_id)

    async def attach_capture(
        self,
        session_id: str,
        *,
        image_path: Path,
        image_sha256: str,
        content_type: str,
        byte_size: int,
    ) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        async with session._lock:
            session.image_path = image_path
            session.image_sha256 = image_sha256
            session.content_type = content_type
            session.byte_size = byte_size

    async def attach_normalized(
        self,
        session_id: str,
        *,
        path: Path,
        content_type: str,
        bbox: tuple[float, float, float, float],
        confidence: float,
    ) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        async with session._lock:
            session.normalized_path = path
            session.normalized_content_type = content_type
            session.normalization_bbox = bbox
            session.normalization_confidence = confidence

    async def attach_ela(
        self,
        session_id: str,
        *,
        score: float,
        mean_error: float,
        peak_intensity: float,
        hot_pixel_ratio: float,
    ) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        async with session._lock:
            session.ela_score = score
            session.ela_mean_error = mean_error
            session.ela_peak_intensity = peak_intensity
            session.ela_hot_pixel_ratio = hot_pixel_ratio

    async def attach_vlm(
        self,
        session_id: str,
        *,
        score: float,
        finding_count: int,
        summary: str,
        cache_read_tokens: int,
        cache_creation_tokens: int,
    ) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        async with session._lock:
            session.vlm_score = score
            session.vlm_finding_count = finding_count
            session.vlm_summary = summary
            session.vlm_cache_read_tokens = cache_read_tokens
            session.vlm_cache_creation_tokens = cache_creation_tokens

    async def set_result(self, session_id: str, result: ScanResult) -> None:
        session = await self.get(session_id)
        if session is None:
            return
        async with session._lock:
            session.result = result
            session.completed_at = _iso_now()

    async def all_ids(self) -> list[str]:
        async with self._lock:
            return list(self._sessions.keys())


_registry: SessionRegistry | None = None


def get_registry() -> SessionRegistry:
    """Singleton — created lazily so tests can swap it via dependency_overrides."""
    global _registry
    if _registry is None:
        _registry = SessionRegistry()
    return _registry
