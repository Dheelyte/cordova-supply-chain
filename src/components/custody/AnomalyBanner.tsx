"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MonoText } from "@/components/ui/MonoText";
import { Card } from "@/components/ui/Card";
import type { MockBatch } from "@/lib/mock-api/fixtures/batches";
import { cn } from "@/lib/utils/cn";

export interface AnomalyBannerProps {
  batch: MockBatch;
  className?: string;
}

export function AnomalyBanner({ batch, className }: AnomalyBannerProps) {
  const [open, setOpen] = React.useState(false);
  const anomalousHop = batch.custody.find((h) => h.anomaly);
  if (!anomalousHop || !anomalousHop.anomaly) return null;
  const a = anomalousHop.anomaly;

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-3 rounded-[10px] border border-[var(--risk-border)] bg-[var(--risk-soft)]/40 px-4 py-3",
          className
        )}
      >
        <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-[var(--risk)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-small font-semibold text-[var(--risk)]">
              Anomaly detected · {a.kind.replace(/_/g, " ")}
            </p>
            <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
              hop {batch.custody.indexOf(anomalousHop) + 1}
            </span>
          </div>
          <p className="mt-0.5 text-small text-[var(--text-secondary)]">
            {a.detail}
          </p>
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={() => setOpen(true)}
          trailingIcon={<ExternalLink />}
        >
          View anomaly report
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <Card
            emphasized
            className="relative w-full max-w-[640px] border-[var(--risk-border)]"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3">
              <div>
                <p className="text-caption uppercase text-[var(--risk)]">
                  Anomaly report
                </p>
                <h2 className="text-h2 mt-1">{a.kind.replace(/_/g, " ")}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-body text-[var(--text-secondary)]">{a.detail}</p>

            {a.distanceKm && a.claimedMinutes && a.minimumMinutes && (
              <div className="mt-5 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-4">
                <p className="text-caption uppercase text-[var(--text-tertiary)] mb-3">
                  The math
                </p>
                <dl className="space-y-2 text-small">
                  <Row label="Great-circle distance">
                    <MonoText>{a.distanceKm.toLocaleString()} km</MonoText>
                  </Row>
                  <Row label="Claimed elapsed time">
                    <MonoText className="text-[var(--risk)]">
                      {a.claimedMinutes} minutes
                    </MonoText>
                  </Row>
                  <Row label="Minimum feasible (commercial air)">
                    <MonoText>{a.minimumMinutes} minutes</MonoText>
                  </Row>
                  <Row label="Implied speed">
                    <MonoText className="text-[var(--risk)]">
                      {Math.round(
                        (a.distanceKm / a.claimedMinutes) * 60
                      ).toLocaleString()}{" "}
                      km/h
                    </MonoText>
                  </Row>
                  <Row label="Conclusion">
                    <span className="text-[var(--risk)] font-medium">
                      Physically impossible
                    </span>
                  </Row>
                </dl>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button variant="danger">Escalate to NAFDAC</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-[var(--text-tertiary)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
