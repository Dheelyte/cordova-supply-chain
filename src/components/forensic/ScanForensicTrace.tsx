"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ChevronUp, ChevronDown } from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import { formatTimeOfDay } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export interface TraceLine {
  ts: string;
  msg: string;
  /** Optional level for color */
  level?: "info" | "ok" | "warn" | "fail";
}

export interface ScanForensicTraceProps {
  lines: TraceLine[];
  className?: string;
  defaultExpanded?: boolean;
}

export function ScanForensicTrace({
  lines,
  className,
  defaultExpanded = false,
}: ScanForensicTraceProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length, expanded]);

  return (
    <div
      className={cn(
        "rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] overflow-hidden",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 bg-[var(--bg-base)]/60 px-3 py-2 text-left hover:bg-[var(--bg-overlay)]"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 text-[var(--verified)]" />
          <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-secondary)]">
            Forensic trace
          </p>
          <MonoText size="sm" className="text-[var(--text-tertiary)]">
            {lines.length} ops
          </MonoText>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={ref}
              className="max-h-[200px] overflow-y-auto px-3 py-2 space-y-0.5"
            >
              {lines.length === 0 && (
                <p className="text-mono-small text-[var(--text-tertiary)]">
                  awaiting pipeline start…
                </p>
              )}
              {lines.map((l, i) => {
                const tint =
                  l.level === "ok"
                    ? "text-[var(--verified)]"
                    : l.level === "warn"
                      ? "text-[var(--pending)]"
                      : l.level === "fail"
                        ? "text-[var(--risk)]"
                        : "text-[var(--text-secondary)]";
                return (
                  <div
                    key={i}
                    className="flex items-baseline gap-2 text-mono-small leading-relaxed"
                  >
                    <span className="text-[var(--text-tertiary)] shrink-0">
                      {formatTimeOfDay(l.ts)}
                    </span>
                    <span className={cn("flex-1 truncate", tint)}>{l.msg}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
