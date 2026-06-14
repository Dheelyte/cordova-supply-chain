/**
 * SSE consumer for the forensic scan pipeline.
 *
 * Build stage 1 — replaces the in-browser `startScanPipeline` simulator with
 * a real `EventSource` against the FastAPI backend. The handle shape is the
 * same as the simulator's so `useScanPipeline` is the only consumer that
 * had to change.
 */
import { apiUrl } from "./client";
import type {
  ScanErrorEvent,
  ScanPipelineEvent,
  ScanPipelineStage,
} from "@/lib/contract/scan";

export interface ScanStreamHandle {
  on: (h: (event: ScanPipelineEvent) => void) => () => void;
  onError: (h: (event: ScanErrorEvent) => void) => () => void;
  onComplete: (h: () => void) => () => void;
  stop: () => void;
}

const STAGES: readonly ScanPipelineStage[] = [
  "normalization_complete",
  "identify_complete",
  "ela_complete",
  "vlm_complete",
  "consensus",
] as const;

/**
 * Subscribe to `GET /api/scan/{sessionId}/stream` and translate raw SSE
 * messages into typed `ScanPipelineEvent`s.
 *
 * The browser's native `EventSource` auto-reconnects on transport blips. We
 * close the connection ourselves after the terminal `consensus` event so the
 * server's clean disconnect doesn't trigger a retry.
 */
export function subscribeScanStream(sessionId: string): ScanStreamHandle {
  const url = apiUrl(`/api/scan/${encodeURIComponent(sessionId)}/stream`);
  const source = new EventSource(url, { withCredentials: false });

  const handlers = new Set<(e: ScanPipelineEvent) => void>();
  const errorHandlers = new Set<(e: ScanErrorEvent) => void>();
  const completeHandlers = new Set<() => void>();

  let closed = false;

  const onMessage = (stage: ScanPipelineStage) => (raw: MessageEvent) => {
    if (closed) return;
    try {
      const event = JSON.parse(raw.data) as ScanPipelineEvent;
      if (event.stage !== stage) {
        // Defensive — should never happen with sse-starlette emitting one
        // event-line per frame, but if discriminants ever disagree we want
        // to know.
        emitError({
          stage: "error",
          timestamp: new Date().toISOString(),
          failedStage: stage,
          message: `Discriminant mismatch: frame=${stage} payload=${event.stage}`,
          recoverable: false,
        });
        return;
      }
      handlers.forEach((h) => h(event));
      if (event.stage === "consensus") {
        completeHandlers.forEach((h) => h());
        close();
      }
    } catch (err) {
      emitError({
        stage: "error",
        timestamp: new Date().toISOString(),
        failedStage: stage,
        message: `Malformed payload: ${(err as Error).message}`,
        recoverable: true,
      });
    }
  };

  STAGES.forEach((stage) =>
    source.addEventListener(stage, onMessage(stage) as EventListener)
  );

  // The backend emits an `error` channel on stage failure (see the contract's
  // ScanErrorEvent shape). The native `error` event fires on transport drops
  // — we treat both uniformly.
  source.addEventListener("error", ((raw: MessageEvent) => {
    if (closed) return;
    let parsed: ScanErrorEvent | null = null;
    if (typeof raw.data === "string" && raw.data.length > 0) {
      try {
        parsed = JSON.parse(raw.data) as ScanErrorEvent;
      } catch {
        parsed = null;
      }
    }
    emitError(
      parsed ?? {
        stage: "error",
        timestamp: new Date().toISOString(),
        failedStage: "upload",
        message: "Stream transport error",
        recoverable: true,
      }
    );
  }) as EventListener);

  function emitError(event: ScanErrorEvent): void {
    errorHandlers.forEach((h) => h(event));
    if (!event.recoverable) close();
  }

  function close(): void {
    if (closed) return;
    closed = true;
    source.close();
  }

  return {
    on(h) {
      handlers.add(h);
      return () => handlers.delete(h);
    },
    onError(h) {
      errorHandlers.add(h);
      return () => errorHandlers.delete(h);
    },
    onComplete(h) {
      completeHandlers.add(h);
      return () => completeHandlers.delete(h);
    },
    stop: close,
  };
}
