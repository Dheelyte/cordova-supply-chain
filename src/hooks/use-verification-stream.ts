"use client";

import * as React from "react";
import {
  startVerificationStream,
  type VerificationEvent,
  type VerificationPersona,
} from "@/lib/mock-api/ws-simulator";

export interface VerificationRow extends VerificationEvent {
  /** When the row last transitioned */
  updatedAt: string;
}

export interface VerificationStreamState {
  rows: Map<VerificationEvent["check"], VerificationRow>;
  /** Append-only log of all emitted events for the Forensic Trace panel */
  log: VerificationEvent[];
  score: number;
  status: "idle" | "running" | "complete";
}

export interface VerificationStreamControls {
  start: (persona: VerificationPersona) => void;
  reset: () => void;
}

export function useVerificationStream(): VerificationStreamState &
  VerificationStreamControls {
  const handleRef = React.useRef<{ stop: () => void } | null>(null);

  const [state, setState] = React.useState<VerificationStreamState>(() => ({
    rows: new Map(),
    log: [],
    score: 0,
    status: "idle",
  }));

  const reset = React.useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    setState({ rows: new Map(), log: [], score: 0, status: "idle" });
  }, []);

  const start = React.useCallback((persona: VerificationPersona) => {
    handleRef.current?.stop();
    setState({ rows: new Map(), log: [], score: 0, status: "running" });

    const handle = startVerificationStream(persona);
    handleRef.current = handle;

    handle.on((event) => {
      setState((s) => {
        const nextRows = new Map(s.rows);
        nextRows.set(event.check, { ...event, updatedAt: event.timestamp });
        const nextLog = [...s.log, event];
        let nextScore = 0;
        nextRows.forEach((row) => {
          if (row.status !== "running") nextScore += row.contribution;
        });
        return {
          ...s,
          rows: nextRows,
          log: nextLog,
          score: nextScore,
          status: "running",
        };
      });
    });

    handle.onComplete(() => {
      setState((s) => ({ ...s, status: "complete" }));
    });
  }, []);

  React.useEffect(() => () => handleRef.current?.stop(), []);

  return { ...state, start, reset };
}
