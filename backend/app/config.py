"""Typed application settings sourced from environment + .env file.

Every setting carries a default so the app boots in development without an
`.env`, but production deployments should set them explicitly.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings — all `AEGIS_`-prefixed env vars."""

    model_config = SettingsConfigDict(
        env_prefix="AEGIS_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Service identity ────────────────────────────────────────────────
    app_env: str = Field(default="development", description="dev/staging/prod")
    app_name: str = Field(default="aegis-forensic")
    log_level: str = Field(default="INFO")

    # ── Server ──────────────────────────────────────────────────────────
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000, ge=1, le=65535)

    # ── CORS ────────────────────────────────────────────────────────────
    # `NoDecode` tells pydantic-settings to skip JSON-parsing this from env
    # so our comma-split validator below is what runs.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # ── Storage ─────────────────────────────────────────────────────────
    upload_dir: Path = Field(default=Path("./uploads"))
    max_upload_bytes: int = Field(default=12_582_912, ge=1)

    # ── SSE ─────────────────────────────────────────────────────────────
    sse_keepalive_seconds: int = Field(default=15, ge=1)

    # ── Anthropic (optional at Stage 0) ─────────────────────────────────
    # The Anthropic SDK and every published tutorial use the unprefixed
    # `ANTHROPIC_API_KEY` env var. Override the AEGIS_ prefix so users
    # don't have to rename their key.
    anthropic_api_key: str | None = Field(
        default=None,
        validation_alias="ANTHROPIC_API_KEY",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v: object) -> object:
        """Accept a comma-separated string from env, list from code."""
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @field_validator("log_level")
    @classmethod
    def _upper_level(cls, v: str) -> str:
        return v.upper()

    def ensure_upload_dir(self) -> Path:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        return self.upload_dir


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings singleton — safe to call from anywhere."""
    return Settings()
