"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, ExternalLink, FileSearch } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { MOCK_USERS } from "@/lib/mock-api/fixtures/users";
import { MOCK_TRANSACTIONS } from "@/lib/mock-api/fixtures/transactions";
import { formatTimeOfDay, formatNGN } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function RegulatorFeed() {
  const flagged = MOCK_TRANSACTIONS.filter((t) => t.type === "fraud_blocked");
  const ghosts = MOCK_USERS.filter((u) => u.ghostVendor);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card padded>
        <div className="flex items-start justify-between pb-3">
          <div>
            <CardTitle>Live flagged scans</CardTitle>
            <CardDescription>
              Cross-network forensic verdicts that triggered settlement blocks.
            </CardDescription>
          </div>
          <Badge status="risk" size="sm" dot>
            {flagged.length} open
          </Badge>
        </div>
        <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
          {flagged.map((t) => {
            const sev =
              (t.verdictScore ?? 100) < 45
                ? "critical"
                : (t.verdictScore ?? 100) < 60
                  ? "high"
                  : "medium";
            return (
              <li
                key={t.id}
                className="rounded-[10px] border border-[var(--risk-border)] bg-[var(--risk-soft)]/40 px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SevBadge sev={sev} />
                      <p className="text-small font-medium text-[var(--text-primary)] truncate">
                        Settlement blocked — {t.fromName} → {t.toName}
                      </p>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {t.blockReason}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                      <span>
                        <MonoText size="sm">
                          {formatTimeOfDay(t.timestamp)}
                        </MonoText>
                      </span>
                      <span>·</span>
                      <span>
                        amount{" "}
                        <MonoText size="sm" className="text-[var(--risk)]">
                          {formatNGN(t.amount)}
                        </MonoText>
                      </span>
                      <span>·</span>
                      <span>
                        consensus{" "}
                        <MonoText size="sm">{t.verdictScore?.toFixed(1)}</MonoText>
                      </span>
                    </div>
                  </div>
                  <Link href={`/transactions/${t.id}`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      trailingIcon={<ExternalLink />}
                    >
                      Investigate
                    </Button>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card padded>
        <div className="flex items-start justify-between pb-3">
          <div>
            <CardTitle>Suspended vendors</CardTitle>
            <CardDescription>Trust score floor breached.</CardDescription>
          </div>
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--risk)]" />
        </div>
        <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
          {ghosts.map((g, i) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2.5"
            >
              <MonoText
                size="sm"
                className="w-5 text-center text-[var(--text-tertiary)]"
              >
                {i + 1}
              </MonoText>
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium text-[var(--text-primary)] truncate">
                  {g.organization}
                </p>
                <MonoText size="sm" className="text-[var(--text-tertiary)]">
                  {g.id}
                </MonoText>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  Reason: {g.ghostVendor === "tin_cac_mismatch"
                    ? "FIRS TIN / CAC mismatch"
                    : "Residential address resolution"}
                </p>
              </div>
              <Badge status="risk" size="sm" dot>
                {g.trustScore.toFixed(1)}
              </Badge>
            </li>
          ))}
          <li className="pt-2 border-t border-[var(--border-hairline)]">
            <Link href="/risk">
              <Button
                size="sm"
                variant="ghost"
                leadingIcon={<FileSearch />}
                className="w-full justify-center"
              >
                Open full risk feed
              </Button>
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function SevBadge({ sev }: { sev: "critical" | "high" | "medium" }) {
  return (
    <span
      className={cn(
        "rounded-[3px] px-1 py-px font-mono-ui text-[10px] uppercase tracking-[0.06em]",
        sev === "critical" &&
          "bg-[var(--risk)] text-[var(--bg-base)]",
        sev === "high" && "bg-[var(--risk-soft)] text-[var(--risk)] border border-[var(--risk-border)]",
        sev === "medium" &&
          "bg-[var(--pending-soft)] text-[var(--pending)] border border-[var(--pending-border)]"
      )}
    >
      {sev}
    </span>
  );
}
