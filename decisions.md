# Aegis — Architectural Decisions Log

A running record of decisions that affect more than one part of the system.
Newest first. Each entry is a small ADR: context · decision · consequence.

> Conventions for entries: title prefixed by the build stage, decision in
> present tense, consequence describes the trade-off we accept.

---

## D-0030 · `[Stage 8]` No-reference scans degrade VLM, not the verdict

**Context.** With the identify stage live, the pipeline can encounter
products it has no NAFDAC golden image for ("Paracetamol 500mg",
"Amoxil 250mg", anything outside `references._PALETTE`). The VLM stage
needs *something* to compare against; without a reference there's no
comparison to run.

**Decision.** When `identity.reference_key is None`, the VLM stage emits
a contract-valid payload with `vlmScore=null`, `vlmFindings=[]`,
`referenceImage=null`, `referenceRegNumber=null`, and
`referenceAvailable=false`. Consensus then weights ELA at 1.0 and VLM at
0.0 — the verdict is digital-integrity-only and the summary makes that
explicit. The frontend renders "no reference" in the VLM sidebar row and
hides the side-by-side comparison panel.

**Consequence.** Operators can scan any pack and still get a meaningful
forensic result. The verdict is honest about what it *did not* check, so
a PASS on an unknown product can't be mistaken for full forensic
authentication. The contract change (nullable `vlmScore`, nullable
`referenceImage`, new `referenceAvailable: boolean`) is mirrored in all
four contract artefacts in one commit, per D-0001.

---

## D-0029 · `[Stage 8]` Batch context short-circuits the identify stage

**Context.** When the scan is launched from a batch detail page, the
operator already knows the product and the NAFDAC reg number. Running an
extra Claude classification round-trip in that case is pure latency cost
with no upside — and worse, if Claude misclassifies the visually similar
pack, the comparison stage would run against the wrong reference.

**Decision.** `POST /api/scan` accepts optional `product_name` and
`nafdac_reg_number` form fields. When `product_name` is present, the
pipeline skips the identify stage entirely and propagates the supplied
identity to ELA, VLM, and consensus. The frontend sets these whenever
the scan page was opened with a `batchId` query param (which already
resolves to a `MockBatch` with `productName`, `dosage`, and `nafdacReg`).

**Consequence.** The 4-stage pipeline (no identify) preserves the
existing UX rhythm for the batch-aware flow that judges will see most
often. The 5-stage variant only runs for "scan anything" use cases. The
operator's batch attestation is trusted as ground truth — a
misattribution is now a process problem upstream, not something the
backend is on the hook to detect.

---

## D-0028 · `[Stage 8]` Identify is a conditional 5th stage, not a combined VLM call

**Context.** The product-identification problem ("what's on this pack?")
is distinct from the integrity-comparison problem ("does this pack
match what NAFDAC says it should look like?"). Combining them into a
single Claude call would couple them at the prompt level — every
comparison call would also have to do classification, which is wasteful
when batch context already supplies the identity.

**Decision.** Add `identify_complete` as a new conditional event in the
`ScanPipelineEvent` discriminated union, emitted between `normalization_complete`
and `ela_complete`. The Claude call is its own service (`app.services.identify`)
with a separate JSON schema (`product_name`, `nafdac_reg_number`,
`confidence`, `reference_key`). The pipeline runs it only when the
upload didn't carry a `product_name` form field. The result is attached
to the session and read by VLM + consensus through a `_resolve_identity`
helper that prefers batch context → identify result → stub fallback.

**Consequence.** Five-mirror contract change instead of one (TS,
Pydantic, JSON Schema, MD, plus frontend stage strip). The benefit is a
clean conditional execution path the frontend can render as a fifth
stage pill — the UI honestly shows the operator that classification is
happening as its own step, and the cost is bounded (one extra Claude
call only when batch context is missing).

---

## D-0027 · `[Stage 7]` Build-stage breadcrumb pins to the highest delivered stage, not the running stage

**Context.** The `x-aegis-build-stage` response header (set on every
response by an HTTP middleware in `backend/app/main.py`) was meant as a
network-panel debug aid during the integration phases. With Stage 7
landing, "what stage is the build at" becomes a less useful question — the
pipeline runs all stages every time.

**Decision.** Keep the header. Bump it to `"7"` on Stage 7 (end-to-end
pass) and freeze it there. The `test_health_ok` test pins this so future
breaking-contract work has to acknowledge it explicitly.

**Consequence.** The frontend doesn't depend on this header for routing
decisions — it's purely informational. We could remove it post-hackathon
without breaking anything, but the cost of keeping it is one middleware
line and the value during demos is non-trivial (judges can see in
DevTools that they're talking to the real backend, not MSW).

---

## D-0026 · `[Stage 6]` Awaiting-Claude affordance is sidebar-only, not centerpiece

**Context.** Claude vision (VLM stage) is the slowest leg of the pipeline —
several seconds to a low double-digit count. While ELA has landed but VLM
hasn't, the result page's centerpiece is mid-animation on the ELA heatmap
(real activity), but the sidebar's VLM row shows a bare `pending` chip with
no explanation of where the latency is coming from.

**Decision.** Add a pulsing-dot affordance + "awaiting Claude…" label to the
sidebar's VLM ScoreRow when `stage === "ela"` and `vlmScore === null`. Don't
add it to the centerpiece — the ELA heatmap is already telling the operator
something is happening, and a duplicated affordance there would compete
with the real-data animation.

**Consequence.** Operators get a clear signal about where the wait is
coming from without competing with the live ELA reveal. The implementation
is a single optional `pendingLabel` prop on `ScoreRow`; no new state needed.

---

## D-0025 · `[Stage 6]` Inline retry banner on non-recoverable stream failure

**Context.** `useScanPipeline` already races `GET /api/scan/{id}/result`
against the SSE error channel when the failure is `recoverable: true`. But
on a `recoverable: false` error (discriminant mismatch, malformed payload)
the user was left staring at a frozen stage strip with only a tiny "stream
error" badge in the corner.

**Decision.** When `pipeline.status === "error"` *and* the fallback didn't
land a result, render an inline error Card directly under the stage strip
with `Re-capture` (routes to `/scan`) and `Retry stream` (page reload)
CTAs. Surfaces the failedStage + message from the contract's
`ScanErrorEvent` so the operator knows whether it was upload, normalize,
ELA, VLM, or consensus that failed.

**Consequence.** Failure path is no longer a dead end. The page also keeps
working for the recoverable case — the banner only renders when fallback
*also* failed, so the common case (transient SSE drop → fallback wins)
stays clean.

---

## D-0024 · `[Stage 6]` Native `getUserMedia` for capture — no react-webcam dep

**Context.** The Stage 6 brief said "use react-webcam"; the dep wasn't
actually in `package.json`. Adding it would be one more dependency, one
more abstraction layer, and one more thing to upgrade — for a thin wrapper
around `navigator.mediaDevices.getUserMedia` + a `<video>` element.

**Decision.** Skip the dep. The scan page now requests
`getUserMedia({ video: { facingMode: { ideal: "environment" } } })` on
mount, attaches the `MediaStream` to a `<video>` via `srcObject`, and on
shutter draws the current video frame into an off-screen canvas → JPEG
blob → multipart upload. On `getUserMedia` rejection or unavailability the
page falls back to the synthetic viewfinder; the Recent-captures rail and
file picker still work in that mode (useful for headless dev,
desktops without webcams, and CI).

**Consequence.** Three explicit camera states (`pending` / `live` /
`denied`) surface as top-bar badges. The torch button is currently inert —
torch control requires the imageCapture API + `applyConstraints` and isn't
universally supported; left as a UI placeholder.

---

## D-0023 · `[Stage 5]` Wallet AI gate is the scan's real consensus verdict

**Context.** The wallet's `LogicGatedButton` previously read its AI gate
from a static `aiVerdict` field seeded into the pending settlements
fixture. With real consensus on the wire, that gate should reflect what
the forensic pipeline actually decided for the linked scan — otherwise
"the wire is real but the wallet still lies" is a credibility leak.

**Decision.** The scan result page's *Accept delivery & release payment*
CTA now calls `useWallet().createSettlementFromScan({sessionId, verdict,
consensusScore, summary, batchId})`. The new pending settlement carries a
`linkedScanSessionId`; its `aiVerdict` is the scan's real verdict
(`PASS | REVIEW | FAIL`), `verdictScore` is the real consensus score,
and `aiReason` is the scan's summary when the verdict isn't PASS. The
LogicGatedButton continues to gate on `aiVerdict` + `ledgerPath` — that
mechanism is unchanged; we just changed where `aiVerdict` came from.

Pre-existing seeded settlements still work — they use `linkedScanId`
(catalogue fixture id) and a static `aiVerdict`. Both shapes coexist.
A polish pass at Stage 6 will replace the seed entirely once procurement
orders can be modelled.

**Consequence.** A real photo of a counterfeit pack flows scan → verdict
→ wallet gate as one continuous mechanism. The presenter can demonstrate
"the wire actually gates the money" without setting up demo fixtures.

---

## D-0022 · `[Stage 5]` Persistent verdict cache keyed by `(batchHash, captureHash)`

**Context.** A re-scan of the same pack should not pay the OpenCV +
Claude tax twice. The capture's SHA-256 lands on every session record
already (Stage 1), so the cache key is free. The brief explicitly listed
the cache as a Stage 5 deliverable.

**Decision.** `app/services/verdict_cache.py` — a single async-safe JSON
store at `<upload_dir>/_verdicts.json`. Key: `f"{batch_id or 'none'}::{captureHash}"`.
Value: serialized `ScanResult` (canonical wire shape). Atomic writes via
temp-file + `os.replace`. A 64-bit cache-format-version on every entry —
a future breaking change to `ScanResult` bumps the version and old
entries get ignored on read.

`run_pipeline()` checks the cache at the top. **Hit** → `_replay_from_cache()`
yields the four pipeline events with the cached `ela_score` / `ela_map` /
`vlm_score` / `vlm_findings` / verdict, re-minted with the current
session's id (so per-session URLs like `/api/scan/<id>/normalized` still
line up). The stage budgets are honoured so the UI's staged reveal still
breathes — instant replays would race the frontend's stage transitions.
**Miss** → the pipeline runs all four real stages, then writes the
result.

Why JSON, not SQLite or Redis: scale doesn't justify them yet. At
hackathon scale we measure sessions in the hundreds. The file is small,
lookups are O(1), and `cat _verdicts.json | jq` is the operator's
debugger. Stage 6+ can swap the storage backend behind the same async
surface (`VerdictCache.get` / `.put`).

**Consequence.** Re-scanning the same pack lands its prior verdict in
~2 s (just the staged-reveal cadence). Cost amortises over network
traffic. Cache format version lets us evolve the schema without
nuking the cache permanently.

---

## D-0021 · `[Stage 5]` Consensus weighting and band classification

**Context.** ELA and VLM each emit 0..100 scores. Consensus needs a
single number to drive the verdict, and a band map that matches the
contract's Verdict enum.

**Decision.**

* **Weights:** `0.55 · ela_score + 0.45 · vlm_score`. ELA gets the
  marginally larger share because it's deterministic — re-runs on the
  same bytes produce identical numbers. VLM is the more *intelligent*
  signal but is sampled from Claude (small non-determinism even at
  `effort=high`), so leaning a touch on ELA keeps the consensus stable
  across re-scans.
* **Bands:**
  - `score >= 85` → PASS
  - `score >= 60` → REVIEW
  - `score <  60` → FAIL

  These are the verdict-tier breakpoints the frontend's `TrustScoreCard`
  and `ConfidenceGauge` colour-shift around, so reusing them keeps the
  visual story consistent across Identity Wall and forensic scan.
* **Summary:** prefers Claude's `vlm_summary` (concrete description) when
  present; falls back to a band-appropriate generic otherwise.

* **Stub fallback:** when a stage hits its stub path (scenario hint set,
  or service unavailable), the consensus uses the stub's score for that
  stage. The wire stays internally consistent — emitted stage scores
  always sum to the emitted consensus score.

**Consequence.** The canonical counterfeit-digital fixture (ELA 24.8,
VLM 78.4) computes `0.55·24.8 + 0.45·78.4 = 49.0` — band FAIL, same as
the hand-tuned stub seed of 41.2. The exact numeric differs a few points
(the Stage-0 stub `consensusScore` field was hand-tuned independently)
but the verdict band lands identically, which is what matters. Stage 6
will retire the stub's standalone `consensusScore` since computing it
from the per-stage scores is now trivial.

---

## D-0020 · `[Stage 4]` Backend owns the NAFDAC reference; frontend reference URL is display-only

**Context.** The frontend ships SVG references in `/public/reference/` that
the side-by-side `VLMComparison` component renders. Claude vision needs
**bitmaps** — `cv2.imdecode` and Pillow can't decode SVG without cairo, and
adding cairo to the backend is a heavy dep for a frontend-only display
problem.

**Decision.** The backend renders its own PNG reference bank via Pillow
(`app/services/references.py`), lazily on first use, cached on disk at
`<upload_dir>/_references/<product_key>.png`. Those PNGs are private to the
backend — they're what Claude actually compares against. The contract's
`VlmPayload.referenceImage` URL keeps pointing at the frontend's SVG path
(`/reference/coartem.svg` etc.) so the comparison panel displays the
existing high-quality SVG. The backend's PNG and the frontend's SVG are
both keyed off the same `product_key`, so the user sees what the analyst
analysed even though the bytes differ.

**Consequence.** No cairo on the backend, no SVG rasterization in the
frontend, and no extra `/api/references/...` endpoint to serve. The
references render deterministically (seeded Pillow draw calls) so the
prompt cache hits are stable across restarts.

---

## D-0019 · `[Stage 4]` Scenario hint pins VLM only when present; real Claude always runs

**Context.** Same shape as the ELA decision (D-0017). The Recent-Captures
rail labels each sample with its expected verdict ("Counterfeit · Print"
etc.). If real Claude vision ran the show, the SVG-rasterized PNGs Recent
Captures uploads — clean inputs by construction — would all score ~90, and
the three sample buttons would collapse into one verdict.

**Decision.** Real Claude vision **always** runs over the persisted bytes
(normalized when available; raw upload otherwise) and the result is logged
to the trace + cached on the session (`vlm_score`, `vlm_finding_count`,
`vlm_summary`, cache-token telemetry). The wire payload then branches: if
`session.scenario_hint` is set, the `vlm_complete` event carries the stub
payload matching the hint (so the rail's labelled verdict still lands);
without a hint, the real `vlmScore` + `vlmFindings` ship.

This is the **same retirement-per-stage pattern** introduced in D-0017 for
ELA: each real algorithm comes online but keeps the demo override until
Stage 5 drops the hint entirely.

**Consequence.** Operators reading the forensic trace see real Claude
findings under `vlm.real`; presenters relying on the rail see the
advertised verdict; real photo uploads (no hint) get the genuine wire. All
three audiences are served.

---

## D-0018 · `[Stage 4]` Claude config — Opus 4.7 + adaptive thinking + effort:high + structured outputs + streaming + two-breakpoint cache

**Context.** The Claude vision call is the most expensive piece of the
pipeline. Getting the SDK knobs wrong is what wastes time and tokens.

**Decision.**

* **Model:** `claude-opus-4-7` — skill mandate. Never silently downgrade.
* **Thinking:** `thinking={"type": "adaptive"}`. The skill's recommended
  default for non-trivial calls; the model picks the budget itself.
  `display` left at the default (`"omitted"`) — we don't surface the
  reasoning to users.
* **Effort:** `output_config.effort = "high"`. The minimum recommended
  setting for intelligence-sensitive work. `xhigh` is for agentic loops
  with many tool calls, which this isn't.
* **Structured outputs:** `output_config.format` with a `json_schema`
  derived from a local Pydantic model (`_VlmResponseModel`). The JSON is
  parsed with `model_validate_json`, with a balanced-brace recovery path
  for the rare case Claude wraps the JSON in a fenced code block.
* **Streaming:** `client.messages.stream(...)` + `.get_final_message()`.
  Vision can run 3-8 s; non-streaming risks the SDK HTTP timeout. The
  context-manager pattern hides the streaming complexity — we just await
  the assembled message.
* **Caching:** two `cache_control: ephemeral, ttl=1h` breakpoints — one on
  the last system text block (stable across every scan), one on the
  reference image content block (stable across every scan of the same
  product). The capture image is appended **after** both breakpoints so
  it never invalidates the cached prefix. 2 of 4 allowed breakpoints
  used; the remaining 2 are reserved.
* **`max_tokens`:** 4096. Output is structured JSON capped at 6 findings —
  no need for the 64K-128K ceiling.
* **Failure modes:** refusal (`stop_reason == "refusal"`) or unparseable
  output both fall back to a soft-pass `VlmAnalysis(score=80, findings=[],
  summary="Visual analysis returned an unparsed response...")` rather than
  crashing the pipeline. Operators see the failure in the trace via
  `vlm.parse_failed`.

**Consequence.** Cost per scan amortises over identical-product re-scans
because the system prompt + reference image cache reads (~0.1× input
price). Token telemetry is recorded on the session for the forensic trace,
so the operator can see when caches landed vs missed.

---

## D-0017 · `[Stage 3]` Scenario hint pins ELA only when present; real ELA always runs

**Context.** Stage 3 puts real ELA on the wire. But the demo's
Recent-Captures rail uploads SVG-rasterized PNGs — clean inputs that real
ELA would always score ~90+. That would collapse the rail's three sample
buttons into one verdict.

**Decision.** Real ELA **always** runs over the persisted bytes (normalized
when available, raw upload otherwise) and the analysis lands in the
session record + the trace log. The wire payload then branches: if
`session.scenario_hint` is set, the `ela_complete` event carries the
**stub** payload matching the hint (so the rail's verdicts stay
deterministic); without a hint, the real `elaScore` + `elaMap` ship.

This refines D-0010: the hint isn't a Stage-0/1-only knob, it's a demo
override that quietly retires per stage. The forensic trace shows what
*actually* happened either way — operators looking at the trace see real
ELA numbers under `ela.real`, while the wire delivers what the rail's
button advertised.

**Consequence.** Three users get what they each want: demo presenters
(rail produces the expected verdict), forensic operators (real numbers in
the trace), and production captures (hint is omitted → real wire).
Stage 5's consensus retirement is the last step that drops the hint
entirely.

---

## D-0016 · `[Stage 3]` ELA at Q=85, ×15 amplify, top-N component rects

**Context.** Many ELA implementations exist; we need one that's stable
across re-saves and produces interpretable rect output for our existing
canvas painter.

**Decision.**

- Re-encode at **JPEG Q=85** through Pillow — the de-facto reference
  quality for forensic ELA. Lower Q hides real edits; higher Q amplifies
  honest re-encoding noise.
- **Channel-max** the absolute difference (not channel-mean) so red-only
  or blue-only edits don't average out. Multiply by **×15** and clip to
  255 for human-readable maps.
- Score = `100 − (α · mean_error + β · peak_region_intensity)` with
  α=4.0 and β=0.18·255, hand-calibrated so a clean re-rasterised
  reference lands ~95 and a tampered region drops below 60.
- Rects via threshold-at-95th-percentile → morphological close → connected
  components → top **8** by area, intensity = mean(error_map ∩ component).
- Optional raster heatmap (PNG, OpenCV HOT colormap) — currently
  computed only on demand (`with_heatmap=True`); not yet plumbed to a
  contract endpoint. Reserved for a future client that wants pixel
  accuracy.

**Consequence.** Output is byte-compatible with `ElaPayload.elaMap`; the
canvas painter on the frontend renders it directly. Threshold and
weights live as named constants in `app/services/ela.py` for easy tuning.

---

## D-0015 · `[Stage 2]` Frontend rasterizes SVG before upload

**Context.** The Recent-Captures rail uploads the three reference SVGs. The
Stage-2 OpenCV pipeline can't decode SVG (`cv2.imdecode` is bitmap-only), and
adding a cairo/resvg dependency on the backend is heavy for a frontend-only
problem.

**Decision.** The backend's allowed media types are restricted to
`image/jpeg | image/png | image/webp`. The frontend's
`bitmapBlobFromUrl()` rasterizes SVGs through `<canvas>` at the backend's
target normalize width (1024px) using `createImageBitmap` where possible,
with an `Image`/object-URL fallback for older browsers. Bitmap URLs pass
through untouched.

**Consequence.** Backend stays lean — no cairo, no resvg. The frontend's
rasterized PNGs are byte-identical to what a phone-camera capture of the
same pack would produce, so the same OpenCV pipeline that handles real
captures handles the rail.

---

## D-0014 · `[Stage 2]` `/normalized` content swaps; the URL is the contract

**Context.** Stage 1 documented this seam (D-0008). Stage 2 makes it real:
the endpoint now serves the warped JPEG when the pipeline has run.

**Decision.** `GET /api/scan/{id}/normalized` returns
`session.normalized_path` (warped JPEG, written by
`normalize.normalize_capture`) when it exists, falling back to
`session.image_path` (raw upload) otherwise. The two-tier fallback means a
client racing the SSE stream — or a session created when the forensic
extras weren't installed — never sees a 404. `GET /capture` is unchanged
and always serves the original bytes for audit.

**Consequence.** The frontend `<img src=…>` rendered at stage 1 of the
reveal animates from an *original* capture and ends pointing at the
*warped* one — but only because the same URL's content evolved.
Cache-control is `private, max-age=300`; the frontend hits the URL once
per session.

---

## D-0013 · `[Stage 2]` Normalize service is a pure function, gracefully optional

**Context.** Stage 2 brings in heavy native deps (opencv-python-headless,
Pillow, numpy ≈ 70 MB). We don't want a partial install to take the API
down.

**Decision.** `app.services.normalize.normalize_capture(bytes) -> NormalizedCapture`
is a pure synchronous function — bytes in, bytes out — with no FastAPI or
session coupling. The pipeline imports it inside a `try/except` and sets a
module-level `_NORMALIZE_AVAILABLE` flag; if the extras aren't importable,
`_run_normalization` falls back to the Stage-1 echo + stub bbox while still
honouring the stage's wall-clock budget so the staged reveal keeps its
rhythm. Real work runs through `asyncio.to_thread()` so the event loop
stays responsive during the CPU-bound warp.

**Consequence.** `make install-core` still produces a bootable API for
contract testing. `make install` (the default, Stage 2+) brings the
forensic extras and the real warp kicks in. The contract is identical
either way — only the bbox values and the warped-image bytes differ.

---

## D-0012 · `[Stage 1]` Result page renders from pipeline events, not fixtures

**Context.** Previously the verdict screen pulled all its data from
`findScan(fixtureId)` and only used pipeline events for stage timing. With a
real backend driving the stream, the events themselves carry every payload
the screen needs — keeping the fixture lookup would be a second source of
truth begging to drift.

**Decision.** The result page narrows `pipeline.events` by stage discriminant
(`isNormalizationEvent` / `isElaEvent` / `isVlmEvent`) and feeds each
component its own event's payload. The consensus reveal renders from
`pipeline.result` (the `ScanResult` typed via `isConsensusEvent`). The mock
catalogue's `findScan()` is no longer imported anywhere in the result tree.

**Consequence.** Live and mock paths render identically — the only thing
that differs is who produces the events. Each stage degrades gracefully:
if `vlm_complete` hasn't arrived, the page stays on the ELA frame instead
of crashing on a missing fixture.

---

## D-0011 · `[Stage 1]` Auto-fallback to `/result` on recoverable stream error

**Context.** The native `EventSource` reconnects on transport blips, but a
soft failure mid-stream still leaves the user staring at a half-finished
verdict screen.

**Decision.** When the SSE consumer emits a `ScanErrorEvent` with
`recoverable: true`, `useScanPipeline` races
`GET /api/scan/{sessionId}/result` and surfaces the terminal `ScanResult` as
if the consensus event had landed normally. The error banner stays visible
so the user knows what happened. Unrecoverable errors close the connection
and leave the page in `status: "error"`.

**Consequence.** Demos survive flaky networks — once the backend has
written the result, the screen lands the verdict even if the stream dies.
Stage 6's hardening pass extends this to retries with backoff.

---

## D-0010 · `[Stage 1]` Scenario hint is a transport affordance, not a feature

**Context.** The frontend's Recent-Captures rail expects "Counterfeit ·
Digital" to reliably produce a FAIL verdict so a re-scan UX makes sense.
A pure session-id-hashed scenario would scramble the verdict.

**Decision.** `POST /api/scan` accepts an optional `scenario` form field —
one of `authentic_coartem` / `counterfeit_digital` / `counterfeit_print`.
When present, the pipeline plays that stub. Membership is validated; an
unknown value returns 422. The hint is documented in `pyproject.toml`, the
router docstring, and the scenario picker, all marked **Stage 0/1 only —
ignored from Stage 2**. The frontend's `ScenarioHint` type mirrors the
backend's `ALLOWED_SCENARIO_HINTS` set so they can never disagree.

**Consequence.** The seam stays honest — Stage 2's real ELA/VLM derive
scenario from the bytes and silently drop the field. The frontend's
"upload a real photo" path (no hint) already exercises the hash-based
round-robin, so we still get verdict variety even before Stage 2 lands.

---

## D-0009 · `[Stage 1]` Capture bytes streamed to disk + SHA-256 hashed on the wire

**Context.** Need to persist multipart uploads without pulling 12 MB into
memory, and we want a stable `captureHash` ready for Stage 5's verdict
cache.

**Decision.** The router reads the upload in 64 KB chunks with `aiofiles`,
incrementally hashing every chunk into a `hashlib.sha256()` and streaming
to `<AEGIS_UPLOAD_DIR>/<session_id>/capture.<ext>`. The size guard checks
total bytes after each chunk; on overflow the partial file is unlinked.
The session record holds `image_path`, `image_sha256`, `content_type`, and
`byte_size`. The hash is one of the keys Stage 5 will memoise verdicts by.

**Consequence.** Uploads scale to the 12 MB cap with a 64 KB resident
footprint and zero double-reads. The hash is already on every session in
production. Stage 5 only adds the cache lookup; the data is here.

---

## D-0008 · `[Stage 1]` `/normalized` is the contract URL — content swaps by stage

**Context.** `NormalizationPayload.normalizedImageUrl` should point at "the
perspective-corrected capture." At Stage 1 there is no real homography yet;
Stage 2 introduces it.

**Decision.** The endpoint URL — `GET /api/scan/{sessionId}/normalized` —
is the contract. At Stage 1 it returns the original upload bytes. At Stage
2 the OpenCV warp output is served behind the same URL. The frontend
never knows the difference. A second, distinct URL
`GET /api/scan/{sessionId}/capture` always serves the raw upload, for
audit/forensic re-analysis.

**Consequence.** The frontend's `<img src=…>` stays unchanged across the
Stage 2 cutover. Audit consumers always have access to the raw bytes via
the dedicated capture endpoint — we never overwrite the original.

---

## D-0007 · `[Stage 1]` Frontend talks to the backend via `NEXT_PUBLIC_API_BASE`

**Context.** Frontend (`:3000`) and backend (`:8000`) live on different
origins in dev. The MSW transport from Stage 0 was same-origin.

**Decision.** A `NEXT_PUBLIC_API_BASE` env var (defaulting to
`http://127.0.0.1:8000`) drives every backend call through
`src/lib/api/client.ts`. The contract paths returned by the backend
(`normalizedImageUrl: "/api/scan/.../normalized"`) are server-relative;
`apiUrl(path)` joins them onto the base when the frontend renders. CORS is
configured on the FastAPI side via `AEGIS_CORS_ORIGINS`.

**Consequence.** Production swap is one env var. Server-relative payload
URLs mean responses are environment-independent — staging vs prod is a
config detail, not a payload diff.

---

## D-0006 · `[Stage 0]` `ScanFixture` does not extend `ScanResult`

**Context.** The simulator's mock catalogue type `ScanFixture` and the wire
type `ScanResult` share most fields. The tempting move is `ScanFixture extends
ScanResult` so the simulator's consensus payload IS a fixture entry.

**Decision.** They stay as separate, sibling interfaces. `ScanFixture` keeps
its catalogue-only `id`, `label`, and `category`. `ScanResult` carries the
wire-canonical `sessionId`. The simulator's `fixtureToResult()` does the
mapping at emit time.

**Consequence.** No accidental leak of catalogue-only fields onto the wire;
the simulator's per-stage emit is a true contract round-trip; cost is one
small mapping function.

---

## D-0005 · `[Stage 0]` `sessionId` is the wire identifier

**Context.** The simulator originally used a fixture `id` as the scan
identifier on the wire because there was no upload step. With `POST /api/scan`
defined, every scan has its own server-minted session.

**Decision.** Per-stage payloads + `ScanResult` carry `sessionId`. The
catalogue's `ScanFixture.id` is unrelated and exists only inside the in-browser
simulator. The simulator mints a `sess_…` id and uses *that* in the events.

**Consequence.** Wire identifiers always come from the server. The catalogue
id is internal to the mock layer and never appears on the wire — which makes
the simulator's events byte-compatible with what FastAPI emits.

---

## D-0004 · `[Stage 0]` Backend deps split into core + `forensic` + `vlm`

**Context.** Stage 0 only needs an HTTP/SSE seam. Stages 2–4 add OpenCV, Pillow,
numpy, and the Anthropic SDK — heavy and network-dependent installs.

**Decision.** `pyproject.toml` declares core deps for Stage 0; the forensic
libraries are optional extras `[forensic]`; Claude is `[vlm]`. Each later
stage extends the install with `uv pip install -e ".[forensic,vlm,dev]"` when
it actually needs them.

**Consequence.** Stage 0 installs cleanly behind a flaky network. The extras
boundary doubles as a feature flag — `app.services.pipeline` falls back to
stubs when an extra isn't present.

---

## D-0003 · `[Stage 0]` `uv` for the Python toolchain, `sse-starlette` for SSE

**Context.** Need a Python package manager and a streaming response library.

**Decision.** Use [`uv`](https://github.com/astral-sh/uv) (already installed
on this host) for venv + dependency resolution; use
[`sse-starlette`](https://github.com/sysid/sse-starlette) for SSE inside
FastAPI. `Makefile` targets wrap the common operations so the human commands
stay short.

**Consequence.** Faster installs and reproducible resolution vs `pip` + raw
`venv`; `sse-starlette` gives us per-frame `event:` + `data:` framing,
configurable keep-alives, and clean shutdown semantics for free.

---

## D-0002 · `[Stage 0]` SSE, not WebSocket or polling

**Context.** Transport for the four staged pipeline events.

**Decision.** Server-Sent Events. One long-lived `GET`, ordered text frames,
native `EventSource` client, no library required. Documented in detail in
`contract/README.md §Transport`.

**Consequence.** Bidirectional traffic is impossible on this channel — fine,
the pipeline doesn't need any. Some proxies need a keep-alive ping; we send
`: ping` every 15 s (configurable via `AEGIS_SSE_KEEPALIVE_SECONDS`).

---

## D-0001 · `[Stage 0]` Four-way contract mirror, single source of truth

**Context.** Two languages (TypeScript + Python), two artefacts (frontend +
backend), and two audiences (humans + machines).

**Decision.** The forensic scan pipeline contract is expressed in four places
that move in lockstep:

1. **Spec** — `contract/README.md`
2. **JSON Schema** — `contract/scan-pipeline.schema.json`
3. **TypeScript** — `src/lib/contract/scan.ts`
4. **Pydantic** — `backend/app/schemas/scan.py`

A change lands in all four within the same commit. The hand-written JSON
Schema is the *design* artefact; the FastAPI app additionally publishes the
*as-built* OpenAPI 3.1 at `/api/openapi.json` — CI in a later stage will
assert the two agree.

**Consequence.** More files to touch on a shape change, but no drift at the
seam. The frontend's `useScanPipeline` and the backend's `pipeline.run`
already speak the same shape — Stage 1 only swaps the transport, not the
events.

---

## D-0000 · `[Stage 0]` FastAPI replaces Flask

**Context.** Original outline said Flask. The user revised to FastAPI before
Stage 0 started.

**Decision.** FastAPI. Async-native ASGI, Pydantic v2 request/response
modeling, free OpenAPI 3.1 + Swagger UI, first-class type hints, and ergonomic
streaming responses via `EventSourceResponse`.

**Consequence.** Python ≥ 3.12. Some libraries that assumed WSGI need ASGI
equivalents — only matters for Claude's official SDK (it's async-friendly so
this is fine).
