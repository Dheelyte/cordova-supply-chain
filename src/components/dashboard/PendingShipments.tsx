"use client";

import * as React from "react";
import Link from "next/link";
import { ScanLine, Truck, MapPin } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { MockBatch } from "@/lib/mock-api/fixtures/batches";
import { formatHash } from "@/lib/utils/format";

interface ShipmentRow {
  batch: MockBatch;
  fromCity: string;
  eta: string;
  units: number;
}

export function PendingShipments({ shipments }: { shipments: ShipmentRow[] }) {
  return (
    <Card padded>
      <div className="flex items-start justify-between pb-3">
        <div>
          <CardTitle>Incoming shipments</CardTitle>
          <CardDescription>
            Each must be scanned on arrival before custody is acknowledged.
          </CardDescription>
        </div>
        <Badge status="pending" size="sm" dot>
          {shipments.length} awaiting scan
        </Badge>
      </div>
      <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
        {shipments.map((s) => (
          <li
            key={s.batch.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Truck className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-small font-medium text-[var(--text-primary)] truncate">
                  {s.batch.productName} · {s.batch.dosage}
                </p>
                <MonoText size="sm" className="text-[var(--text-tertiary)] shrink-0">
                  {formatHash(s.batch.id)}
                </MonoText>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                <MapPin className="h-3 w-3" /> from {s.fromCity}
                <span>·</span>
                <span>{s.units.toLocaleString()} units</span>
                <span>·</span>
                <span>ETA {s.eta}</span>
              </div>
            </div>
            <Link href={`/scan?batchId=${s.batch.id}`}>
              <Button
                size="sm"
                variant="primary"
                leadingIcon={<ScanLine />}
              >
                Scan to accept
              </Button>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
