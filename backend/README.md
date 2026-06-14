# Aegis — Forensic Backend

FastAPI implementation of the [Aegis forensic scan pipeline contract](../contract/README.md).

> **Build stage 7 — end-to-end.** All pipeline stages run real algorithms:
> OpenCV homography (Stage 2), Pillow/numpy ELA (Stage 3), Claude vision VLM
> (Stage 4), weighted consensus + persistent verdict cache (Stage 5). The
> frontend at [`../src/`](../src/) consumes the same wire contract over
> SSE. Scenario hints (`scenario` form field on `POST /api/scan`) remain
> available for demo determinism but real algorithms always run alongside
> for the forensic trace.

## Quickstart

Requirements: Python 3.12, [uv](https://github.com/astral-sh/uv).

```bash
cd backend
cp .env.example .env
make install        # uv venv + uv pip install -e ".[dev]"
make dev            # uvicorn on http://127.0.0.1:8000
```

Then:

| URL | What |
|---|---|
| `http://127.0.0.1:8000/api/health` | Liveness + build metadata |
| `http://127.0.0.1:8000/api/docs` | Swagger UI |
| `http://127.0.0.1:8000/api/openapi.json` | Generated OpenAPI 3.1 |

## Project layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app factory · CORS · middleware · routers
│   ├── config.py            # pydantic-settings — all AEGIS_*  env vars
│   ├── core/
│   │   ├── logging.py       # structured key=value formatter
│   │   ├── sse.py           # contract event → sse-starlette frame
│   │   └── errors.py        # HTTPException subclasses with structured detail
│   ├── schemas/
│   │   ├── scan.py          # Pydantic mirror of the scan contract
│   │   └── health.py
│   ├── services/
│   │   ├── sessions.py      # In-memory ScanSession registry
│   │   ├── stubs.py         # Stage-0 deterministic scenarios
│   │   └── pipeline.py      # Async generator yielding contract events
│   └── routers/
│       ├── scan.py          # POST /api/scan · GET /:id/stream · GET /:id/result
│       └── health.py
└── tests/
    ├── test_health.py
    └── test_scan_contract.py  # Wire-shape assertions
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/scan` | Multipart upload — opens a session |
| `GET`  | `/api/scan/{session_id}/stream` | SSE stream of pipeline events |
| `GET`  | `/api/scan/{session_id}/result` | Terminal `ScanResult` (fallback) |
| `GET`  | `/api/health` | Liveness |

All non-streaming endpoints have generated docs at `/api/docs`. The stream
endpoint is plain `text/event-stream` — see
[`contract/README.md` §SSE framing](../contract/README.md#sse-framing).

## Try it without the frontend

```bash
# Open a session
curl -sS -X POST http://127.0.0.1:8000/api/scan \
  -F image=@public/reference/coartem.svg   # any image file works at Stage 0

# Subscribe to the stream
curl -N http://127.0.0.1:8000/api/scan/<sessionId>/stream
```

Every response carries `x-aegis-build-stage` so you can verify the build phase
from the network panel.

## Developing

| Command | What |
|---|---|
| `make dev` | uvicorn with `--reload` |
| `make test` | pytest |
| `make lint` | ruff |
| `make format` | ruff format |
| `make typecheck` | mypy --strict |
| `make check` | lint + typecheck + test |
| `make schema` | Dump generated OpenAPI to stdout |
