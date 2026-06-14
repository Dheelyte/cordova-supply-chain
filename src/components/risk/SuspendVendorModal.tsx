"use client";

import * as React from "react";
import { X, ShieldAlert, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";

export interface SuspendVendorModalProps {
  vendorId: string;
  vendorName: string;
  pendingFreezes: number;
  defaultReason: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function SuspendVendorModal({
  vendorId,
  vendorName,
  pendingFreezes,
  defaultReason,
  onClose,
  onConfirm,
}: SuspendVendorModalProps) {
  const [reason, setReason] = React.useState(defaultReason);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        emphasized
        className="relative w-full max-w-[560px] border-[var(--risk-border)]"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[var(--risk-border)] bg-[var(--risk-soft)] text-[var(--risk)]">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-caption uppercase text-[var(--risk)]">
                Suspend vendor
              </p>
              <h2 className="text-h2 mt-1 truncate">{vendorName}</h2>
              <MonoText size="sm" className="text-[var(--text-tertiary)]">
                {vendorId}
              </MonoText>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-[var(--border-hairline)] pt-3">
          <div className="flex items-start gap-2.5 rounded-[8px] border border-[var(--pending-border)] bg-[var(--pending-soft)]/40 px-3 py-2.5">
            <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[var(--pending)]" />
            <p className="text-[12px] text-[var(--text-secondary)]">
              Suspension cascades immediately across the network. All in-flight
              settlements to this vendor will freeze and surface as fraud-blocked
              in the ledger. This action is logged and reversible by NAFDAC.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Pending freezes" value={pendingFreezes.toString()} tint="pending" />
            <Stat label="Open scans" value="0" tint="neutral" />
            <Stat label="Suspended now" value="cascade" tint="risk" />
          </div>

          <div className="mt-4">
            <label className="text-caption uppercase text-[var(--text-tertiary)]">
              Reason for suspension
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2 text-small text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--border-focus)]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            leadingIcon={<ShieldAlert />}
            onClick={() => onConfirm(reason)}
          >
            Suspend &amp; freeze {pendingFreezes} pending
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: "pending" | "risk" | "neutral";
}) {
  const color =
    tint === "pending"
      ? "var(--pending)"
      : tint === "risk"
        ? "var(--risk)"
        : "var(--text-secondary)";
  return (
    <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <MonoText size="md" className="mt-0.5 block" style={{ color }}>
        {value}
      </MonoText>
    </div>
  );
}
