/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  AEGIS — FORENSIC SCAN PIPELINE CONTRACT                              ║
 * ║  Single source of truth for the scan pipeline wire format.           ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * This file is the canonical TypeScript definition of the contract between
 * the Next.js frontend and the FastAPI forensic backend. The backend mirrors
 * these shapes in `backend/app/schemas/scan.py` (Pydantic), and the
 * human-readable spec lives in `/contract/README.md` with a machine-readable
 * JSON Schema in `/contract/scan-pipeline.schema.json`.
 *
 * RULE: if a shape changes here, it changes in all four places, in lockstep.
 *
 * Transport: the pipeline streams over Server-Sent Events (SSE). Each SSE
 * message carries `event: <stage>` and `data: <JSON of ScanPipelineEvent>`.
 * See `/contract/README.md` §Transport for the rationale.
 */

// ─────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────

/** Final forensic verdict. >=85 PASS · 60–84 REVIEW · <60 FAIL. */
export type Verdict = "PASS" | "REVIEW" | "FAIL";

/** Severity of a single VLM print-discrepancy finding. */
export type VlmSeverity = "info" | "warning" | "critical";

/**
 * A single ELA hot-spot, in normalised (0..1) coordinates relative to the
 * normalised capture. `intensity` (0..1) drives the yellow→red gradient.
 */
export interface ElaRect {
  x: number;
  y: number;
  w: number;
  h: number;
  intensity: number;
}

/**
 * A single visual discrepancy the VLM stage found against the NAFDAC
 * reference. `x`/`y` are normalised (0..1) marker positions on the capture.
 */
export interface VlmFinding {
  /** 1-indexed marker number, stable within a single scan. */
  id: number;
  x: number;
  y: number;
  title: string;
  detail: string;
  severity: VlmSeverity;
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline stages
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pipeline stages.
 *
 * `identify_complete` is conditionally emitted — it only fires when the
 * scan was accepted without batch-supplied product context (see D-0028).
 * The other four stages always fire, in the order below.
 */
export type ScanPipelineStage =
  | "normalization_complete"
  | "identify_complete"
  | "ela_complete"
  | "vlm_complete"
  | "consensus";

export const SCAN_PIPELINE_STAGE_ORDER: readonly ScanPipelineStage[] = [
  "normalization_complete",
  "identify_complete",
  "ela_complete",
  "vlm_complete",
  "consensus",
] as const;

// ─────────────────────────────────────────────────────────────────────────
// Stage payloads
// ─────────────────────────────────────────────────────────────────────────

/**
 * `normalization_complete` — the CNN/OpenCV stage detected the label,
 * computed the homography, and warped the capture flat.
 */
export interface NormalizationPayload {
  sessionId: string;
  productName: string;
  /** Detected label bounding box, normalised [x, y, w, h]. */
  bbox: [number, number, number, number];
  /** URL to the perspective-corrected capture. */
  normalizedImageUrl: string;
}

/**
 * `identify_complete` — Claude vision classified the pack and returned a
 * product name + optional NAFDAC reg number. Only fires for sessions
 * without batch-supplied product context.
 *
 * `referenceKey` is the backend's catalogue key (e.g. "coartem",
 * "augmentin") when the identified product matches one of the references
 * the VLM can compare against. `null` means no reference available — the
 * downstream VLM stage degrades to identification-only (vlmScore=null on
 * the wire, vlmFindings empty), and consensus drops VLM's weight to zero.
 */
export interface IdentifyPayload {
  sessionId: string;
  productName: string;
  /** NAFDAC registration number Claude read off the pack, if present. */
  nafdacRegNumber: string | null;
  /** 0..1 self-reported identification confidence. */
  confidence: number;
  /**
   * Backend catalogue key for the matched reference image. `null` when the
   * identified product has no reference on file.
   */
  referenceKey: string | null;
}

/**
 * `ela_complete` — Error Level Analysis produced a digital-integrity score
 * and a set of hot-spot rectangles.
 */
export interface ElaPayload {
  sessionId: string;
  productName: string;
  /** 0..100 — higher is cleaner. */
  elaScore: number;
  elaMap: ElaRect[];
  /** Optional raster heatmap, if the backend chooses to ship one. */
  heatmapImageUrl?: string;
}

/**
 * `vlm_complete` — the Claude vision stage compared the normalised capture
 * against the NAFDAC golden reference and returned print-integrity findings.
 */
export interface VlmPayload {
  sessionId: string;
  productName: string;
  /**
   * 0..100 — higher is cleaner. `null` when no NAFDAC reference was
   * available for the identified product (consumer scanned a pack we
   * don't have a golden image for); in that case `vlmFindings` is `[]`
   * and consensus drops VLM's weight to zero.
   */
  vlmScore: number | null;
  vlmFindings: VlmFinding[];
  /** URL to the NAFDAC reference image used for the comparison. `null` when no reference. */
  referenceImage: string | null;
  /** NAFDAC registration number the reference was keyed by. `null` when no reference. */
  referenceRegNumber: string | null;
  /** True when a real reference comparison ran; false for identify-only. */
  referenceAvailable: boolean;
}

/**
 * `consensus` — the terminal payload. The weighted verdict plus every score
 * and artefact the verdict screen needs to render the final card. This is
 * the canonical wire shape; the mock catalogue's `ScanFixture` is a superset
 * of this used only by the in-browser simulator.
 */
export interface ScanResult {
  /** The scan session id minted by `POST /api/scan`. */
  sessionId: string;
  productName: string;
  /** Batch the scan was performed in support of, if any. */
  batchId?: string;
  /** ISO 8601 capture timestamp. */
  capturedAt: string;
  elaScore: number;
  /** `null` when no NAFDAC reference was available — see VlmPayload. */
  vlmScore: number | null;
  /** Weighted average of ELA + VLM (ELA-only when vlmScore is null). */
  consensusScore: number;
  verdict: Verdict;
  elaMap: ElaRect[];
  vlmFindings: VlmFinding[];
  /** One-line summary shown above the verdict card. */
  summary: string;
  /** `null` when no NAFDAC reference was available. */
  referenceImage: string | null;
  /** True when the VLM compared against a real reference. */
  referenceAvailable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Pipeline events (discriminated union on `stage`)
// ─────────────────────────────────────────────────────────────────────────

interface BasePipelineEvent {
  /** ISO 8601 timestamp the stage completed. */
  timestamp: string;
  /** Wall-clock milliseconds this stage took. */
  latencyMs: number;
}

export interface NormalizationCompleteEvent extends BasePipelineEvent {
  stage: "normalization_complete";
  payload: NormalizationPayload;
}

export interface IdentifyCompleteEvent extends BasePipelineEvent {
  stage: "identify_complete";
  payload: IdentifyPayload;
}

export interface ElaCompleteEvent extends BasePipelineEvent {
  stage: "ela_complete";
  payload: ElaPayload;
}

export interface VlmCompleteEvent extends BasePipelineEvent {
  stage: "vlm_complete";
  payload: VlmPayload;
}

export interface ConsensusEvent extends BasePipelineEvent {
  stage: "consensus";
  payload: ScanResult;
}

/** Any event the pipeline SSE stream can emit. */
export type ScanPipelineEvent =
  | NormalizationCompleteEvent
  | IdentifyCompleteEvent
  | ElaCompleteEvent
  | VlmCompleteEvent
  | ConsensusEvent;

/**
 * Emitted on the SSE stream's `error` event channel when a stage fails. The
 * client should fall back to `GET /api/scan/:id/result` when `recoverable`.
 */
export interface ScanErrorEvent {
  stage: "error";
  timestamp: string;
  /** The stage that was in flight when the failure occurred. */
  failedStage: ScanPipelineStage | "upload";
  message: string;
  recoverable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// HTTP DTOs
// ─────────────────────────────────────────────────────────────────────────

/** Response to `POST /api/scan` (multipart capture upload). */
export interface ScanAcceptResponse {
  sessionId: string;
  /** ISO 8601 timestamp the capture was accepted. */
  acceptedAt: string;
}

/** Response to `GET /api/health`. */
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  env: string;
  time: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Narrowing helpers
// ─────────────────────────────────────────────────────────────────────────

export function isConsensusEvent(
  e: ScanPipelineEvent
): e is ConsensusEvent {
  return e.stage === "consensus";
}

export function isElaEvent(e: ScanPipelineEvent): e is ElaCompleteEvent {
  return e.stage === "ela_complete";
}

export function isVlmEvent(e: ScanPipelineEvent): e is VlmCompleteEvent {
  return e.stage === "vlm_complete";
}

export function isNormalizationEvent(
  e: ScanPipelineEvent
): e is NormalizationCompleteEvent {
  return e.stage === "normalization_complete";
}

export function isIdentifyEvent(
  e: ScanPipelineEvent
): e is IdentifyCompleteEvent {
  return e.stage === "identify_complete";
}
