"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ledger as squadLedger, SquadCoError } from "@/lib/squadco";
import { useAuth } from "@/stores/auth";

/**
 * Best-effort browser geolocation. Resolves to `null` if the user denies,
 * the API is unavailable, or the fix doesn't arrive within 4s — never
 * rejects, since location is optional for the SquadCo scan endpoint and
 * blocking the ledger log on geolocation would punish slow GPS-cold devices.
 */
function getGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: 4000, maximumAge: 60_000 }
    );
  });
}

/** Stable per-browser fingerprint for anonymous community scans. */
function sessionFingerprint(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "aegis.scan.fingerprint";
  let fp = window.localStorage.getItem(KEY);
  if (!fp) {
    fp = `fp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, fp);
  }
  return fp;
}

interface LogScanState {
  status: "idle" | "logging" | "logged" | "error" | "skipped";
  scanType: "official" | "community" | null;
  error: string | null;
}

/**
 * Logs a forensic scan to the SquadCo ledger when the forensic verdict
 * lands. Authenticated calls become `official` journey steps; anonymous
 * calls become `community` scans. Skips entirely when the batch id isn't
 * a server-minted binary_id (64 hex chars) — see MISMATCHES.md #1.
 */
export function useLedgerScan(binaryIdMaybe: string | null | undefined) {
  const hasSession = useAuth((s) => !!s.session);
  const qc = useQueryClient();
  const [state, setState] = React.useState<LogScanState>({
    status: "idle",
    scanType: null,
    error: null,
  });
  const firedRef = React.useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (binary_id: string) => {
      const geo = await getGeolocation();
      return squadLedger.scanProduct({
        binary_id,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
        // Required by the backend for anon scans; harmless when authed.
        session_fingerprint: hasSession ? undefined : sessionFingerprint(),
      });
    },
  });

  const trigger = React.useCallback(
    (binaryId: string) => {
      if (!/^[0-9a-f]{64}$/i.test(binaryId)) {
        setState({ status: "skipped", scanType: null, error: null });
        return;
      }
      if (firedRef.current === binaryId) return; // already logged this binary
      firedRef.current = binaryId;
      setState({ status: "logging", scanType: null, error: null });
      mutation
        .mutateAsync(binaryId)
        .then((r) => {
          setState({
            status: "logged",
            scanType: r.scan_type,
            error: null,
          });
          // Refresh the batch's history so /batches/[id] reflects the new step.
          qc.invalidateQueries({
            queryKey: ["squad", "ledger", "history", binaryId],
          });
        })
        .catch((e: unknown) => {
          setState({
            status: "error",
            scanType: null,
            error:
              e instanceof SquadCoError
                ? e.message
                : e instanceof Error
                  ? e.message
                  : "Ledger scan failed.",
          });
        });
    },
    [mutation, qc]
  );

  // Auto-fire when the binary id becomes available.
  React.useEffect(() => {
    if (binaryIdMaybe) trigger(binaryIdMaybe);
  }, [binaryIdMaybe, trigger]);

  return state;
}
