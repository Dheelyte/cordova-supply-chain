"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export interface ConfidenceGaugeProps {
  score: number; // 0–100
  size?: number; // pixels
  /** "live" springs to the value; "static" snaps */
  mode?: "live" | "static";
  /** Show the numeric score inside */
  showScore?: boolean;
  /** Stroke thickness */
  strokeWidth?: number;
}

export function ConfidenceGauge({
  score,
  size = 48,
  mode = "live",
  showScore = true,
  strokeWidth = 4,
}: ConfidenceGaugeProps) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 18 });
  const displayed = useTransform(spring, (v) => v.toFixed(score >= 100 ? 0 : 1));
  const stroke = useTransform(spring, (v) =>
    v < 60 ? "var(--risk)" : v < 85 ? "var(--pending)" : "var(--verified)"
  );

  React.useEffect(() => {
    if (mode === "static") {
      mv.set(score);
      // also nudge the spring to settle immediately
      spring.set(score);
    } else {
      mv.set(score);
    }
  }, [score, mode, mv, spring]);

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dasharray = useTransform(spring, (v) => {
    const f = Math.max(0, Math.min(100, v)) / 100;
    return `${f * c} ${c}`;
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-hairline)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{ stroke, strokeDasharray: dasharray }}
        />
      </svg>
      {showScore && (
        <motion.span
          className="absolute inset-0 flex items-center justify-center font-mono-ui font-semibold tracking-[-0.005em] text-[var(--text-primary)]"
          style={{ fontSize: Math.max(10, size * 0.28) }}
        >
          {displayed}
        </motion.span>
      )}
    </div>
  );
}
