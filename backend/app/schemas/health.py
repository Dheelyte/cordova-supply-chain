"""Health endpoint DTO."""
from __future__ import annotations

from typing import Literal

from app.schemas.scan import ContractModel


class HealthResponse(ContractModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    env: str
    time: str
