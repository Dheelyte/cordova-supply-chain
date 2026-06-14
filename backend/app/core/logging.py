"""Structured logging — one consistent format across uvicorn and app loggers.

We keep dependency surface minimal (stdlib `logging` only). The formatter is
a compact key=value form that's grep-friendly in dev and parseable in prod.
"""
from __future__ import annotations

import logging
import sys
from typing import Any


class KeyValueFormatter(logging.Formatter):
    """`2026-05-14T18:42:18.443Z level=INFO logger=app.scan msg="…" k=v ...`"""

    def format(self, record: logging.LogRecord) -> str:
        ts = self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S")
        ms = int(record.msecs)
        head = (
            f'{ts}.{ms:03d}Z level={record.levelname} '
            f"logger={record.name} msg={record.getMessage()!r}"
        )
        extras = _extra_pairs(record)
        return f"{head} {extras}".rstrip()


_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "asctime", "message", "taskName",
}


def _extra_pairs(record: logging.LogRecord) -> str:
    parts: list[str] = []
    for k, v in record.__dict__.items():
        if k in _RESERVED or k.startswith("_"):
            continue
        parts.append(f"{k}={_fmt_value(v)}")
    return " ".join(parts)


def _fmt_value(v: Any) -> str:
    if isinstance(v, str):
        return v if " " not in v and '"' not in v else repr(v)
    return str(v)


def configure_logging(level: str = "INFO") -> None:
    """Replace the root + uvicorn handlers with our formatter."""
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(KeyValueFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    for noisy in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(noisy)
        lg.handlers.clear()
        lg.addHandler(handler)
        lg.propagate = False
        lg.setLevel(level)
