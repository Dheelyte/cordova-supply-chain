import { request } from "./client";
import type {
  InitiateBatchRequest,
  InitiateBatchResponse,
  LedgerHistoryResponse,
  ScanProductRequest,
  ScanProductResponse,
} from "./types";

/** `POST /ledger/initiate` — register a new batch + mint its `binary_id`. */
export function initiateBatch(
  input: InitiateBatchRequest
): Promise<InitiateBatchResponse> {
  return request<InitiateBatchResponse>("/ledger/initiate", {
    method: "POST",
    body: input,
  });
}

/**
 * `POST /ledger/scan` — log a custody scan against an existing batch.
 * Authenticated calls are recorded as `official`, anonymous as `community`.
 */
export function scanProduct(
  input: ScanProductRequest
): Promise<ScanProductResponse> {
  return request<ScanProductResponse>("/ledger/scan", {
    method: "POST",
    body: input,
    // The endpoint is `optional` — we always attach the token if present,
    // but it works without one (anonymous community scan).
    unauthenticated: false,
  });
}

/** `GET /ledger/history/{binary_id}` — full provenance + scans for a batch. */
export function getHistory(binaryId: string): Promise<LedgerHistoryResponse> {
  return request<LedgerHistoryResponse>(
    `/ledger/history/${encodeURIComponent(binaryId)}`,
    { unauthenticated: true }
  );
}
