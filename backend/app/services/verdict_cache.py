"""Persistent verdict cache — keyed by (batchHash, captureHash).

The same pack scanned twice produces the same answer. We can either pay
OpenCV + Claude again to confirm what we already know, or we can hand back
the cached verdict instantly. This module is the persistent K/V backing
that latter path.

Storage format: a single JSON file at `<upload_dir>/_verdicts.json`.
Atomic writes via temp-file + `os.replace`. An asyncio.Lock guards
concurrent access from multiple pipeline runs within the same process.

Why JSON and not SQLite/Redis: scale doesn't justify it yet. At hackathon
scale we're measuring sessions in the hundreds. The file is small, the
lookups are O(1), and `cat _verdicts.json | jq` is the operator's debugger.
Stage 6+ swaps the storage backend behind the same async surface.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path

from app.schemas.scan import ScanResult

log = logging.getLogger("app.verdict_cache")

# Cache version. Bump if `ScanResult` ever changes shape in a breaking way —
# entries with mismatched versions are ignored on read.
CACHE_FORMAT_VERSION = 1


class VerdictCache:
    """Async-safe persistent K/V over `ScanResult`s."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = asyncio.Lock()

    # ── Public API ──────────────────────────────────────────────────────

    async def get(
        self, *, batch_id: str | None, capture_hash: str | None
    ) -> ScanResult | None:
        if not capture_hash:
            return None
        async with self._lock:
            store = await asyncio.to_thread(self._read_store)
        entry = store["entries"].get(self._key(batch_id, capture_hash))
        if entry is None:
            return None
        try:
            return ScanResult.model_validate(entry["result"])
        except Exception:  # noqa: BLE001 — corrupted entry shouldn't kill the request
            log.warning(
                "verdict_cache.invalid_entry",
                extra={"batchId": batch_id, "captureHash": capture_hash[:12]},
            )
            return None

    async def put(
        self,
        *,
        batch_id: str | None,
        capture_hash: str | None,
        result: ScanResult,
    ) -> None:
        if not capture_hash:
            return
        async with self._lock:
            store = await asyncio.to_thread(self._read_store)
            store["entries"][self._key(batch_id, capture_hash)] = {
                "result": result.model_dump(mode="json", by_alias=True),
                "indexed_at": self._iso_now(),
            }
            await asyncio.to_thread(self._write_store, store)
        log.info(
            "verdict_cache.put",
            extra={
                "batchId": batch_id,
                "captureHash": capture_hash[:12],
                "verdict": result.verdict,
                "consensusScore": result.consensus_score,
            },
        )

    async def size(self) -> int:
        async with self._lock:
            store = await asyncio.to_thread(self._read_store)
        return len(store["entries"])

    # ── Internals ───────────────────────────────────────────────────────

    @staticmethod
    def _key(batch_id: str | None, capture_hash: str) -> str:
        return f"{batch_id or 'none'}::{capture_hash}"

    @staticmethod
    def _iso_now() -> str:
        from datetime import datetime, timezone

        return (
            datetime.now(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

    def _read_store(self) -> dict[str, object]:
        if not self.path.exists():
            return {"version": CACHE_FORMAT_VERSION, "entries": {}}
        try:
            data = json.loads(self.path.read_text())
            if data.get("version") != CACHE_FORMAT_VERSION:
                log.warning(
                    "verdict_cache.version_skew",
                    extra={
                        "onDisk": data.get("version"),
                        "expected": CACHE_FORMAT_VERSION,
                    },
                )
                return {"version": CACHE_FORMAT_VERSION, "entries": {}}
            data.setdefault("entries", {})
            return data
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("verdict_cache.read_failed", extra={"error": str(exc)})
            return {"version": CACHE_FORMAT_VERSION, "entries": {}}

    def _write_store(self, store: dict[str, object]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(store, indent=2, sort_keys=True))
        os.replace(tmp, self.path)


# ─── Singleton ───────────────────────────────────────────────────────────

_cache: VerdictCache | None = None


def get_verdict_cache() -> VerdictCache:
    """Singleton — created lazily so tests can swap via dependency_overrides."""
    global _cache
    if _cache is None:
        from app.config import get_settings

        settings = get_settings()
        _cache = VerdictCache(settings.upload_dir / "_verdicts.json")
    return _cache


def reset_verdict_cache_for_tests() -> None:
    """Pytest fixture hook — drops the singleton so a tmp_path one is built fresh."""
    global _cache
    _cache = None
