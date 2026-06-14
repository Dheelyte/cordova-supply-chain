"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ChevronRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { formatNGN, formatTimeOfDay } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export type AlertSeverity = "critical" | "high" | "medium";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  reason: string;
  vendorId: string;
  vendorName: string;
  state: string;
  amount: number;
  timestamp: string;
  linkedScanId?: string;
  linkedBatchId?: string;
  linkedTxnId: string;
}

const SEV_META: Record<
  AlertSeverity,
  { label: string; bg: string; border: string; pill: string }
> = {
  critical: {
    label: "critical",
    bg: "var(--risk-soft)",
    border: "var(--risk-border)",
    pill: "var(--risk)",
  },
  high: {
    label: "high",
    bg: "var(--pending-soft)",
    border: "var(--pending-border)",
    pill: "var(--pending)",
  },
  medium: {
    label: "medium",
    bg: "var(--info-soft)",
    border: "var(--info-border)",
    pill: "var(--info)",
  },
};

export function AlertCard({
  alert,
  active,
  onSelect,
}: {
  alert: Alert;
  active?: boolean;
  onSelect: (id: string) => void;
}) {
  const m = SEV_META[alert.severity];
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(alert.id)}
      initial={false}
      animate={{ scale: active ? 1.0 : 1 }}
      className={cn(
        "group block w-full rounded-[10px] border px-3.5 py-3 text-left",
        "transition-colors duration-200"
      )}
      style={{
        borderColor: active ? "var(--accent)" : m.border,
        background: active ? "var(--accent-soft)" : m.bg + "40",
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-[3px] block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: m.pill }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-[3px] px-1 py-px font-mono-ui text-[10px] uppercase tracking-[0.06em]"
              style={{
                background: alert.severity === "critical" ? m.pill : `${m.pill}33`,
                color: alert.severity === "critical" ? "var(--bg-base)" : m.pill,
              }}
            >
              {m.label}
            </span>
            <p className="text-small font-medium text-[var(--text-primary)] truncate">
              {alert.title}
            </p>
          </div>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)] line-clamp-2">
            {alert.reason}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            <MapPin className="h-3 w-3" />
            <span>{alert.state}</span>
            <span>·</span>
            <span>{formatTimeOfDay(alert.timestamp)}</span>
            <span>·</span>
            <MonoText size="sm" className="text-[var(--risk)]">
              {formatNGN(alert.amount, { compact: true })}
            </MonoText>
          </div>
        </div>
        <ChevronRight
          className={cn(
            "mt-1 h-3.5 w-3.5 shrink-0 transition-colors",
            active
              ? "text-[var(--accent)]"
              : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
          )}
        />
      </div>
    </motion.button>
  );
}
