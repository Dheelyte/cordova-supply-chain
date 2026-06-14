"use client";

import * as React from "react";
import Link from "next/link";
import { ScanLine, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TopStrip } from "@/components/dashboard/TopStrip";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { InventoryTable } from "@/components/dashboard/InventoryTable";
import { PendingShipments } from "@/components/dashboard/PendingShipments";
import { ConsumerScanCta } from "@/components/dashboard/ConsumerScanCta";
import { RegulatorFeed } from "@/components/dashboard/RegulatorFeed";
import { useAuth } from "@/stores/auth";
import { MOCK_BATCHES } from "@/lib/mock-api/fixtures/batches";
import { MOCK_TRANSACTIONS } from "@/lib/mock-api/fixtures/transactions";
import { formatNGN } from "@/lib/utils/format";

// Deterministic 7-day series builder
function spark(seed: number, base: number, drift = 0.18): number[] {
  const arr: number[] = [];
  let v = base * 0.92;
  for (let i = 0; i < 7; i++) {
    const j = Math.sin((seed + i) * 1.7) * drift + (Math.random() - 0.5) * 0.04;
    v = Math.max(0, v * (1 + j));
    arr.push(Math.round(v));
  }
  arr[arr.length - 1] = base;
  return arr;
}

export default function DashboardPage() {
  const session = useAuth((s) => s.session);
  const role = session?.role ?? "consumer";

  const eyebrow =
    role === "manufacturer"
      ? "Manufacturer · originate"
      : role === "wholesaler"
        ? "Wholesaler · distribute"
        : role === "retailer"
          ? "Retailer · dispense"
          : role === "consumer"
            ? "Consumer · verify"
            : "Regulator · oversight";

  const greeting = `Welcome back, ${session?.name.split(" ")[0] ?? ""}`;

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={greeting}
        description="Role-aware operations console. Forensic verdicts gate every transaction."
        actions={
          role === "manufacturer" ? (
            <>
              <Link href="/scan">
                <Button variant="secondary" leadingIcon={<ScanLine />}>
                  Open scan
                </Button>
              </Link>
              <Link href="/batches/new">
                <Button variant="primary" leadingIcon={<Plus />}>
                  Initialize new batch
                </Button>
              </Link>
            </>
          ) : role === "regulator" ? (
            <Link href="/risk">
              <Button variant="primary">Open risk feed</Button>
            </Link>
          ) : (
            <Link href="/scan">
              <Button variant="primary" leadingIcon={<ScanLine />}>
                {role === "consumer" ? "Scan a product" : "Open scan"}
              </Button>
            </Link>
          )
        }
      />

      <div className="mt-6 space-y-6">
        <TopStrip
          activeAlerts={
            role === "regulator"
              ? 12
              : role === "manufacturer"
                ? 1
                : role === "wholesaler"
                  ? 2
                  : 0
          }
        />

        {role === "manufacturer" && <ManufacturerVariant />}
        {role === "wholesaler" && <DistributionVariant variant="wholesaler" />}
        {role === "retailer" && <DistributionVariant variant="retailer" />}
        {role === "consumer" && <ConsumerScanCta />}
        {role === "regulator" && <RegulatorFeed />}
      </div>
    </div>
  );
}

function ManufacturerVariant() {
  return (
    <div className="space-y-6">


      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ActivityFeed />
        <ManufacturerRoster />
      </div>
    </div>
  );
}

function ManufacturerRoster() {
  const myBatches = MOCK_BATCHES.filter(
    (b) => b.manufacturerName === "Lagos Pharma Ltd"
  );
  const txnsToMe = MOCK_TRANSACTIONS.filter(
    (t) => t.toName === "Lagos Pharma Ltd"
  ).slice(0, 3);
  return (
    <div className="space-y-4">
      <InventoryTable
        rows={myBatches.map((b) => ({
          batch: b,
          authStatus: b.flagged
            ? "flagged"
            : b.custody.length > 1
              ? "authenticated"
              : "pending",
          units: b.unitCount,
        }))}
      />
      <RecentSettlements txns={txnsToMe} />
    </div>
  );
}

function DistributionVariant({
  variant,
}: {
  variant: "wholesaler" | "retailer";
}) {
  // Compose inventory + pending shipments for the role
  const inventory = MOCK_BATCHES.map((b) => ({
    batch: b,
    authStatus: b.flagged
      ? ("flagged" as const)
      : b.custody.length >= 3
        ? ("authenticated" as const)
        : ("pending" as const),
    units: b.unitCount,
  })).slice(0, 6);

  const shipments = MOCK_BATCHES.slice(0, 3).map((b, i) => ({
    batch: b,
    fromCity: b.custody[0]?.city ?? "Lagos",
    eta: ["2 hours", "5 hours", "tomorrow"][i] ?? "later",
    units: b.unitCount,
  }));

  const settlements = MOCK_TRANSACTIONS.filter((t) => t.type === "validated").slice(
    0,
    4
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="On-hand SKUs"
          value={inventory.length.toString()}
          delta={0.02}
          comparison="vs last 7d"
          series={spark(11, inventory.length)}
        />
        <KpiCard
          label="Pending scan"
          value={shipments.length.toString()}
          delta={-0.1}
          positivePolarity="up_is_bad"
          comparison="vs avg"
          series={spark(12, shipments.length)}
          tint="pending"
        />
        <KpiCard
          label="Validated settlements · 7d"
          value={formatNGN(
            settlements.reduce((s, t) => s + t.amount, 0),
            { compact: true }
          )}
          delta={0.18}
          comparison="vs prior 7d"
          series={spark(13, 9_300_000)}
          tint="verified"
        />
        <KpiCard
          label="Trust score floor"
          value={variant === "wholesaler" ? "88.0" : "84.7"}
          delta={0.006}
          comparison="rolling 30d"
          series={spark(14, 88)}
          tint="accent"
        />
      </div>

      <PendingShipments shipments={shipments} />
      <InventoryTable rows={inventory} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <RecentSettlements txns={settlements} />
        <ActivityFeed />
      </div>
    </div>
  );
}

function RecentSettlements({
  txns,
}: {
  txns: (typeof MOCK_TRANSACTIONS)[number][];
}) {
  return (
    <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-5">
      <div className="flex items-start justify-between pb-3">
        <div>
          <p className="text-h3">Recent settlements</p>
          <p className="text-small text-[var(--text-secondary)]">
            Validated by both AI verdict and ledger path.
          </p>
        </div>
        <Link href="/transactions">
          <Button size="sm" variant="ghost">
            View ledger
          </Button>
        </Link>
      </div>
      <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
        {txns.length === 0 && (
          <p className="text-small text-[var(--text-tertiary)]">
            No recent settlements.
          </p>
        )}
        {txns.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-small font-medium text-[var(--text-primary)] truncate">
                {t.fromName} → {t.toName}
              </p>
              <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                {t.squadRef ?? "—"}
              </span>
            </div>
            <span className="font-mono-ui text-[13px] font-medium text-[var(--verified)]">
              {formatNGN(t.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
