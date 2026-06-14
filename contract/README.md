# Aegis — Forensic Scan Pipeline Contract

The wire contract between the **Next.js frontend** and the **FastAPI forensic
backend**. This document is the human-readable source of truth. It is mirrored,
in lockstep, by:

| Artefact | Path | Role |
|---|---|---|
| TypeScript types | `src/lib/contract/scan.ts` | Frontend — compile-time contract |
| JSON Schema | `contract/scan-pipeline.schema.json` | Language-neutral validation |
| Pydantic models | `backend/app/schemas/scan.py` | Backend — runtime validation + OpenAPI |
| This document | `contract/README.md` | The spec everyone reads first |

**Rule:** a shape change lands in all four, in the same commit.

---

## 1. Pipeline overview

A forensic scan runs **four or five** ordered stages — `identify_complete` is
only emitted when the scan was accepted without a `product_name` form field
(no batch context, "scan anything" flow). The frontend uploads a capture,
gets a `sessionId`, then subscribes to a Server-Sent Events stream:

```
POST /api/scan ──▶ { sessionId }
                      │
                      ▼
GET /api/scan/{sessionId}/stream  (text/event-stream)
   │
   ├─ event: normalization_complete    (OpenCV — detect label, warp flat)
   ├─ event: identify_complete         (Claude vision — classify product · CONDITIONAL)
   ├─ event: ela_complete              (Error Level Analysis — digital integrity)
   ├─ event: vlm_complete              (Claude vision — print integrity vs NAFDAC ref)
   └─ event: consensus                 (weighted verdict — terminal event)
```

When `product_name` is supplied on the upload (a batch-context scan), the
identify stage is skipped — the supplied product is treated as ground truth.
When it's omitted, identify runs first and its result picks which NAFDAC
reference (if any) the VLM compares against. If no reference is on file for
the identified product, the VLM stage degrades to identification-only:
`vlmScore`, `referenceImage` and `referenceRegNumber` are `null` on the
wire, `referenceAvailable` is `false`, and consensus uses ELA alone.

If a stage fails, the stream emits `event: error` carrying a `ScanErrorEvent`.
The client then falls back to `GET /api/scan/{sessionId}/result`.

---

## 2. Transport — why SSE

The pipeline is **one-directional and staged**: the server pushes four events,
the client never pushes back mid-stream. That is exactly the shape SSE was
designed for.

- **vs WebSocket** — WebSocket is bidirectional and needs its own framing,
  ping/pong, and reconnection logic. We need none of that. SSE is plain HTTP.
- **vs polling** — polling would miss the staged-reveal timing the UI depends on
  and would hammer the verdict cache.
- **Native client** — the browser's `EventSource` reconnects automatically and
  needs zero dependencies. The in-browser simulator already mimics an
  `EventSource`-shaped handle, so build Stage 1's swap is a one-file change.

Each SSE message uses the stage name as the event channel:

```
event: ela_complete
data: {"stage":"ela_complete","timestamp":"2026-05-14T17:42:19.443Z","latencyMs":1180,"payload":{...}}

```

The `data:` line is the full JSON of a `ScanPipelineEvent`. The trailing blank
line terminates the message per the SSE spec.

---

## 3. Endpoints

### `POST /api/scan`

Multipart upload of the captured image.

| Field | Type | Notes |
|---|---|---|
| `capture` | file (image/jpeg, image/png) | The raw camera capture. |
| `batchId` | string \| omitted | Batch the scan supports, if scanning to accept a shipment. |

**Response `200`** — `ScanAcceptResponse`:

```json
{ "sessionId": "sess_a1b2c3d4e5f6", "acceptedAt": "2026-05-14T17:42:17.001Z" }
```

**Errors** — `415` unsupported media type, `413` payload too large.

### `GET /api/scan/{sessionId}/stream`

`text/event-stream`. Emits the four staged events in order, then closes.
Emits `event: error` on stage failure.

### `GET /api/scan/{sessionId}/result`

Fallback for when the stream drops. Returns the terminal `ScanResult` once the
pipeline has completed; `409` if the pipeline is still running, `404` if the
session is unknown.

### `GET /api/health`

Liveness probe. Returns `HealthResponse`.

---

## 4. Types

### Primitives

```
Verdict      = "PASS" | "REVIEW" | "FAIL"     // >=85 PASS · 60–84 REVIEW · <60 FAIL
VlmSeverity  = "info" | "warning" | "critical"

ElaRect      { x, y, w, h, intensity }         // all normalised 0..1
VlmFinding   { id, x, y, title, detail, severity }   // id 1-indexed; x,y normalised 0..1
```

### Stage payloads

```
NormalizationPayload {
  sessionId, productName,
  bbox: [x, y, w, h],            // detected label box, normalised 0..1
  normalizedImageUrl             // URL to the perspective-corrected capture
}

ElaPayload {
  sessionId, productName,
  elaScore: 0..100,              // higher is cleaner
  elaMap: ElaRect[],
  heatmapImageUrl?               // optional raster heatmap
}

VlmPayload {
  sessionId, productName,
  vlmScore: 0..100,              // higher is cleaner
  vlmFindings: VlmFinding[],
  referenceImage,                // URL of the NAFDAC golden reference used
  referenceRegNumber             // NAFDAC reg number the reference was keyed by
}

ScanResult {                     // the `consensus` payload — terminal
  sessionId, productName, batchId?,
  capturedAt,                    // ISO 8601
  elaScore, vlmScore, consensusScore,
  verdict: Verdict,
  elaMap: ElaRect[], vlmFindings: VlmFinding[],
  summary, referenceImage
}
```

### Events

Every event carries `timestamp` (ISO 8601) and `latencyMs` (wall-clock ms the
stage took), plus a `stage` discriminant and its `payload`:

| `stage` | `payload` type |
|---|---|
| `normalization_complete` | `NormalizationPayload` |
| `ela_complete` | `ElaPayload` |
| `vlm_complete` | `VlmPayload` |
| `consensus` | `ScanResult` |

```
ScanErrorEvent {
  stage: "error",
  timestamp,
  failedStage: ScanPipelineStage | "upload",
  message,
  recoverable: boolean           // when true, client falls back to /result
}
```

---

## 5. Scoring rules

- `consensusScore` is a weighted average of `elaScore` and `vlmScore`. The
  weighting lives in `backend/app/services/pipeline.py` (build Stage 5). For the
  contract, treat it as opaque — the client renders whatever it receives.
- `verdict` derives from `consensusScore`: `>=85 → PASS`, `60–84 → REVIEW`,
  `<60 → FAIL`. The client must not re-derive it; the backend is authoritative.

---

## 6. Versioning

The contract is currently **v0** — pre-backend, defined against the in-browser
simulator. It is frozen at build Stage 0 and only changes by deliberate,
lockstep edits across all four artefacts. When the backend ships a breaking
change, bump to `/api/v1/...` and keep `/api/...` pointing at the latest.
