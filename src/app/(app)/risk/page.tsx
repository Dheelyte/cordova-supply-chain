"use client";

import * as React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { RiskMap, type RiskRegion } from "@/components/risk/RiskMap";
import { AlertCard, type Alert, type AlertSeverity } from "@/components/risk/AlertCard";
import { InvestigationSheet } from "@/components/risk/InvestigationSheet";
import { SuspendVendorModal } from "@/components/risk/SuspendVendorModal";
import { useWallet } from "@/stores/wallet";
import { useSuspendedVendors } from "@/stores/suspended-vendors";
import { findUser, MOCK_USERS } from "@/lib/mock-api/fixtures/users";
import { formatNGN } from "@/lib/utils/format";
import { useQuery } from "@tanstack/react-query";
import { risk as squadRisk } from "@/lib/squadco";

// State coordinate map (approx capital city)
const STATE_COORDS: Record<string, [number, number]> = {
  Lagos: [6.5244, 3.3792],
  FCT: [9.0579, 7.4951],
  Rivers: [4.8156, 7.0498],
  Kano: [12.0022, 8.5919],
  Oyo: [7.3775, 3.947],
  Kaduna: [10.5222, 7.4383],
  Edo: [6.335, 5.6037],
  Anambra: [6.221, 6.937],
  Sokoto: [13.0059, 5.2476],
  Plateau: [9.8965, 8.8583],
};

function makeAlerts(blockedTxnsCount: number): Alert[] {
  // Build deterministic-ish alert list anchored on the fraud-blocked ledger entries
  const baseAlerts: Alert[] = [];
  // Seed extra alerts in additional states to populate the map
  const seeds: Omit<Alert, "id">[] = [
    {
      severity: "critical",
      title: "Counterfeit Coartem batch · expiry tampering",
      reason:
        "ELA flagged digital alteration concentrated on the expiry-date region. Capture submitted by vendor with TIN/CAC mismatch.",
      vendorId: "usr_ghost_tin_mismatch",
      vendorName: "Quick Pharma Wholesale",
      state: "Lagos",
      amount: 1_800_000,
      timestamp: "2026-05-10T20:11:08.491Z",
      linkedScanId: "scan_counterfeit_digital",
      linkedBatchId: "batch-coartem-002",
      linkedTxnId: "TXN_FRAUD_001x9z",
    },
    {
      severity: "critical",
      title: "Counterfeit Augmentin · print discrepancies",
      reason:
        "VLM flagged 3 print discrepancies vs NAFDAC reference. Vendor premise resolves to residential apartment.",
      vendorId: "usr_ghost_residential",
      vendorName: "Premier Drug Mart",
      state: "Lagos",
      amount: 2_240_000,
      timestamp: "2026-05-09T18:42:33.118Z",
      linkedScanId: "scan_counterfeit_print",
      linkedTxnId: "TXN_FRAUD_002y0a",
    },
    {
      severity: "high",
      title: "Repeat vendor · second blocked attempt",
      reason:
        "Quick Pharma attempted a second settlement within 24h after first block. Identity Wall already flagged this vendor as suspended-tier.",
      vendorId: "usr_ghost_tin_mismatch",
      vendorName: "Quick Pharma Wholesale",
      state: "Lagos",
      amount: 940_000,
      timestamp: "2026-05-08T22:08:14.221Z",
      linkedScanId: "scan_counterfeit_digital",
      linkedTxnId: "TXN_FRAUD_003a1b",
    },
    {
      severity: "high",
      title: "Custody chain anomaly · impossible travel",
      reason:
        "Claimed Lagos → Kano handoff in 8 minutes. Great-circle distance 824km; minimum feasible commercial-air transit 95 minutes.",
      vendorId: "usr_5d8e3f7b1a92",
      vendorName: "Northern Meds Distribution",
      state: "Kano",
      amount: 1_360_000,
      timestamp: "2026-05-07T15:18:42.991Z",
      linkedScanId: "scan_counterfeit_print",
      linkedBatchId: "batch-coartem-002",
      linkedTxnId: "TXN_FRAUD_004c2d",
    },
    {
      severity: "medium",
      title: "Network anomaly · unusual handoff frequency",
      reason:
        "Vendor handoff frequency 4σ above baseline. No fraud verdict yet, but worth surveillance.",
      vendorId: "usr_3f1a82c7e9d4",
      vendorName: "Idumota Health Distribution",
      state: "Lagos",
      amount: 0,
      timestamp: "2026-05-11T08:14:00.000Z",
      linkedTxnId: "TXN_PEND_001e3f",
    },
    {
      severity: "medium",
      title: "Premise license expiring · PCN registry",
      reason:
        "Vendor PCN premise license expires in 14 days. Network policy auto-suspends on expiry unless renewed.",
      vendorId: "usr_b7e2c81f4a39",
      vendorName: "ChemCare Pharmacy · Bodija",
      state: "Oyo",
      amount: 0,
      timestamp: "2026-05-09T07:00:00.000Z",
      linkedTxnId: "TXN_PEND_002g4h",
    },
  ];
  seeds.forEach((s, i) =>
    baseAlerts.push({ ...s, id: `alert_${1000 + i}` })
  );
  void blockedTxnsCount; // reserved for live appending in future
  return baseAlerts;
}

function regionsFromAlerts(alerts: Alert[]): RiskRegion[] {
  const grouped = new Map<
    string,
    { incidents: number; amount: number; severityMax: AlertSeverity }
  >();
  alerts.forEach((a) => {
    const r = grouped.get(a.state) ?? {
      incidents: 0,
      amount: 0,
      severityMax: "medium" as AlertSeverity,
    };
    r.incidents += 1;
    r.amount += a.amount;
    if (a.severity === "critical") r.severityMax = "critical";
    else if (a.severity === "high" && r.severityMax !== "critical")
      r.severityMax = "high";
    grouped.set(a.state, r);
  });

  const out: RiskRegion[] = [];
  grouped.forEach((v, state) => {
    const c = STATE_COORDS[state];
    if (!c) return;
    out.push({
      state,
      lat: c[0],
      lng: c[1],
      incidents: v.incidents,
      amount: v.amount,
      severity: v.severityMax,
    });
  });
  // Add low-severity dots for active states with no alerts (visual completeness)
  ["FCT", "Rivers", "Edo", "Kaduna"].forEach((s) => {
    if (!grouped.has(s)) {
      const c = STATE_COORDS[s];
      if (c)
        out.push({
          state: s,
          lat: c[0],
          lng: c[1],
          incidents: 0,
          amount: 0,
          severity: "low",
        });
    }
  });
  return out;
}

export default function RiskPage() {
  const ledger = useWallet((s) => s.ledger);
  const suspendedIds = useSuspendedVendors((s) => s.suspendedIds);
  const suspendVendor = useSuspendedVendors((s) => s.suspend);
  // Live regulator data from `GET /risk/alerts`. We pre-fetch so the
  // live-signals strip below can show real counts alongside the rich demo
  // alert list. The demo alerts stay because the backend's shape is
  // intentionally minimal — see MISMATCHES.md.
  const liveAlerts = useQuery({
    queryKey: ["squad", "risk", "alerts"],
    queryFn: () => squadRisk.getAlerts(),
    retry: false,
    staleTime: 30_000,
  });

  const fraudBlockedCount = ledger.filter((t) => t.type === "fraud_blocked").length;
  const allAlerts = React.useMemo(
    () => makeAlerts(fraudBlockedCount),
    [fraudBlockedCount]
  );

  const [severity, setSeverity] = React.useState<"all" | AlertSeverity>("all");
  const [stateFilter, setStateFilter] = React.useState<string>("all");
  const [selectedAlertId, setSelectedAlertId] = React.useState<string | null>(null);
  const [pendingSuspend, setPendingSuspend] = React.useState<{
    vendorId: string;
    vendorName: string;
    pendingFreezes: number;
    defaultReason: string;
  } | null>(null);

  const visibleAlerts = allAlerts.filter((a) => {
    if (severity !== "all" && a.severity !== severity) return false;
    if (stateFilter !== "all" && a.state !== stateFilter) return false;
    return true;
  });

  const regions = React.useMemo(() => regionsFromAlerts(allAlerts), [allAlerts]);
  const selectedAlert = visibleAlerts.find((a) => a.id === selectedAlertId) ?? null;
  const states = Array.from(new Set(allAlerts.map((a) => a.state))).sort();

  async function handleConfirmSuspend(reason: string) {
    if (!pendingSuspend) return;
    // Local suspension state for the demo UX. If the vendor id looks like
    // a real backend UUID, also fire-and-forget `/risk/suspend-vendor` so
    // the change propagates to the live regulator dashboard.
    suspendVendor(
      pendingSuspend.vendorId,
      reason,
      pendingSuspend.pendingFreezes
    );
    if (/^[0-9a-f-]{36}$/i.test(pendingSuspend.vendorId)) {
      try {
        await squadRisk.suspendVendor({
          vendor_id: pendingSuspend.vendorId,
          reason,
        });
        liveAlerts.refetch();
      } catch {
        // Demo flow stays alive even if the backend rejects.
      }
    }
    setPendingSuspend(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Regulator · NAFDAC oversight"
        title="Risk feed"
        description="Live network of fraud-blocked settlements and suspended vendors. Drill any alert to investigate; suspension cascades immediately."
      />

      {/* Live backend signals — minimal data the regulator endpoint exposes. */}
      {liveAlerts.data && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2">
          <Badge size="sm" status="verified" dot>
            Live · /risk/alerts
          </Badge>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {liveAlerts.data.suspended_vendors.length} suspended vendor
            {liveAlerts.data.suspended_vendors.length === 1 ? "" : "s"} ·{" "}
            {liveAlerts.data.fraud_blocked_transactions.length} fraud-blocked
            transaction
            {liveAlerts.data.fraud_blocked_transactions.length === 1 ? "" : "s"}{" "}
            on the deployed backend
          </p>
        </div>
      )}

      {/* Top stats */}
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Stat
          label="Open critical alerts"
          value={allAlerts.filter((a) => a.severity === "critical").length}
          tint="risk"
        />
        <Stat
          label="High severity"
          value={allAlerts.filter((a) => a.severity === "high").length}
          tint="pending"
        />
        <Stat
          label="Suspended vendors"
          value={suspendedIds.length}
          tint="risk"
        />
        <Stat
          label="Fraud blocked · 7d"
          value={formatNGN(
            ledger
              .filter((t) => t.type === "fraud_blocked")
              .reduce((s, t) => s + t.amount, 0),
            { compact: true }
          )}
          tint="risk"
          asString
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Map */}
        <Card padded className="h-[560px]">
          <div className="flex items-start justify-between pb-3">
            <div>
              <CardTitle>Fraud-density map</CardTitle>
              <CardDescription>
                Incidents grouped by state. Tap a dot to filter the feed.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <LegendDot tint="var(--risk)" label="Critical" />
              <LegendDot tint="var(--pending)" label="High" />
              <LegendDot tint="var(--info)" label="Medium" />
              <LegendDot tint="var(--text-tertiary)" label="Low" />
            </div>
          </div>
          <div className="h-[472px]">
            <RiskMap
              regions={regions}
              onSelect={(state) =>
                setStateFilter((prev) => (prev === state ? "all" : state))
              }
            />
          </div>
        </Card>

        {/* Alerts */}
        <Card padded className="flex h-[560px] flex-col">
          <div className="flex items-center justify-between pb-3">
            <CardTitle>Active alerts</CardTitle>
            <Badge status="risk" size="sm" dot>
              {visibleAlerts.length} of {allAlerts.length}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 pb-3">
            <Select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as "all" | AlertSeverity)
              }
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </Select>
            <Select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="all">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {visibleAlerts.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <ShieldCheck className="h-6 w-6 text-[var(--text-tertiary)]" />
                <p className="text-small text-[var(--text-tertiary)]">
                  No alerts match those filters.
                </p>
              </div>
            )}
            {visibleAlerts.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                active={selectedAlertId === a.id}
                onSelect={setSelectedAlertId}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Suspended vendor strip */}
      <SuspendedStrip />

      {/* Slide-in sheet */}
      <InvestigationSheet
        alert={selectedAlert}
        onClose={() => setSelectedAlertId(null)}
        onRequestSuspend={(vendorId, vendorName, pendingFreezes, defaultReason) =>
          setPendingSuspend({ vendorId, vendorName, pendingFreezes, defaultReason })
        }
      />

      {/* Suspension modal */}
      {pendingSuspend && (
        <SuspendVendorModal
          vendorId={pendingSuspend.vendorId}
          vendorName={pendingSuspend.vendorName}
          pendingFreezes={pendingSuspend.pendingFreezes}
          defaultReason={pendingSuspend.defaultReason}
          onClose={() => setPendingSuspend(null)}
          onConfirm={handleConfirmSuspend}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tint,
  asString,
}: {
  label: string;
  value: number | string;
  tint: "risk" | "pending" | "verified" | "neutral";
  asString?: boolean;
}) {
  const color =
    tint === "risk"
      ? "var(--risk)"
      : tint === "pending"
        ? "var(--pending)"
        : tint === "verified"
          ? "var(--verified)"
          : "var(--text-primary)";
  return (
    <Card padded>
      <p className="text-caption uppercase text-[var(--text-tertiary)]">
        {label}
      </p>
      <MonoText
        size="lg"
        className="mt-1 block text-[28px] leading-none"
        style={{ color }}
      >
        {asString ? value : String(value)}
      </MonoText>
    </Card>
  );
}

function LegendDot({ tint, label }: { tint: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
      <span className="h-2 w-2 rounded-full" style={{ background: tint }} />
      {label}
    </span>
  );
}

function SuspendedStrip() {
  const suspendedIds = useSuspendedVendors((s) => s.suspendedIds);
  const reasons = useSuspendedVendors((s) => s.reasons);
  return (
    <Card padded className="mt-6">
      <div className="flex items-start justify-between pb-3">
        <div>
          <CardTitle>Suspended vendors · network-wide</CardTitle>
          <CardDescription>
            Settlements to these vendors are frozen across every role in the network.
          </CardDescription>
        </div>
        <Badge status="risk" dot>
          {suspendedIds.length} suspended
        </Badge>
      </div>
      <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
        {suspendedIds.length === 0 && (
          <li className="text-small text-[var(--text-tertiary)]">
            No vendors currently suspended.
          </li>
        )}
        {suspendedIds.map((id) => {
          const v = findUser(id) ?? MOCK_USERS.find((u) => u.id === id);
          const r = reasons[id];
          return (
            <li
              key={id}
              className="flex items-center gap-3 rounded-[8px] border border-[var(--risk-border)] bg-[var(--risk-soft)]/30 px-3 py-2"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--risk)]" />
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium text-[var(--text-primary)] truncate">
                  {v?.organization ?? id}
                </p>
                <MonoText size="sm" className="text-[var(--text-tertiary)]">
                  {id}
                </MonoText>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {r?.reason ?? "No reason recorded."}
                </p>
              </div>
              <Badge size="sm" status="risk" dot>
                {r?.frozenTxns ?? 0} frozen
              </Badge>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
