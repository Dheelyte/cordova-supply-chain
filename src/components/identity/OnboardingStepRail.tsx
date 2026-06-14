"use client";

import * as React from "react";
import { Check, X, Loader2, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StepStatus = "pending" | "active" | "complete" | "failed" | "skipped";

export interface StepDef {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
}

export interface OnboardingStepRailProps {
  steps: StepDef[];
  /** Click any *completed* step to revisit it */
  onSelectStep?: (id: string) => void;
}

const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  pending: <span className="block h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]" />,
  active: <Loader2 className="h-3 w-3 animate-spin text-[var(--accent)]" />,
  complete: <Check className="h-3 w-3 text-[var(--verified)]" />,
  failed: <X className="h-3 w-3 text-[var(--risk)]" />,
  skipped: <MinusCircle className="h-3 w-3 text-[var(--text-tertiary)]" />,
};

export function OnboardingStepRail({ steps, onSelectStep }: OnboardingStepRailProps) {
  return (
    <ol className="relative space-y-1">
      <span
        aria-hidden
        className="absolute left-[15px] top-[14px] bottom-[14px] w-px bg-[var(--border-hairline)]"
      />
      {steps.map((step, i) => {
        const interactive =
          (step.status === "complete" || step.status === "failed") && !!onSelectStep;
        return (
          <li key={step.id} className="relative">
            <button
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onSelectStep?.(step.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-[6px] px-2 py-2.5 text-left",
                "transition-colors duration-150",
                interactive
                  ? "hover:bg-[var(--bg-elevated)] cursor-pointer"
                  : "cursor-default",
                step.status === "active" && "bg-[var(--accent-soft)]"
              )}
            >
              <span
                className={cn(
                  "relative z-10 mt-[2px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border",
                  step.status === "active"
                    ? "border-[var(--accent)] bg-[var(--bg-base)]"
                    : step.status === "complete"
                      ? "border-[var(--verified-border)] bg-[var(--verified-soft)]"
                      : step.status === "failed"
                        ? "border-[var(--risk-border)] bg-[var(--risk-soft)]"
                        : "border-[var(--border-hairline)] bg-[var(--bg-base)]"
                )}
              >
                {STATUS_ICON[step.status]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                    Step {i + 1}
                  </span>
                  {step.status === "active" && (
                    <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--accent)]">
                      Active
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "block text-small font-medium",
                    step.status === "pending"
                      ? "text-[var(--text-tertiary)]"
                      : "text-[var(--text-primary)]"
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-[11px] text-[var(--text-tertiary)]">
                  {step.description}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
