"use client";

import * as React from "react";
import {
  subscribeScanStream,
  type ScanStreamHandle,
} from "@/lib/api/scan-stream";
import { fetchScanResult } from "@/lib/api/scan";
import {
  isConsensusEvent,
  type ScanErrorEvent,
  type ScanPipelineEvent,
  type ScanPipelineStage,
  type ScanResult,
} from "@/lib/contract/scan";

export interface ScanPipelineState {
  stage: ScanPipelineStage | "idle";
  events: ScanPipelineEvent[];
  /** The terminal `ScanResult`, populated once the consensus event lands. */
  result: ScanResult | null;
  status: "idle" | "running" | "complete" | "error";
  /** Last error from the stream; null while clean. */
  error: ScanErrorEvent | null;
}

const INITIAL: ScanPipelineState = {
  stage: "idle",
  events: [],
  result: null,
  status: "idle",
  error: null,
};

/**
 * Subscribe to the forensic pipeline for a backend-minted scan session.
 *
 * Build stage 1 — this hook now talks to the real FastAPI backend over SSE.
 * Pass the `sessionId` returned by `POST /api/scan` (see `uploadScan` in
 * `@/lib/api/scan`). Pass `null` to stay idle.
 *
 * On a recoverable stream error the hook automatically falls back to
 * `GET /api/scan/{id}/result` so the verdict screen can still render.
 */
export function useScanPipeline(sessionId: string | null): ScanPipelineState {
  const [state, setState] = React.useState<ScanPipelineState>(INITIAL);

  React.useEffect(() => {
    if (!sessionId) {
      setState(INITIAL);
      return;
    }

    setState({
      stage: "idle",
      events: [],
      result: null,
      status: "running",
      error: null,
    });

    let cancelled = false;
    let handle: ScanStreamHandle | null = null;

    handle = subscribeScanStream(sessionId);

    handle.on((event) => {
      if (cancelled) return;
      setState((s) => ({
        ...s,
        stage: event.stage,
        events: [...s.events, event],
        result: isConsensusEvent(event) ? event.payload : s.result,
        status: "running",
        error: null,
      }));
    });

    handle.onComplete(() => {
      if (cancelled) return;
      setState((s) => ({ ...s, status: "complete" }));
    });

    handle.onError((errorEvent) => {
      if (cancelled) return;
      setState((s) => ({ ...s, status: "error", error: errorEvent }));
      if (errorEvent.recoverable) {
        // Race the result endpoint as a fallback so the verdict still lands.
        fetchScanResult(sessionId)
          .then((result) => {
            if (cancelled) return;
            setState((s) => ({
              ...s,
              result,
              status: "complete",
              stage: "consensus",
            }));
          })
          .catch(() => {
            /* Already in `error` state; nothing more to do. */
          });
      }
    });

    return () => {
      cancelled = true;
      handle?.stop();
    };
  }, [sessionId]);

  return state;
}
