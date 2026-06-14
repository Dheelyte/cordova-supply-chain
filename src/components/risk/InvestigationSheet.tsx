"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShieldAlert,
  ExternalLink,
  Banknote,
  ScanLine,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { ConfidenceGauge } from "@/components/forensic/ConfidenceGauge";
import type { Alert } from "./AlertCard";
import { findUser } from "@/lib/mock-api/fixtures/users";
import { findScan } from "@/lib/mock-api/fixtures/scans";
import { findBatch } from "@/lib/mock-api/fixtures/batches";
import { useWallet } from "@/stores/wallet";
import { useSuspendedVendors } from "@/stores/suspended-vendors";
import {
  formatNGN,
  formatTimeOfDay,
  formatHash,
} from "@/lib/utils/format";
import Link from "next/link";

const SEVERITY_BAR: Record<Alert["severity"], string> = {
  critical: "var(--risk)",
  high: "var(--pending)",
  medium: "var(--info)",
};

export interface InvestigationSheetProps {
  alert: Alert | null;
  onClose: () => void;
  onRequestSuspend: (
    vendorId: string,
    vendorName: string,
    pendingFreezes: number,
    defaultReason: string
  ) => void;
}

export function InvestigationSheet({
  alert,
  onClose,
  onRequestSuspend,
}: InvestigationSheetProps) {
  const ledger = useWallet((s) => s.ledger);
  const isSuspended = useSuspendedVendors((s) => s.isSuspended);

  if (!alert) return null;

  const vendor = findUser(alert.vendorId);
  const scan = alert.linkedScanId ? findScan(alert.linkedScanId) : undefined;
  const batch = alert.linkedBatchId ? findBatch(alert.linkedBatchId) : undefined;
  const pendingFreezes = ledger.filter(
    (t) => t.toUserId === alert.vendorId && t.type === "pending"
  ).length;
  const allVendorTxns = ledger.filter(
    (t) => t.toUserId === alert.vendorId
  ).slice(0, 6);
  const suspended = isSuspended(alert.vendorId);

  return (
    <AnimatePresence>
      <motion.aside
        key="sheet"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border-strong)] bg-[var(--bg-overlay)] shadow-[-12px_0_32px_-8px_rgba(0,0,0,0.55)]"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border-hairline)] px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
              style={{ background: SEVERITY_BAR[alert.severity] }}
            />
            <div className="min-w-0">
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Investigation · {alert.severity}
              </p>
              <h2 className="text-h3 mt-0.5 truncate">{alert.title}</h2>
              <MonoText size="sm" className="text-[var(--text-tertiary)]">
                {alert.id}
              </MonoText>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Reason */}
          <section>
            <p className="text-caption uppercase text-[var(--text-tertiary)] mb-1">
              Reason
            </p>
            <p className="text-small text-[var(--text-secondary)]">
              {alert.reason}
            </p>
          </section>

          {/* Vendor */}
          <section>
            <p className="text-caption uppercase text-[var(--text-tertiary)] mb-2">
              Implicated vendor
            </p>
            <div
              className="rounded-[10px] border px-3 py-3"
              style={{
                borderColor: suspended ? "var(--risk-border)" : "var(--border-hairline)",
                background: suspended ? "var(--risk-soft)" : "var(--bg-inset)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-small font-semibold text-[var(--text-primary)] truncate">
                      {alert.vendorName}
                    </p>
                    {suspended ? (
                      <Badge status="risk" size="sm" dot>
                        suspended
                      </Badge>
                    ) : (
                      <Badge status="pending" size="sm" dot>
                        under review
                      </Badge>
                    )}
                  </div>
                  <MonoText size="sm" className="text-[var(--text-tertiary)]">
                    {alert.vendorId}
                  </MonoText>
                  {vendor && (
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                      {vendor.city}, {vendor.state} · {vendor.bankName} · trust{" "}
                      <MonoText size="sm" className="text-[var(--risk)]">
                        {vendor.trustScore.toFixed(1)}
                      </MonoText>
                    </p>
                  )}
                </div>
                {!suspended && (
                  <Button
                    variant="danger"
                    size="sm"
                    leadingIcon={<ShieldAlert />}
                    onClick={() =>
                      onRequestSuspend(
                        alert.vendorId,
                        alert.vendorName,
                        pendingFreezes,
                        alert.reason
                      )
                    }
                  >
                    Suspend vendor
                  </Button>
                )}
              </div>
            </div>
          </section>

          {/* Forensic evidence */}
          {scan && (
            <section>
              <p className="text-caption uppercase text-[var(--text-tertiary)] mb-2">
                Forensic evidence
              </p>
              <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
                <div className="flex items-center gap-3">
                  <ConfidenceGauge score={scan.consensusScore} size={56} mode="static" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-3 w-3 text-[var(--text-tertiary)]" />
                      <p className="text-small font-medium text-[var(--text-primary)] truncate">
                        {scan.productName}
                      </p>
                      <Badge
                        status={
                          scan.verdict === "PASS"
                            ? "verified"
                            : scan.verdict === "REVIEW"
                              ? "pending"
                              : "risk"
                        }
                        size="sm"
                        dot
                      >
                        {scan.verdict}
                      </Badge>
                    </div>
                    <MonoText size="sm" className="text-[var(--text-tertiary)]">
                      {scan.id}
                    </MonoText>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge status="verified" size="sm" dot>
                        ELA {scan.elaScore.toFixed(1)}
                      </Badge>
                      <Badge status="info" size="sm" dot>
                        VLM {scan.vlmScore.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                  <Link href={`/scan/${scan.id}/result`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      trailingIcon={<ExternalLink />}
                    >
                      Open
                    </Button>
                  </Link>
                </div>
              </div>
            </section>
          )}

          {batch && (
            <section>
              <p className="text-caption uppercase text-[var(--text-tertiary)] mb-2">
                Linked batch
              </p>
              <div className="flex items-center gap-3 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
                <Package className="h-4 w-4 text-[var(--text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-small font-medium text-[var(--text-primary)] truncate">
                    {batch.productName} · {batch.dosage}
                  </p>
                  <MonoText size="sm" className="text-[var(--text-tertiary)]">
                    {formatHash(batch.id)}
                  </MonoText>
                </div>
                <Link href={`/batches/${batch.id}`}>
                  <Button size="sm" variant="ghost" trailingIcon={<ExternalLink />}>
                    Open
                  </Button>
                </Link>
              </div>
            </section>
          )}

          {/* Vendor transaction history */}
          <section>
            <p className="text-caption uppercase text-[var(--text-tertiary)] mb-2">
              All transactions targeting vendor
            </p>
            <ul className="space-y-1.5">
              {allVendorTxns.length === 0 && (
                <li className="rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-[12px] text-[var(--text-tertiary)]">
                  No prior transactions.
                </li>
              )}
              {allVendorTxns.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2"
                >
                  <Banknote className="h-3 w-3 text-[var(--text-tertiary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-small text-[var(--text-primary)] truncate">
                      from {t.fromName}
                    </p>
                    <MonoText size="sm" className="text-[var(--text-tertiary)]">
                      {formatTimeOfDay(t.timestamp)} · {t.id}
                    </MonoText>
                  </div>
                  <Badge
                    status={
                      t.type === "validated"
                        ? "verified"
                        : t.type === "fraud_blocked"
                          ? "risk"
                          : "pending"
                    }
                    size="sm"
                    dot
                  >
                    {t.type.replace(/_/g, " ")}
                  </Badge>
                  <MonoText
                    size="sm"
                    className={
                      t.type === "fraud_blocked"
                        ? "text-[var(--risk)]"
                        : "text-[var(--text-primary)]"
                    }
                  >
                    {formatNGN(t.amount)}
                  </MonoText>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
