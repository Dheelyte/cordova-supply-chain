"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/dashboard/Sparkline";

export interface CounterTileProps {
  label: string;
  amount: number;
  /** "verified" or "risk" — picks color */
  tone: "verified" | "risk";
  /** Caption beneath the number */
  caption: string;
  /** Sparkline series */
  series: number[];
  /** Optional badge */
  badge?: string;
}

function formatLargeNGN(v: number): string {
  // 1,234,567,890 → ₦1,234,567,890
  return `₦${Math.round(v).toLocaleString("en-NG")}`;
}

export function CounterTile({
  label,
  amount,
  tone,
  caption,
  series,
  badge,
}: CounterTileProps) {
  const tint = tone === "verified" ? "var(--verified)" : "var(--risk)";
  const soft = tone === "verified" ? "var(--verified-soft)" : "var(--risk-soft)";
  const border = tone === "verified" ? "var(--verified-border)" : "var(--risk-border)";

  // Spring the number up from 0 once on mount
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 22 });
  const display = useTransform(spring, (v) => formatLargeNGN(v));
  React.useEffect(() => {
    mv.set(amount);
  }, [amount, mv]);

  return (
    <Card
      emphasized
      padded
      className="relative overflow-hidden"
      style={{ borderColor: border }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at top right, ${soft}, transparent 55%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between pb-2">
          <p
            className="text-caption uppercase tracking-[0.06em]"
            style={{ color: tint }}
          >
            {label}
          </p>
          {badge && (
            <Badge size="sm" status={tone === "verified" ? "verified" : "risk"} dot>
              {badge}
            </Badge>
          )}
        </div>
        <motion.span
          className="block font-mono-ui font-semibold tracking-[-0.02em]"
          style={{
            fontSize: 42,
            lineHeight: 1.05,
            color: tint,
          }}
        >
          {display}
        </motion.span>
        <p className="mt-2 text-small text-[var(--text-secondary)]">{caption}</p>
        <div className="mt-3">
          <Sparkline data={series} color={tint} height={40} unit="NGN" />
        </div>
      </div>
    </Card>
  );
}
