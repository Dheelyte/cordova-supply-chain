"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Factory,
  Truck,
  Store,
  User,
  ChevronDown,
  AlertTriangle,
  Fingerprint,
} from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { formatGPS, formatHash, formatISO } from "@/lib/utils/format";
import type { CustodyHop, CustodyAction } from "@/lib/mock-api/fixtures/batches";
import { useCustodyHover } from "@/stores/custody-hover";
import { cn } from "@/lib/utils/cn";

const ROLE_ICON: Record<CustodyHop["actorRole"], React.ComponentType<{ className?: string }>> = {
  manufacturer: Factory,
  wholesaler: Truck,
  retailer: Store,
  consumer: User,
};

const ACTION_LABEL: Record<CustodyAction, string> = {
  initialized: "Initialized batch",
  dispatched: "Dispatched shipment",
  in_transit: "In transit",
  received: "Received shipment",
  stored: "Placed in custody",
  split: "Split into sub-lot",
  dispensed: "Dispensed to consumer",
};

export function CustodyTimeline({ hops }: { hops: CustodyHop[] }) {
  return (
    <ol className="relative space-y-3">
      <span
        aria-hidden
        className="absolute left-[19px] top-[18px] bottom-[18px] w-px bg-[var(--border-hairline)]"
      />
      {hops.map((hop, i) => (
        <CustodyCard
          key={hop.hopId}
          hop={hop}
          index={i}
          isLast={i === hops.length - 1}
        />
      ))}
    </ol>
  );
}

function CustodyCard({
  hop,
  index,
  isLast,
}: {
  hop: CustodyHop;
  index: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hovered = useCustodyHover((s) => s.hoveredHopId);
  const setHovered = useCustodyHover((s) => s.setHovered);
  const isHovered = hovered === hop.hopId;
  const Icon = ROLE_ICON[hop.actorRole];

  return (
    <li
      onMouseEnter={() => setHovered(hop.hopId)}
      onMouseLeave={() => setHovered(null)}
      className="relative"
    >
      <article
        className={cn(
          "relative ml-10 rounded-[10px] border bg-[var(--bg-elevated)] transition-colors duration-200",
          hop.anomaly
            ? "border-[var(--risk-border)]"
            : isHovered
              ? "border-[var(--accent)]"
              : "border-[var(--border-hairline)]"
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute -left-[26px] top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[var(--bg-base)] transition-colors duration-200",
            hop.anomaly
              ? "border-[var(--risk)] text-[var(--risk)]"
              : isHovered
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-[var(--border-strong)] text-[var(--text-secondary)]"
          )}
        >
          <Icon className="h-3 w-3" />
        </span>

        <div className="px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-small font-semibold text-[var(--text-primary)]">
                  {ACTION_LABEL[hop.action]}
                </p>
                <Badge size="sm" status="neutral">
                  Hop {index + 1}
                </Badge>
                {hop.anomaly && (
                  <Badge size="sm" status="risk" dot>
                    Anomaly
                  </Badge>
                )}
                {isLast && (
                  <Badge size="sm" status="verified" dot>
                    Current holder
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                {hop.actorName} ·{" "}
                <span className="uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                  {hop.actorRole}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]"
              aria-label="View evidence"
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  expanded && "rotate-180"
                )}
              />
            </button>
          </div>

          {/* Inline metadata */}
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <Cell label="Timestamp">
              <MonoText size="sm">{formatISO(hop.timestamp)}</MonoText>
            </Cell>
            <Cell label="GPS">
              <MonoText size="sm">{formatGPS(hop.lat, hop.lng)}</MonoText>
            </Cell>
            <Cell label="City">
              <span className="text-small text-[var(--text-primary)]">{hop.city}</span>
            </Cell>
            <Cell label="Units">
              <MonoText size="sm">{hop.units?.toLocaleString() ?? "—"}</MonoText>
            </Cell>
          </dl>

          {hop.notes && (
            <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
              {hop.notes}
            </p>
          )}

          {/* Anomaly inline */}
          {hop.anomaly && (
            <div className="mt-3 flex items-start gap-2 rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk-soft)]/40 px-3 py-2">
              <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--risk)]" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--risk)]">
                  {hop.anomaly.kind.replace(/_/g, " ")}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
                  {hop.anomaly.detail}
                </p>
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className="overflow-hidden border-t border-[var(--border-hairline)]"
              >
                <div className="space-y-2 py-3">
                  <Cell label="Device fingerprint">
                    <MonoText
                      size="sm"
                      className="block text-[var(--text-secondary)]"
                    >
                      {hop.deviceFingerprint}
                    </MonoText>
                  </Cell>
                  <Cell label="Server signature">
                    <div className="flex items-center gap-1.5">
                      <Fingerprint className="h-3 w-3 text-[var(--text-tertiary)]" />
                      <MonoText size="sm">{formatHash(hop.signature, 12, 8)}</MonoText>
                    </div>
                  </Cell>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </article>
    </li>
  );
}

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
