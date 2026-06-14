"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  Landmark,
  Building2,
  FileText,
  ShieldCheck,
  MapPin,
  ExternalLink,
  AtSign,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  VerificationCheck,
  CheckStatus,
} from "@/lib/mock-api/ws-simulator";
import { cn } from "@/lib/utils/cn";

const META: Record<
  VerificationCheck,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  squad_bvn: {
    label: "Bank Verification Number",
    description: "Squad BVN resolution",
    icon: Fingerprint,
  },
  squad_nuban: {
    label: "NUBAN Account Holder",
    description: "Squad NUBAN resolve · name match",
    icon: Landmark,
  },
  cac: {
    label: "Corporate Affairs Commission",
    description: "Active RC number registry",
    icon: Building2,
  },
  firs_tin: {
    label: "FIRS Tax Identification",
    description: "TIN linked to CAC registration",
    icon: FileText,
  },
  pcn: {
    label: "PCN Premise License",
    description: "Pharmacists Council premise registry",
    icon: ShieldCheck,
  },
  google_places: {
    label: "Premise verification",
    description: "Google Places address classification",
    icon: MapPin,
  },
  linkedin: {
    label: "Digital footprint",
    description: "LinkedIn company verification",
    icon: ExternalLink,
  },
  work_email: {
    label: "Work email domain",
    description: "Corporate MX + DMARC + age",
    icon: AtSign,
  },
};

const STATUS_META: Record<
  CheckStatus,
  { label: string; status: "neutral" | "info" | "verified" | "risk" | "pending" }
> = {
  queued: { label: "Queued", status: "neutral" },
  running: { label: "Verifying", status: "info" },
  verified: { label: "Verified", status: "verified" },
  failed: { label: "Failed", status: "risk" },
  warning: { label: "Warning", status: "pending" },
};

export interface VerificationRowProps {
  check: VerificationCheck;
  status: CheckStatus;
  evidence?: string;
  detail?: string;
  contribution?: number;
  latencyMs?: number;
  onReverify?: () => void;
}

export function VerificationRow({
  check,
  status,
  evidence,
  detail,
  contribution,
  latencyMs,
  onReverify,
}: VerificationRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const meta = META[check];
  const sMeta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "rounded-[10px] border bg-[var(--bg-elevated)] transition-colors duration-200",
        status === "failed"
          ? "border-[var(--risk-border)]"
          : status === "warning"
            ? "border-[var(--pending-border)]"
            : status === "verified"
              ? "border-[var(--verified-border)]"
              : status === "running"
                ? "border-[var(--info-border)]"
                : "border-[var(--border-hairline)]"
      )}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border",
            status === "verified"
              ? "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]"
              : status === "failed"
                ? "border-[var(--risk-border)] bg-[var(--risk-soft)] text-[var(--risk)]"
                : status === "warning"
                  ? "border-[var(--pending-border)] bg-[var(--pending-soft)] text-[var(--pending)]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-tertiary)]"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-small font-medium text-[var(--text-primary)] truncate">
              {meta.label}
            </p>
            <span className="text-[11px] text-[var(--text-tertiary)] truncate">
              {meta.description}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <StatusIcon status={status} />
            <MonoText
              size="sm"
              className={cn(
                "truncate",
                status === "failed"
                  ? "text-[var(--risk)]"
                  : status === "warning"
                    ? "text-[var(--pending)]"
                    : status === "verified"
                      ? "text-[var(--verified)]"
                      : "text-[var(--text-secondary)]"
              )}
            >
              {evidence ?? (status === "running" ? "resolving…" : "—")}
            </MonoText>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {typeof contribution === "number" && status === "verified" && (
            <MonoText size="sm" className="text-[var(--text-tertiary)]">
              +{contribution}
            </MonoText>
          )}
          {typeof latencyMs === "number" && (
            <MonoText size="sm" className="text-[var(--text-tertiary)]">
              {latencyMs}ms
            </MonoText>
          )}
          <Badge status={sMeta.status} size="sm" dot>
            {sMeta.label}
          </Badge>
          {status === "running" && (
            <motion.div
              className="absolute left-0 h-[2px] bg-[var(--info)]"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.2, ease: [0.2, 0, 0, 1] }}
              style={{ position: "relative" }}
            />
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-secondary)]"
            aria-label="View details"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="overflow-hidden border-t border-[var(--border-hairline)] bg-[var(--bg-inset)]"
          >
            <div className="space-y-2 px-3.5 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Raw evidence
              </p>
              <MonoText
                size="sm"
                className="block whitespace-pre-wrap text-[var(--text-secondary)]"
              >
                {evidence ?? "(no payload yet)"}
              </MonoText>
              {detail && (
                <>
                  <p className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Detail
                  </p>
                  <p className="text-small text-[var(--text-secondary)]">{detail}</p>
                </>
              )}
              {(status === "failed" || status === "warning") && onReverify && (
                <Button size="sm" variant="ghost" onClick={onReverify}>
                  Re-verify
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "verified")
    return <CheckCircle2 className="h-3 w-3 text-[var(--verified)]" />;
  if (status === "failed") return <XCircle className="h-3 w-3 text-[var(--risk)]" />;
  if (status === "warning")
    return <AlertTriangle className="h-3 w-3 text-[var(--pending)]" />;
  if (status === "running")
    return <Loader2 className="h-3 w-3 animate-spin text-[var(--info)]" />;
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)]"
    />
  );
}
