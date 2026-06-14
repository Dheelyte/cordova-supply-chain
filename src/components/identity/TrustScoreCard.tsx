"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MonoText } from "@/components/ui/MonoText";
import { cn } from "@/lib/utils/cn";

export type Tier = "suspended" | "limited" | "verified";

function tierFromScore(score: number): Tier {
  if (score < 60) return "suspended";
  if (score < 85) return "limited";
  return "verified";
}

const TIER_META: Record<Tier, { label: string; status: "risk" | "pending" | "verified" }> = {
  suspended: { label: "Suspended", status: "risk" },
  limited: { label: "Limited tier", status: "pending" },
  verified: { label: "Verified tier", status: "verified" },
};

export interface TrustScoreCardProps {
  score: number;
  status: "idle" | "running" | "complete";
  /** Caption shown above the score */
  caption?: string;
}

export function TrustScoreCard({ score, status, caption }: TrustScoreCardProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 18 });
  const display = useTransform(spring, (v) => v.toFixed(1));

  React.useEffect(() => {
    motionValue.set(score);
  }, [motionValue, score]);

  const tier = tierFromScore(score);
  const meta = TIER_META[tier];

  // Gauge fill (0–100 → 0–1) with the same spring source
  const fill = useTransform(spring, (v) => Math.max(0, Math.min(100, v)) / 100);
  const dasharray = useTransform(fill, (f) => `${f * 282.74} 282.74`);
  const stroke = useTransform(spring, (v) =>
    v < 60 ? "var(--risk)" : v < 85 ? "var(--pending)" : "var(--verified)"
  );

  return (
    <Card emphasized className="relative overflow-hidden">
      <div className="flex items-start justify-between pb-3">
        <div>
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            {caption ?? "Trust Score"}
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            {status === "idle"
              ? "awaiting verification"
              : status === "running"
                ? "computing…"
                : "verification complete"}
          </p>
        </div>
        <Badge status={meta.status} dot>
          {meta.label}
        </Badge>
      </div>

      <div className="flex items-center gap-6 border-t border-[var(--border-hairline)] pt-5">
        {/* Radial gauge */}
        <div className="relative h-[120px] w-[120px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--border-hairline)"
              strokeWidth="6"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              style={{
                strokeDasharray: dasharray,
                stroke: stroke,
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span className="font-mono-ui text-[28px] font-semibold tracking-[-0.01em]">
              {display}
            </motion.span>
            <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              / 100
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <ScoreLegend />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <ThresholdTile label="< 60" sub="Suspended" color="risk" active={tier === "suspended"} />
            <ThresholdTile label="60 – 84" sub="Limited" color="pending" active={tier === "limited"} />
            <ThresholdTile label="≥ 85" sub="Verified" color="verified" active={tier === "verified"} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ScoreLegend() {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
      <span>Live composite</span>
      <MonoText size="sm" className="text-[var(--text-secondary)]">
        bvn · nuban · cac · firs · pcn · places · linkedin · email
      </MonoText>
    </div>
  );
}

function ThresholdTile({
  label,
  sub,
  color,
  active,
}: {
  label: string;
  sub: string;
  color: "risk" | "pending" | "verified";
  active: boolean;
}) {
  const colorVar =
    color === "risk"
      ? "var(--risk)"
      : color === "pending"
        ? "var(--pending)"
        : "var(--verified)";
  return (
    <div
      className={cn(
        "rounded-[6px] border px-2 py-1.5 transition-colors duration-200",
        active
          ? "border-[var(--border-strong)] bg-[var(--bg-overlay)]"
          : "border-[var(--border-hairline)] bg-[var(--bg-inset)]"
      )}
    >
      <p
        className="font-mono-ui text-[12px] font-semibold"
        style={{ color: active ? colorVar : "var(--text-tertiary)" }}
      >
        {label}
      </p>
      <p className="text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
        {sub}
      </p>
    </div>
  );
}
