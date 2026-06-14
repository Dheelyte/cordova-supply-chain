"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { ScanLine } from "lucide-react";
import type { MockBatch } from "@/lib/mock-api/fixtures/batches";
import { formatHash } from "@/lib/utils/format";

interface InventoryRow {
  batch: MockBatch;
  authStatus: "authenticated" | "pending" | "flagged";
  units: number;
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const groups: Record<InventoryRow["authStatus"], InventoryRow[]> = {
    authenticated: [],
    pending: [],
    flagged: [],
  };
  rows.forEach((r) => groups[r.authStatus].push(r));

  return (
    <Card padded>
      <div className="flex items-start justify-between pb-3">
        <div>
          <CardTitle>Inventory · authentication state</CardTitle>
          <CardDescription>
            Grouped by forensic verdict on the inbound shipment.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge status="verified" size="sm" dot>
            {groups.authenticated.length} authenticated
          </Badge>
          <Badge status="pending" size="sm" dot>
            {groups.pending.length} pending
          </Badge>
          <Badge status="risk" size="sm" dot>
            {groups.flagged.length} flagged
          </Badge>
        </div>
      </div>

      <div className="border-t border-[var(--border-hairline)]">
        {(["authenticated", "pending", "flagged"] as const).map((g) => (
          <GroupBlock key={g} group={g} rows={groups[g]} />
        ))}
      </div>
    </Card>
  );
}

function GroupBlock({
  group,
  rows,
}: {
  group: "authenticated" | "pending" | "flagged";
  rows: InventoryRow[];
}) {
  if (rows.length === 0) return null;
  const status =
    group === "authenticated" ? "verified" : group === "pending" ? "pending" : "risk";
  const label =
    group === "authenticated" ? "Authenticated" : group === "pending" ? "Pending verification" : "Flagged";

  return (
    <section>
      <header className="flex items-center gap-2 px-1 py-2.5 sticky top-14 bg-[var(--bg-elevated)]">
        <Badge status={status} size="sm" dot>
          {label}
        </Badge>
        <p className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
          {rows.length} batches · {rows.reduce((s, r) => s + r.units, 0).toLocaleString()} units
        </p>
      </header>
      <ul className="border-t border-[var(--border-hairline)]">
        {rows.map((r) => (
          <li
            key={r.batch.id}
            className="grid grid-cols-[1.4fr_1fr_1fr_120px_auto] items-center gap-3 border-b border-[var(--border-hairline)] py-2.5 text-small"
          >
            <div className="min-w-0">
              <p className="font-medium text-[var(--text-primary)] truncate">
                {r.batch.productName} · {r.batch.dosage}
              </p>
              <MonoText size="sm" className="text-[var(--text-tertiary)]">
                {formatHash(r.batch.id)}
              </MonoText>
            </div>
            <span className="text-[var(--text-secondary)]">
              NAFDAC <MonoText size="sm">{r.batch.nafdacReg}</MonoText>
            </span>
            <span className="text-[var(--text-secondary)]">
              {r.batch.manufacturerName}
            </span>
            <MonoText size="sm" className="text-right text-[var(--text-primary)]">
              {r.units.toLocaleString()} u
            </MonoText>
            <Link href={`/batches/${r.batch.id}`}>
              <Button size="sm" variant="ghost">
                Inspect
              </Button>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
