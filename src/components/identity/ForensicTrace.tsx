"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import type { VerificationEvent } from "@/lib/mock-api/ws-simulator";
import { formatTimeOfDay } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface ForensicTraceProps {
  events: VerificationEvent[];
  score: number;
  title?: string;
  className?: string;
}

const ENDPOINTS: Record<VerificationEvent["check"], string> = {
  squad_bvn: "POST /verify/squad/bvn",
  squad_nuban: "POST /verify/squad/nuban",
  cac: "POST /verify/cac",
  firs_tin: "POST /verify/firs/tin",
  pcn: "POST /verify/pcn/premise",
  google_places: "POST /verify/places/address",
  linkedin: "POST /verify/linkedin",
  work_email: "POST /verify/email/domain",
};

function statusCode(status: VerificationEvent["status"]) {
  if (status === "verified") return "200";
  if (status === "warning") return "200";
  if (status === "failed") return "422";
  if (status === "running") return "···";
  return "···";
}

function statusToken(status: VerificationEvent["status"]) {
  if (status === "verified") return "match=true";
  if (status === "warning") return "match=warn";
  if (status === "failed") return "match=false";
  if (status === "running") return "in_flight";
  return "queued";
}

export function ForensicTrace({ events, score, title, className }: ForensicTraceProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest event
  React.useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)]",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-base)]/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-[var(--verified)]" />
          <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            {title ?? "Forensic trace"}
          </p>
        </div>
        <MonoText size="sm" className="text-[var(--text-tertiary)]">
          {events.length} ops
        </MonoText>
      </div>
      <div ref={ref} className="max-h-[420px] flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {events.length === 0 && (
          <p className="text-mono-small text-[var(--text-tertiary)]">
            no_events · awaiting verification.start
          </p>
        )}
        {events.map((e, i) => {
          const c = statusCode(e.status);
          const tok = statusToken(e.status);
          const tint =
            e.status === "verified"
              ? "text-[var(--verified)]"
              : e.status === "failed"
                ? "text-[var(--risk)]"
                : e.status === "warning"
                  ? "text-[var(--pending)]"
                  : "text-[var(--info)]";
          return (
            <div key={i} className="flex items-baseline gap-2 text-mono-small">
              <span className="text-[var(--text-tertiary)] shrink-0">
                {formatTimeOfDay(e.timestamp)}
              </span>
              <span className="text-[var(--text-secondary)]">
                {ENDPOINTS[e.check]}
              </span>
              <span className={cn("ml-auto shrink-0", tint)}>
                → {c} ({e.latencyMs}ms)
              </span>
              <span className={cn("shrink-0", tint)}>{tok}</span>
            </div>
          );
        })}
        {events.length > 0 && (
          <div className="flex items-baseline gap-2 text-mono-small pt-1.5 mt-1.5 border-t border-[var(--border-hairline)]">
            <span className="text-[var(--text-tertiary)]">
              {formatTimeOfDay(events[events.length - 1].timestamp)}
            </span>
            <span className="text-[var(--accent)]">COMPUTE trust_score</span>
            <span className="ml-auto text-[var(--accent)]">
              score={score.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
