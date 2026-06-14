"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ScanLine, Copy, FileDown, QrCode, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { CustodyTimeline } from "@/components/custody/CustodyTimeline";
import { JourneyMap } from "@/components/custody/JourneyMap";
import { AnomalyBanner } from "@/components/custody/AnomalyBanner";
import { findBatch } from "@/lib/mock-api/fixtures/batches";
import { findUser } from "@/lib/mock-api/fixtures/users";
import { useQuery } from "@tanstack/react-query";
import { ledger as squadLedger, SquadCoError } from "@/lib/squadco";
import { format } from "date-fns";

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const batch = findBatch(id);
  // 64-hex ids are backend-minted binary_ids (`POST /ledger/initiate` →
  // `binary_id`). Fetch the real ledger history for those so the demo and
  // the live backend coexist on the same route.
  const isServerBinaryId = /^[0-9a-f]{64}$/i.test(id);
  const liveHistory = useQuery({
    queryKey: ["squad", "ledger", "history", id],
    queryFn: () => squadLedger.getHistory(id),
    enabled: isServerBinaryId && !batch,
    retry: false,
  });
  if (!batch && liveHistory.data) {
    const h = liveHistory.data;
    return (
      <div>
        <PageHeader
          eyebrow="Batch · live ledger"
          title={h.product.name}
          description={`NAFDAC ${h.product.nafdac_reg_no ?? "—"} · batch ${h.product.batch_number} · initiated ${h.product.initiated_at}`}
          actions={
            <Link href={`/scan?batchId=${encodeURIComponent(id)}`}>
              <Button variant="primary" leadingIcon={<ScanLine />}>
                Scan to verify
              </Button>
            </Link>
          }
        />
        <Card className="mt-6" padded>
          <CardTitle>Provenance</CardTitle>
          <CardDescription>
            {h.official_journey.length} official journey step
            {h.official_journey.length === 1 ? "" : "s"} ·{" "}
            {h.community_scans.length} community scan
            {h.community_scans.length === 1 ? "" : "s"}
          </CardDescription>
          {h.official_journey.length === 0 && h.community_scans.length === 0 && (
            <p className="mt-3 text-small text-[var(--text-tertiary)]">
              No scans yet. The batch is initiated; awaiting custody
              hand-offs.
            </p>
          )}
          {h.official_journey.map((step, i) => (
            <div
              key={i}
              className="mt-3 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-small font-semibold">
                  {step.scanned_by_business}
                </span>
                <Badge size="sm" status={step.ai_verdict ? "verified" : "risk"} dot>
                  {step.ai_verdict ? "PASS" : "FAIL"}
                </Badge>
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                {step.resolved_location} · {step.timestamp}
              </p>
            </div>
          ))}
        </Card>
      </div>
    );
  }
  if (!batch && isServerBinaryId && liveHistory.isLoading) {
    return (
      <div className="mt-12 text-center">
        <p className="text-h3 text-[var(--text-secondary)]">
          Loading live ledger record…
        </p>
        <MonoText size="sm" className="mt-2 block text-[var(--text-tertiary)]">
          {id}
        </MonoText>
      </div>
    );
  }
  if (!batch) {
    return (
      <div className="mt-12 text-center">
        <p className="text-h3 text-[var(--text-secondary)]">
          Batch not found in this ledger.
        </p>
        <MonoText size="sm" className="mt-2 block text-[var(--text-tertiary)]">
          {id}
        </MonoText>
        <Link href="/batches">
          <Button variant="ghost" leadingIcon={<ArrowLeft />} className="mt-4">
            Back to batches
          </Button>
        </Link>
      </div>
    );
  }
  const currentHolder = findUser(batch.currentHolderId);

  return (
    <div>
      <PageHeader
        eyebrow="Batch · custody record"
        title={`${batch.productName} · ${batch.dosage}`}
        description={`NAFDAC ${batch.nafdacReg} · manufactured ${format(new Date(batch.manufactureDate), "PP")} · expires ${format(new Date(batch.expiryDate), "PP")}`}
        actions={
          <>
            <Button variant="secondary" leadingIcon={<QrCode />}>
              Download QR
            </Button>
            <Link href="/scan">
              <Button variant="primary" leadingIcon={<ScanLine />}>
                Scan to verify
              </Button>
            </Link>
          </>
        }
      />

      {/* Hash strip */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3.5 py-2">
        <span className="text-caption uppercase text-[var(--text-tertiary)]">
          Binary identifier · SHA-256
        </span>
        <MonoText size="sm" className="text-[var(--text-secondary)]">
          {batch.id}
        </MonoText>
        <Button size="sm" variant="ghost" leadingIcon={<Copy />}>
          Copy
        </Button>
        <span className="ml-auto text-caption uppercase text-[var(--text-tertiary)]">
          ELA fingerprint
        </span>
        <MonoText size="sm" className="text-[var(--text-secondary)]">
          {batch.elaFingerprint}
        </MonoText>
      </div>

      {batch.flagged && (
        <div className="mt-4">
          <AnomalyBanner batch={batch} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left rail — metadata */}
        <aside className="space-y-4">
          <Card padded>
            <div className="flex items-center justify-between pb-3">
              <CardTitle>Metadata</CardTitle>
              <Badge
                status={batch.flagged ? "risk" : "verified"}
                dot
                size="sm"
              >
                {batch.flagged ? "flagged" : batch.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <dl className="space-y-2 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              <Row label="Product">
                <span className="text-small text-[var(--text-primary)]">
                  {batch.productName}
                </span>
              </Row>
              <Row label="Dosage">
                <span className="text-small text-[var(--text-primary)]">
                  {batch.dosage}
                </span>
              </Row>
              <Row label="Manufacturer">
                <div className="flex items-center gap-1.5">
                  <span className="text-small text-[var(--text-primary)]">
                    {batch.manufacturerName}
                  </span>
                  <Badge size="sm" status="verified" dot>
                    verified
                  </Badge>
                </div>
              </Row>
              <Row label="NAFDAC reg">
                <MonoText size="sm">{batch.nafdacReg}</MonoText>
              </Row>
              <Row label="Manufactured">
                <MonoText size="sm">
                  {format(new Date(batch.manufactureDate), "yyyy-MM-dd")}
                </MonoText>
              </Row>
              <Row label="Expires">
                <MonoText size="sm">
                  {format(new Date(batch.expiryDate), "yyyy-MM-dd")}
                </MonoText>
              </Row>
              <Row label="Units">
                <MonoText size="sm">
                  {batch.unitCount.toLocaleString()}
                </MonoText>
              </Row>
              <Row label="Current holder">
                <span className="text-small text-[var(--text-primary)] truncate">
                  {currentHolder?.organization ?? batch.currentHolderId}
                </span>
              </Row>
            </dl>
          </Card>

          <Card inset padded>
            <CardTitle>Forensic readiness</CardTitle>
            <CardDescription>
              Reference imagery and integrity hash used during verification.
            </CardDescription>
            <dl className="mt-3 space-y-2 border-t border-[var(--border-hairline)] pt-3 text-[12px]">
              <Row label="Reference images">
                <MonoText size="sm">3 · NAFDAC golden</MonoText>
              </Row>
              <Row label="ELA fingerprint">
                <MonoText size="sm">{batch.elaFingerprint}</MonoText>
              </Row>
              <Row label="Custody hops">
                <MonoText size="sm">{batch.custody.length}</MonoText>
              </Row>
              <Row label="Last scan verdict">
                <Badge size="sm" status={batch.flagged ? "risk" : "verified"} dot>
                  {batch.flagged ? "FAIL · review" : "PASS · 95.4"}
                </Badge>
              </Row>
            </dl>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<FileDown />}
              className="mt-3 w-full justify-center"
            >
              Export custody report
            </Button>
          </Card>
        </aside>

        {/* Center — timeline */}
        <section>
          <Card padded>
            <div className="pb-3">
              <CardTitle>Chain of custody</CardTitle>
              <CardDescription>
                Every hop carries server-side timestamp, GPS, device fingerprint, and signature.
              </CardDescription>
            </div>
            <div className="border-t border-[var(--border-hairline)] pt-4">
              <CustodyTimeline hops={batch.custody} />
            </div>
          </Card>
        </section>

        {/* Right — map */}
        <section className="lg:sticky lg:top-20 lg:self-start">
          <Card padded className="h-[640px]">
            <div className="flex items-start justify-between pb-3">
              <CardTitle>Journey map</CardTitle>
              <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
                CartoDB Dark Matter
              </span>
            </div>
            <div className="h-[560px]">
              <JourneyMap hops={batch.custody} />
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
