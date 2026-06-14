"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import { cn } from "@/lib/utils/cn";

export interface TransferStep {
  id: string;
  label: string;
  detail?: string;
}

export interface TransferStateMachineProps {
  /** Step labels (ordered) */
  steps: TransferStep[];
  /** Returns the squad reference (and other commit args) when complete */
  onComplete: (squadRef: string) => void;
  /** ms delay between each step transition; default 600 */
  stepDurationMs?: number;
}

export function TransferStateMachine({
  steps,
  onComplete,
  stepDurationMs = 420,
}: TransferStateMachineProps) {
  const [done, setDone] = React.useState(0);
  const ref = React.useRef<string>("");
  if (!ref.current) {
    ref.current = `SQD_TRF_${Math.random().toString(16).slice(2, 8)}c${Math.random()
      .toString(16)
      .slice(2, 5)}`;
  }

  React.useEffect(() => {
    const interval = stepDurationMs;
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i += 1;
      setDone(i);
      if (i >= steps.length) {
        setTimeout(() => onComplete(ref.current), 280);
        return;
      }
      setTimeout(tick, interval);
    };
    const start = setTimeout(tick, interval);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
    // We intentionally start once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const status =
          i < done ? "done" : i === done ? "running" : "pending";
        return (
          <motion.div
            key={s.id}
            initial={{ opacity: 0.4 }}
            animate={{
              opacity: status === "pending" ? 0.5 : 1,
            }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2.5 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2"
          >
            <span
              className={cn(
                "mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center"
              )}
            >
              {status === "done" && (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--verified)]" />
              )}
              {status === "running" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
              )}
              {status === "pending" && (
                <Circle className="h-3 w-3 text-[var(--text-tertiary)]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-small",
                  status === "done"
                    ? "text-[var(--verified)]"
                    : status === "running"
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-tertiary)]"
                )}
              >
                {s.label}
              </p>
              {s.detail && (
                <MonoText size="sm" className="text-[var(--text-tertiary)]">
                  {s.detail}
                </MonoText>
              )}
            </div>
            <AnimatePresence>
              {status === "done" && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] uppercase tracking-[0.04em] text-[var(--verified)] shrink-0"
                >
                  ok
                </motion.span>
              )}
              {status === "running" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] uppercase tracking-[0.04em] text-[var(--accent)] shrink-0"
                >
                  in flight
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      <p className="px-3 pt-1 text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        Squad reference{" "}
        <MonoText size="sm" className="text-[var(--text-secondary)]">
          {ref.current}
        </MonoText>
      </p>
    </div>
  );
}
