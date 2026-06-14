# Aegis

Forensic pharmaceutical supply-chain gateway. The frontend is a Next.js 16
app, the backend is a FastAPI service that runs ELA + Claude vision against
each captured pack and emits the verdict over Server-Sent Events.

## Layout

```
.
├── src/                      Next.js 16 (App Router · TS strict · Tailwind 4)
├── backend/                  FastAPI · Python ≥3.12 · OpenCV · Claude vision
├── contract/                 Canonical scan-pipeline contract (md + json-schema)
└── decisions.md              Architectural decision log (ADRs, newest first)
```

The contract at [`contract/README.md`](contract/README.md) is the single
source of truth for the wire shape — the TypeScript types
([`src/lib/contract/scan.ts`](src/lib/contract/scan.ts)) and the Pydantic
models ([`backend/app/schemas/scan.py`](backend/app/schemas/scan.py)) mirror
it (D-0001).

## Running the stack

Two terminals.

**Backend** — needs `ANTHROPIC_API_KEY` exported (or set in `backend/.env`):

```bash
cd backend
cp .env.example .env        # one-time
make install                # uv venv + uv pip install -e ".[dev,forensic]"
make dev                    # uvicorn on http://127.0.0.1:8000
```

**Frontend** — set `NEXT_PUBLIC_AEGIS_API_BASE=http://127.0.0.1:8000` in
`.env.local`:

```bash
npm install
npm run dev                 # http://localhost:3000
```

Open `/scan` to capture a pack via the live webcam; the verdict streams in
on `/scan/<sessionId>/result`. With no Claude key configured, the backend
falls back to deterministic scenario stubs so the rest of the pipeline
still demos end-to-end.

## Tests

Backend:

```bash
cd backend && make test
```

Forensic-extras tests (`test_normalize.py`, `test_ela.py`,
`test_consensus_pipeline.py`) skip cleanly when OpenCV/Pillow aren't
installed.

Frontend type-check:

```bash
npx tsc --noEmit
```

## Decisions

Every cross-cutting decision lands in [`decisions.md`](decisions.md) as a
small ADR. Newest first. Stage-tagged so they map back to the build phases.
# cordova-supply-chain
