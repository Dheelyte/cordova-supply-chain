"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import type { VlmFinding } from "@/lib/mock-api/fixtures/scans";
import { cn } from "@/lib/utils/cn";

export interface VLMComparisonProps {
  capturedSrc: string;
  referenceSrc: string;
  productName: string;
  findings: VlmFinding[];
  score: number;
}

export function VLMComparison({
  capturedSrc,
  referenceSrc,
  productName,
  findings,
  score,
}: VLMComparisonProps) {
  const [hoveredId, setHoveredId] = React.useState<number | null>(null);
  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
      {/* Captured vs reference */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PanelImage
          title="Capture"
          src={capturedSrc}
          subtitle={productName}
          findings={findings}
          hoveredId={hoveredId}
          markersVisible
        />
        <PanelImage
          title="NAFDAC reference"
          src={referenceSrc}
          subtitle="golden standard"
          findings={[]}
          hoveredId={null}
        />
      </div>

      {/* Findings list */}
      <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-3">
        <div className="flex items-center justify-between pb-3">
          <div>
            <p className="text-caption uppercase text-[var(--text-tertiary)]">
              Forensic findings
            </p>
            <p className="text-small font-semibold text-[var(--text-primary)]">
              VLM print integrity{" "}
              <MonoText
                size="sm"
                className={cn(
                  score >= 85
                    ? "text-[var(--verified)]"
                    : score >= 60
                      ? "text-[var(--pending)]"
                      : "text-[var(--risk)]"
                )}
              >
                {score.toFixed(1)}
              </MonoText>
            </p>
          </div>
          <Badge
            status={
              findings.length === 0
                ? "verified"
                : findings.some((f) => f.severity === "critical")
                  ? "risk"
                  : "pending"
            }
            size="sm"
            dot
          >
            {findings.length} {findings.length === 1 ? "finding" : "findings"}
          </Badge>
        </div>
        <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
          {findings.length === 0 && (
            <li className="flex items-start gap-2 rounded-[6px] border border-[var(--verified-border)] bg-[var(--verified-soft)]/30 px-3 py-2">
              <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--verified)]" />
              <p className="text-small text-[var(--text-secondary)]">
                No print discrepancies. Capture matches the NAFDAC reference
                within tolerance.
              </p>
            </li>
          )}
          {findings.map((f) => (
            <motion.li
              key={f.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: 0.2 * f.id,
                ease: [0.2, 0, 0, 1],
              }}
              onMouseEnter={() => setHoveredId(f.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                "flex items-start gap-2.5 rounded-[6px] border px-3 py-2 transition-colors duration-200 cursor-default",
                hoveredId === f.id
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]/30"
                  : f.severity === "critical"
                    ? "border-[var(--risk-border)] bg-[var(--risk-soft)]/20"
                    : "border-[var(--pending-border)] bg-[var(--pending-soft)]/20"
              )}
            >
              <Marker n={f.id} active={hoveredId === f.id} severity={f.severity} />
              <div className="min-w-0">
                <p className="text-small font-medium text-[var(--text-primary)]">
                  {f.title}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  {f.detail}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PanelImage({
  title,
  src,
  subtitle,
  findings,
  hoveredId,
  markersVisible,
}: {
  title: string;
  src: string;
  subtitle: string;
  findings: VlmFinding[];
  hoveredId: number | null;
  markersVisible?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)]">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-1.5">
        <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {title}
        </p>
        <p className="text-[11px] text-[var(--text-tertiary)]">{subtitle}</p>
      </div>
      <div className="relative aspect-[10/7]">
        {/* Image */}
        <img
          src={src}
          alt={`${title} · ${subtitle}`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Discrepancy markers (only on the capture side) */}
        {markersVisible &&
          findings.map((f) => (
            <motion.span
              key={f.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.25,
                delay: 0.2 * f.id + 0.15,
                ease: [0.2, 0, 0, 1],
              }}
              style={{
                left: `${f.x * 100}%`,
                top: `${f.y * 100}%`,
              }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2",
                "flex h-5 w-5 items-center justify-center rounded-full",
                "border-2 font-mono-ui text-[11px] font-bold",
                "shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
                hoveredId === f.id
                  ? "border-[var(--accent)] bg-[var(--bg-base)] text-[var(--accent)]"
                  : f.severity === "critical"
                    ? "border-[var(--risk)] bg-[var(--risk)] text-white"
                    : "border-[var(--pending)] bg-[var(--pending)] text-[var(--bg-base)]"
              )}
            >
              {f.id}
            </motion.span>
          ))}
      </div>
    </div>
  );
}

function Marker({
  n,
  active,
  severity,
}: {
  n: number;
  active: boolean;
  severity: VlmFinding["severity"];
}) {
  return (
    <span
      className={cn(
        "mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 font-mono-ui text-[11px] font-bold",
        active
          ? "border-[var(--accent)] bg-[var(--bg-base)] text-[var(--accent)]"
          : severity === "critical"
            ? "border-[var(--risk)] bg-[var(--risk)] text-white"
            : "border-[var(--pending)] bg-[var(--pending)] text-[var(--bg-base)]"
      )}
    >
      {n}
    </span>
  );
}
