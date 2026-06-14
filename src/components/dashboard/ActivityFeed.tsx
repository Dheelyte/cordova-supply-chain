"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Truck,
  Store,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ScanLine,
  Banknote,
} from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { formatTimeOfDay, formatNGN } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type ActivityKind =
  | "batch_initialized"
  | "custody_handoff"
  | "scan_pass"
  | "scan_fail"
  | "settlement"
  | "alert";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  amount?: number;
  batchId?: string;
}

const ICON: Record<
  ActivityKind,
  { icon: React.ComponentType<{ className?: string }>; tint: string; soft: string; label: string }
> = {
  batch_initialized: {
    icon: Package,
    tint: "var(--accent)",
    soft: "var(--accent-soft)",
    label: "Batch",
  },
  custody_handoff: {
    icon: Truck,
    tint: "var(--info)",
    soft: "var(--info-soft)",
    label: "Custody",
  },
  scan_pass: {
    icon: CheckCircle2,
    tint: "var(--verified)",
    soft: "var(--verified-soft)",
    label: "Scan",
  },
  scan_fail: {
    icon: XCircle,
    tint: "var(--risk)",
    soft: "var(--risk-soft)",
    label: "Scan",
  },
  settlement: {
    icon: Banknote,
    tint: "var(--verified)",
    soft: "var(--verified-soft)",
    label: "Settlement",
  },
  alert: {
    icon: AlertTriangle,
    tint: "var(--pending)",
    soft: "var(--pending-soft)",
    label: "Alert",
  },
};

const SEED: ActivityItem[] = [
  {
    id: "act_1",
    kind: "batch_initialized",
    title: "Batch initialized",
    detail: "Coartem 80/480mg · 12,000 units · NAFDAC 04-1284",
    actor: "Lagos Pharma Ltd",
    timestamp: new Date(Date.now() - 6 * 60_000).toISOString(),
    batchId: "a04f9c8b…b6f0e87",
  },
  {
    id: "act_2",
    kind: "scan_pass",
    title: "Forensic PASS",
    detail: "Coartem · ELA 96.2 · VLM 94.4 · consensus 95.4",
    actor: "HealthPlus · VI",
    timestamp: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: "act_3",
    kind: "settlement",
    title: "Settlement released",
    detail: "Squad · TXN_8a4f9c12c102",
    actor: "HealthPlus → Idumota Health",
    timestamp: new Date(Date.now() - 28 * 60_000).toISOString(),
    amount: 2_400_000,
  },
  {
    id: "act_4",
    kind: "custody_handoff",
    title: "Custody hop",
    detail: "MediBio → Idumota Health · 24,000 units",
    actor: "Augmentin 625mg",
    timestamp: new Date(Date.now() - 49 * 60_000).toISOString(),
  },
  {
    id: "act_5",
    kind: "scan_fail",
    title: "Forensic FAIL · counterfeit blocked",
    detail: "Coartem · ELA flagged expiry-date tamper · consensus 41.2",
    actor: "Quick Pharma Wholesale",
    timestamp: new Date(Date.now() - 67 * 60_000).toISOString(),
  },
  {
    id: "act_6",
    kind: "alert",
    title: "Impossible-travel anomaly",
    detail: "Lagos → Kano in 8m · min feasible 95m",
    actor: "Batch · 7fa2e1d4…2e",
    timestamp: new Date(Date.now() - 92 * 60_000).toISOString(),
    batchId: "7fa2e1d4…2e",
  },
];

const APPEND_KINDS: ActivityKind[] = [
  "scan_pass",
  "custody_handoff",
  "settlement",
  "scan_pass",
  "alert",
];

function makeAppend(kind: ActivityKind, n: number): ActivityItem {
  const id = `act_live_${n}`;
  const now = new Date().toISOString();
  switch (kind) {
    case "scan_pass":
      return {
        id,
        kind,
        title: "Forensic PASS",
        detail: `Augmentin · ELA ${(92 + Math.random() * 4).toFixed(1)} · VLM ${(90 + Math.random() * 4).toFixed(1)} · consensus ${(92 + Math.random() * 4).toFixed(1)}`,
        actor: "Medplus · Wuse II",
        timestamp: now,
      };
    case "custody_handoff":
      return {
        id,
        kind,
        title: "Custody hop",
        detail: "Lagos Pharma → HealthPlus · 4,200 units",
        actor: "Lonart 80/480mg",
        timestamp: now,
      };
    case "settlement":
      return {
        id,
        kind,
        title: "Settlement released",
        detail: `Squad · TXN_${Math.random().toString(16).slice(2, 12)}`,
        actor: "ChemCare → MediBio",
        timestamp: now,
        amount: Math.round((800 + Math.random() * 2200) * 1000),
      };
    case "alert":
      return {
        id,
        kind,
        title: "Risk score elevated",
        detail: "Vendor handoff frequency above 4σ baseline",
        actor: "Network anomaly",
        timestamp: now,
      };
    default:
      return {
        id,
        kind: "batch_initialized",
        title: "Batch initialized",
        detail: "MediBio · 14,000 units",
        actor: "MediBio Industries",
        timestamp: now,
      };
  }
}

export interface ActivityFeedProps {
  /** Append a new fake event every N ms; 0 disables */
  appendIntervalMs?: number;
  className?: string;
  /** Limit number of rows displayed */
  limit?: number;
}

export function ActivityFeed({
  appendIntervalMs = 20_000,
  className,
  limit = 8,
}: ActivityFeedProps) {
  const [items, setItems] = React.useState<ActivityItem[]>(SEED);
  const counterRef = React.useRef(0);

  React.useEffect(() => {
    if (!appendIntervalMs) return;
    const t = setInterval(() => {
      counterRef.current += 1;
      const kind = APPEND_KINDS[counterRef.current % APPEND_KINDS.length];
      setItems((prev) =>
        [makeAppend(kind, counterRef.current), ...prev].slice(0, limit)
      );
    }, appendIntervalMs);
    return () => clearInterval(t);
  }, [appendIntervalMs, limit]);

  return (
    <Card className={cn("flex flex-col", className)} padded>
      <div className="flex items-start justify-between pb-3">
        <div>
          <CardTitle>Network activity</CardTitle>
          <CardDescription>Live append. Scan, custody, settlement.</CardDescription>
        </div>
        <Badge status="accent" dot>
          Streaming
        </Badge>
      </div>
      <ul className="flex flex-col divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)] pt-1">
        <AnimatePresence initial={false}>
          {items.slice(0, limit).map((it) => {
            const meta = ICON[it.kind];
            const Icon = meta.icon;
            return (
              <motion.li
                key={it.id}
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                className="flex items-start gap-3 py-2.5"
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border"
                  style={{
                    borderColor: meta.tint,
                    background: meta.soft,
                    color: meta.tint,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-small font-medium text-[var(--text-primary)] truncate">
                      {it.title}
                    </p>
                    <MonoText size="sm" className="text-[var(--text-tertiary)] shrink-0">
                      {formatTimeOfDay(it.timestamp)}
                    </MonoText>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)] truncate">
                    {it.detail}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                      {it.actor}
                    </span>
                    {it.amount && (
                      <MonoText size="sm" className="text-[var(--verified)]">
                        {formatNGN(it.amount, { compact: true })}
                      </MonoText>
                    )}
                    {it.batchId && (
                      <MonoText size="sm" className="text-[var(--text-tertiary)]">
                        {it.batchId}
                      </MonoText>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
