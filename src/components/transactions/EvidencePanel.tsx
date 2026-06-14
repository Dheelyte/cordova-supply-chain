"use client";

import * as React from "react";
import Link from "next/link";
import { ScanLine, Package, FileDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { ConfidenceGauge } from "@/components/forensic/ConfidenceGauge";
import { findScan } from "@/lib/mock-api/fixtures/scans";
import { findBatch } from "@/lib/mock-api/fixtures/batches";
import { formatHash } from "@/lib/utils/format";
import type { MockTransaction } from "@/lib/mock-api/fixtures/transactions";

export function EvidencePanel({ txn }: { txn: MockTransaction }) {
  const scan = txn.linkedScanId ? findScan(txn.linkedScanId) : undefined;
  const batch = txn.linkedBatchId ? findBatch(txn.linkedBatchId) : undefined;

  return (
    <div className="grid gap-3 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3 md:grid-cols-[180px_1fr_1fr_auto]">
      {/* Forensic gauge */}
      <div className="flex items-center gap-3">
        {scan ? (
          <>
            <ConfidenceGauge
              score={scan.consensusScore}
              size={64}
              mode="static"
            />
            <div>
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                AI verdict
              </p>
              <p className="text-small font-semibold text-[var(--text-primary)]">
                {scan.verdict}
              </p>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-[var(--text-tertiary)]">
            No linked scan.
          </p>
        )}
      </div>

      {/* Scan summary */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ScanLine className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Linked scan
          </p>
        </div>
        {scan ? (
          <div className="mt-1 space-y-0.5">
            <p className="text-small text-[var(--text-primary)] truncate">
              {scan.productName}
            </p>
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              {scan.id}
            </MonoText>
            <div className="flex items-center gap-2 pt-0.5">
              <Badge size="sm" status="verified" dot>
                ELA {scan.elaScore.toFixed(1)}
              </Badge>
              <Badge size="sm" status="info" dot>
                VLM {scan.vlmScore.toFixed(1)}
              </Badge>
            </div>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">—</p>
        )}
      </div>

      {/* Batch summary */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Linked batch
          </p>
        </div>
        {batch ? (
          <div className="mt-1 space-y-0.5">
            <p className="text-small text-[var(--text-primary)] truncate">
              {batch.productName} · {batch.dosage}
            </p>
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              {formatHash(batch.id)}
            </MonoText>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              ELA fingerprint{" "}
              <MonoText size="sm" className="text-[var(--text-secondary)]">
                {batch.elaFingerprint}
              </MonoText>
            </p>
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">—</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end justify-between gap-1.5">
        {scan && (
          <Link href={`/scan/${scan.id}/result`}>
            <Button size="sm" variant="ghost" trailingIcon={<ExternalLink />}>
              Open scan
            </Button>
          </Link>
        )}
        {batch && (
          <Link href={`/batches/${batch.id}`}>
            <Button size="sm" variant="ghost" trailingIcon={<ExternalLink />}>
              Open batch
            </Button>
          </Link>
        )}
        <Button size="sm" variant="secondary" leadingIcon={<FileDown />}>
          Receipt
        </Button>
      </div>
    </div>
  );
}
