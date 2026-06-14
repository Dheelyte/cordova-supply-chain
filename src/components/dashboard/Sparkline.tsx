"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

export interface SparklineProps {
  data: number[];
  /** Color token — defaults to the accent */
  color?: string;
  height?: number;
  /** Tooltip label suffix, e.g. "₦" or "units" */
  unit?: string;
}

export function Sparkline({
  data,
  color = "var(--accent)",
  height = 36,
  unit,
}: SparklineProps) {
  const id = React.useId().replace(/[:]/g, "");
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: "var(--bg-overlay)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 11,
            padding: "4px 6px",
          }}
          labelStyle={{ display: "none" }}
          itemStyle={{ color: "var(--text-primary)" }}
          formatter={(v) => [
            `${typeof v === "number" ? v.toLocaleString() : String(v ?? "")}${unit ? ` ${unit}` : ""}`,
            "",
          ]}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
