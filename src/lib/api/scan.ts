/**
 * Forensic-scan REST surface.
 *
 * Wraps the contract endpoints exposed by `backend/app/routers/scan.py`. The
 * SSE stream is consumed via `subscribeScanStream` in `./scan-stream`.
 */
import { apiFetch, apiUrl } from "./client";
import type { ScanAcceptResponse, ScanResult } from "@/lib/contract/scan";

/** Scenario hint values the Stage-0/1 stub backend accepts. */
export type ScenarioHint =
  | "authentic_coartem"
  | "counterfeit_digital"
  | "counterfeit_print";

export interface UploadScanInput {
  /** The captured pack image. Backend caps at 12 MB by default. */
  file: Blob;
  /** Filename surfaced to the backend (used to pick the saved extension). */
  filename: string;
  /** Optional batch context — passed straight through. */
  batchId?: string;
  /**
   * Optional product context for batch-aware scans. When present, the
   * backend skips the `identify` stage and uses this as ground truth.
   * When absent, Claude classifies the pack and emits an
   * `identify_complete` event before ELA runs.
   */
  productName?: string;
  /** Optional NAFDAC registration number from batch context. */
  nafdacRegNumber?: string;
  /**
   * Optional scenario hint honoured by the Stage-0/1 stub pipeline. Ignored
   * once the real ELA + Claude VLM stages are wired (build Stage 2+).
   */
  scenario?: ScenarioHint;
}

/** `POST /api/scan` — accept a captured image and mint a session id. */
export async function uploadScan(
  input: UploadScanInput
): Promise<ScanAcceptResponse> {
  const form = new FormData();
  form.append("image", input.file, input.filename);
  if (input.batchId) form.append("batch_id", input.batchId);
  if (input.productName) form.append("product_name", input.productName);
  if (input.nafdacRegNumber)
    form.append("nafdac_reg_number", input.nafdacRegNumber);
  if (input.scenario) form.append("scenario", input.scenario);

  return apiFetch<ScanAcceptResponse>("/api/scan", {
    method: "POST",
    body: form,
  });
}

/** `GET /api/scan/{id}/result` — terminal verdict, used as the stream fallback. */
export async function fetchScanResult(
  sessionId: string
): Promise<ScanResult> {
  return apiFetch<ScanResult>(
    `/api/scan/${encodeURIComponent(sessionId)}/result`
  );
}

/**
 * Helper for `<img>` `src` attributes when the contract returns a backend
 * path (e.g. `normalizedImageUrl`).
 */
export function captureImageUrl(sessionId: string): string {
  return apiUrl(`/api/scan/${encodeURIComponent(sessionId)}/capture`);
}

export function normalizedImageUrl(sessionId: string): string {
  return apiUrl(`/api/scan/${encodeURIComponent(sessionId)}/normalized`);
}
