"use client";

import * as React from "react";
import { ShieldAlert, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Sparkline } from "./Sparkline";
import { useAuth } from "@/stores/auth";
import { formatNGN } from "@/lib/utils/format";

// 30-day jitter centered on the user's trust score
function buildTrustSeries(score: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 30; i++) {
    const drift = Math.sin(i / 3.1) * 1.4 + (Math.random() - 0.5) * 0.8;
    out.push(Math.max(0, Math.min(100, score + drift - 2)));
  }
  out[out.length - 1] = score;
  return out;
}

export function TopStrip({
  walletBalance = 4_750_000,
  activeAlerts = 0,
}: {
  walletBalance?: number;
  activeAlerts?: number;
}) {
  const session = useAuth((s) => s.session);
  const series = React.useMemo(
    () => buildTrustSeries(session?.trustScore ?? 80),
    [session?.trustScore]
  );

  if (!session) return null;

  const tier = session.tier;
  const tierColor =
    tier === "verified"
      ? "var(--verified)"
      : tier === "limited"
        ? "var(--pending)"
        : "var(--risk)";

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {/* Trust Score */}
      <Card padded>
        <div className="flex items-start justify-between pb-2">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Trust score · 30d
          </p>
          <Badge
            status={
              tier === "verified" ? "verified" : tier === "limited" ? "pending" : "risk"
            }
            size="sm"
            dot
          >
            {tier}
          </Badge>
        </div>
        <div className="flex items-end gap-3">
          <MonoText size="lg" className="text-[26px] leading-none">
            {session.trustScore.toFixed(1)}
          </MonoText>
          <div className="flex-1 -mb-1">
            <Sparkline data={series} color={tierColor} height={28} />
          </div>
        </div>
      </Card>

      {/* Active alerts */}
      <Card padded>
        <div className="flex items-start justify-between pb-2">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Active alerts
          </p>
          <ShieldAlert className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        </div>
        <div className="flex items-baseline gap-2">
          <MonoText
            size="lg"
            className="text-[26px] leading-none"
            style={
              activeAlerts > 0
                ? { color: "var(--risk)" }
                : { color: "var(--text-primary)" }
            }
          >
            {activeAlerts}
          </MonoText>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            {activeAlerts === 0 ? "no open alerts" : "open · review now"}
          </p>
        </div>
      </Card>

      {/* Wallet balance */}
      <Card padded>
        <div className="flex items-start justify-between pb-2">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Wallet balance
          </p>
          <Wallet className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <MonoText size="lg" className="text-[26px] leading-none">
            {formatNGN(walletBalance)}
          </MonoText>
          <p className="text-[11px] text-[var(--text-tertiary)]">GTBank ••••2913</p>
        </div>
      </Card>
    </div>
  );
}
