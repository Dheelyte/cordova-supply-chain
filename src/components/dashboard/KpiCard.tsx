"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MonoText } from "@/components/ui/MonoText";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils/cn";

export interface KpiCardProps {
  label: string;
  value: string;
  /** Delta vs previous period as a fraction (0.12 = +12%) */
  delta?: number;
  /** "+ is good" (default) or "+ is bad" (for fraud, etc.) */
  positivePolarity?: "up_is_good" | "up_is_bad" | "neutral";
  /** Caption shown beneath the delta */
  comparison?: string;
  /** Sparkline values */
  series?: number[];
  /** Tint: "accent" | "verified" | "pending" | "risk" */
  tint?: "accent" | "verified" | "pending" | "risk";
  unit?: string;
}

const TINT_COLOR: Record<NonNullable<KpiCardProps["tint"]>, string> = {
  accent: "var(--accent)",
  verified: "var(--verified)",
  pending: "var(--pending)",
  risk: "var(--risk)",
};

export function KpiCard({
  label,
  value,
  delta,
  positivePolarity = "up_is_good",
  comparison,
  series,
  tint = "accent",
  unit,
}: KpiCardProps) {
  const isUp = (delta ?? 0) >= 0;
  const isGood =
    positivePolarity === "neutral"
      ? null
      : positivePolarity === "up_is_good"
        ? isUp
        : !isUp;

  return (
    <Card className="flex flex-col gap-3" padded>
      <div className="flex items-start justify-between">
        <p className="text-caption uppercase text-[var(--text-tertiary)]">
          {label}
        </p>
        {typeof delta === "number" && (
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-[4px] px-1.5 py-0.5 font-mono-ui text-[11px] font-medium",
              isGood === null
                ? "bg-[var(--bg-inset)] text-[var(--text-secondary)]"
                : isGood
                  ? "bg-[var(--verified-soft)] text-[var(--verified)]"
                  : "bg-[var(--risk-soft)] text-[var(--risk)]"
            )}
          >
            {isUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {(Math.abs(delta) * 100).toFixed(1)}%
          </div>
        )}
      </div>

      <MonoText size="lg" className="block text-[28px] leading-none tracking-[-0.02em]">
        {value}
      </MonoText>

      {comparison && (
        <p className="text-[11px] text-[var(--text-tertiary)]">{comparison}</p>
      )}

      {series && series.length > 1 && (
        <div className="-mx-1">
          <Sparkline data={series} color={TINT_COLOR[tint]} unit={unit} />
        </div>
      )}
    </Card>
  );
}
