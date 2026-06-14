"use client";

import * as React from "react";
import Link from "next/link";
import { ScanLine, CheckCircle2, XCircle, MapPin, Navigation } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { SCAN_FIXTURES } from "@/lib/mock-api/fixtures/scans";
import { formatTimeOfDay } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const NEARBY_PHARMACIES = [
  { name: "HealthPlus · Victoria Island", distance: "0.4 km", trust: 91.5 },
  { name: "Medplus · Lekki Phase 1", distance: "2.1 km", trust: 89.2 },
  { name: "ChemCare · Yaba", distance: "3.8 km", trust: 84.7 },
  { name: "Pharmacy Plus · Ikeja", distance: "4.6 km", trust: 88.1 },
  { name: "Wellness Mart · Ajah", distance: "4.9 km", trust: 86.4 },
];

export function ConsumerScanCta() {
  // Recent scans — mix of pass/fail/borderline
  const recent = SCAN_FIXTURES.slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <Card emphasized className="relative overflow-hidden" padded>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--accent-soft),transparent_55%)] pointer-events-none" />
          <div className="relative flex items-center justify-between gap-6">
            <div>
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Verify a product
              </p>
              <h2 className="text-h1 mt-1 text-[var(--text-primary)]">
                Scan a pack.
              </h2>
              <p className="text-body mt-2 max-w-[420px] text-[var(--text-secondary)]">
                Hold your camera over the pharmaceutical packaging. Aegis runs
                the same forensic verdict pharmacies see.
              </p>
              <Link href="/scan" className="mt-5 inline-block">
                <Button
                  variant="primary"
                  size="lg"
                  leadingIcon={<ScanLine />}
                >
                  Open scanner
                </Button>
              </Link>
            </div>
            <div className="hidden h-32 w-32 shrink-0 items-center justify-center md:flex">
              <div className="relative h-full w-full">
                <div className="absolute inset-0 rounded-[18px] border border-[var(--border-strong)] bg-[var(--bg-inset)]" />
                <div className="absolute inset-3 rounded-[12px] border border-dashed border-[var(--accent-border)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine className="h-10 w-10 text-[var(--accent)]" />
                </div>
                {/* Corner ticks */}
                {(["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"] as const).map((pos) => (
                  <span
                    key={pos}
                    className={cn(
                      "absolute h-3 w-3 border-[var(--accent)]",
                      pos,
                      pos.includes("top") ? "border-t-2" : "border-b-2",
                      pos.includes("left") ? "border-l-2" : "border-r-2"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card padded>
          <div className="flex items-start justify-between pb-3">
            <div>
              <CardTitle>Recent scans</CardTitle>
              <CardDescription>Your verification history.</CardDescription>
            </div>
            <Link href="/transactions">
              <Button size="sm" variant="ghost">
                View all
              </Button>
            </Link>
          </div>
          <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
            {recent.map((s) => {
              const verdict = s.verdict;
              const isPass = verdict === "PASS";
              const isFail = verdict === "FAIL";
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-[6px] border",
                      isPass &&
                        "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]",
                      isFail &&
                        "border-[var(--risk-border)] bg-[var(--risk-soft)] text-[var(--risk)]",
                      !isPass &&
                        !isFail &&
                        "border-[var(--pending-border)] bg-[var(--pending-soft)] text-[var(--pending)]"
                    )}
                  >
                    {isPass ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isFail ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <ScanLine className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-small font-medium text-[var(--text-primary)] truncate">
                      {s.productName}
                    </p>
                    <MonoText size="sm" className="text-[var(--text-tertiary)]">
                      {formatTimeOfDay(s.capturedAt)} · consensus {s.consensusScore}
                    </MonoText>
                  </div>
                  <Badge
                    status={isPass ? "verified" : isFail ? "risk" : "pending"}
                    size="sm"
                    dot
                  >
                    {verdict}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card padded>
        <div className="flex items-start justify-between pb-3">
          <div>
            <CardTitle>Verified pharmacies nearby</CardTitle>
            <CardDescription>
              5 closest within 5 km · ranked by trust.
            </CardDescription>
          </div>
          <Navigation className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        </div>
        <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
          {NEARBY_PHARMACIES.map((p, i) => (
            <li
              key={p.name}
              className="flex items-center gap-3 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-2"
            >
              <MonoText
                size="sm"
                className="w-5 text-center text-[var(--text-tertiary)]"
              >
                {i + 1}
              </MonoText>
              <div className="min-w-0 flex-1">
                <p className="text-small font-medium text-[var(--text-primary)] truncate">
                  {p.name}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
                  <MapPin className="h-3 w-3" /> {p.distance}
                </div>
              </div>
              <Badge status="verified" size="sm" dot>
                {p.trust.toFixed(1)}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
