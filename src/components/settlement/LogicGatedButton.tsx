"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export type GateVerdict = "PASS" | "REVIEW" | "FAIL";

export interface Gate {
  name: string;
  verdict: GateVerdict;
  /** Why the gate is failing (only relevant when not PASS) */
  reason?: string;
}

export interface LogicGatedButtonProps {
  gates: Gate[];
  label?: string;
  onClick: () => void;
}

const ICON: Record<GateVerdict, React.ComponentType<{ className?: string }>> = {
  PASS: CheckCircle2,
  REVIEW: AlertTriangle,
  FAIL: XCircle,
};

function gateColor(v: GateVerdict) {
  return v === "PASS"
    ? "var(--verified)"
    : v === "REVIEW"
      ? "var(--pending)"
      : "var(--risk)";
}

export function LogicGatedButton({
  gates,
  label = "Execute transfer",
  onClick,
}: LogicGatedButtonProps) {
  const failing = gates.filter((g) => g.verdict !== "PASS");
  const blocked = failing.length > 0;
  const [tipOpen, setTipOpen] = React.useState(false);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {gates.map((g) => {
          const Icon = ICON[g.verdict];
          return (
            <span
              key={g.name}
              className="inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-1 text-[11px]"
              style={{
                borderColor: gateColor(g.verdict),
                background:
                  g.verdict === "PASS"
                    ? "var(--verified-soft)"
                    : g.verdict === "REVIEW"
                      ? "var(--pending-soft)"
                      : "var(--risk-soft)",
                color: gateColor(g.verdict),
              }}
            >
              <Icon className="h-3 w-3" />
              <span className="font-mono-ui uppercase tracking-[0.04em]">
                {g.name}: {g.verdict}
              </span>
            </span>
          );
        })}
      </div>

      <div
        className="relative inline-flex w-full"
        onMouseEnter={() => blocked && setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
        onFocus={() => blocked && setTipOpen(true)}
        onBlur={() => setTipOpen(false)}
      >
        <Button
          variant={blocked ? "secondary" : "primary"}
          onClick={() => !blocked && onClick()}
          disabled={blocked}
          leadingIcon={blocked ? <Lock /> : <CheckCircle2 />}
          className="w-full justify-center"
        >
          {blocked ? `Settlement gated — ${failing.length} gate${failing.length > 1 ? "s" : ""} failing` : label}
        </Button>

        {tipOpen && blocked && (
          <div
            className={cn(
              "absolute left-0 right-0 bottom-full z-30 mb-2 rounded-[10px] border border-[var(--risk-border)] bg-[var(--bg-overlay)] p-3",
              "shadow-[0_12px_32px_-8px_rgba(0,0,0,0.55)]"
            )}
            role="tooltip"
          >
            <p className="text-caption uppercase text-[var(--risk)] pb-1.5">
              Cannot release · gate failure
            </p>
            <ul className="space-y-2">
              {failing.map((g) => {
                const Icon = ICON[g.verdict];
                return (
                  <li key={g.name} className="flex items-start gap-2">
                    <span
                      style={{ color: gateColor(g.verdict) }}
                      className="mt-[2px] shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-[11px] font-medium uppercase tracking-[0.04em]"
                        style={{ color: gateColor(g.verdict) }}
                      >
                        {g.name} · {g.verdict}
                      </p>
                      {g.reason && (
                        <p className="text-[12px] text-[var(--text-secondary)]">
                          {g.reason}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
