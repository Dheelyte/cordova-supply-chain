"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, ShieldCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { SettlementCard } from "@/components/settlement/SettlementCard";
import { useWallet } from "@/stores/wallet";
import { useSquadWalletBalance } from "@/hooks/use-squad-wallet";
import { formatNGN, formatTimeOfDay } from "@/lib/utils/format";

// 14-day balance trend (deterministic-ish)
function balanceSeries(current: number): number[] {
  const out: number[] = [];
  let v = current * 0.84;
  for (let i = 0; i < 14; i++) {
    v *= 1 + (Math.sin(i * 1.7) * 0.03 + (Math.random() - 0.5) * 0.02);
    out.push(Math.round(v));
  }
  out[out.length - 1] = current;
  return out;
}

export default function WalletPage() {
  // const localBalance = useWallet((s) => s.balance);
  const pending = useWallet((s) => s.pending);
  const ledger = useWallet((s) => s.ledger);
  const linkedBank = useWallet((s) => s.linkedBank);
  const nubanMasked = useWallet((s) => s.nubanMasked);
  // Live balance from SquadCo `/wallet/`. While loading, fall back to the
  // local demo balance so the UI never flashes empty.
  const liveWallet = useSquadWalletBalance();
  const balance = liveWallet.data?.balance ?? 0;

  const recentInflows = ledger
    .filter((t) => t.type === "validated" && t.toName === "Lagos Pharma Ltd")
    .slice(0, 3);
  const recentOutflows = ledger
    .filter(
      (t) =>
        t.type === "validated" &&
        t.fromName === "Lagos Pharma Ltd" &&
        t.toName !== "Lagos Pharma Ltd"
    )
    .slice(0, 3);

  const series = React.useMemo(() => balanceSeries(balance), [balance]);

  return (
    <div>
      <PageHeader
        eyebrow="Settlement · Squad-linked"
        title="Wallet"
        description="Forensic-gated treasury. Every transfer must pass AI verdict + ledger path before money moves."
      />

      <div className="mt-6 grid gap-4">
        {/* Balance + spark */}
        <Card emphasized padded>
          <div className="flex items-start justify-between pb-3">
            <div>
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Available balance
              </p>
              <MonoText size="lg" className="mt-1 block text-[40px] leading-none tracking-[-0.02em]">
                {formatNGN(balance)}
              </MonoText>
            </div>
            <Badge status="verified" dot>
              {linkedBank}
            </Badge>
          </div>
          <div className="flex items-end gap-4 border-t border-[var(--border-hairline)] pt-4">
            <div className="flex-1">
              <p className="text-caption uppercase text-[var(--text-tertiary)] mb-1">
                14d trend
              </p>
              <Sparkline data={series} color="var(--accent)" height={48} unit="NGN" />
            </div>
            <div className="text-right">
              <p className="text-caption uppercase text-[var(--text-tertiary)]">
                Linked account
              </p>
              <MonoText size="sm" className="text-[var(--text-secondary)]">
                {nubanMasked}
              </MonoText>
            </div>
          </div>
        </Card>

      </div>

      {/* Pending settlements */}
      <section className="mt-8">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h2 className="text-h2">Pending settlements</h2>
            <p className="text-small text-[var(--text-secondary)]">
              {pending.length} awaiting your release · gated on AI verdict + ledger path.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge status="accent" dot>
              {pending.filter((p) => p.aiVerdict === "PASS" && p.ledgerPath === "PASS").length} ready
            </Badge>
            <Badge status="pending" dot>
              {pending.filter((p) => p.aiVerdict === "REVIEW").length} review
            </Badge>
            <Badge status="risk" dot>
              {pending.filter((p) => p.aiVerdict === "FAIL" || p.ledgerPath === "FAIL").length} blocked
            </Badge>
          </div>
        </div>
        {pending.length === 0 ? (
          <Card inset padded className="text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-[var(--text-tertiary)]" />
            <p className="mt-2 text-small text-[var(--text-secondary)]">
              No pending settlements. Every authorised payment has cleared.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((p) => (
              <SettlementCard key={p.id} settlement={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FlowColumn({
  title,
  icon,
  tint,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tint: "verified" | "info";
  children: React.ReactNode;
}) {
  const color = tint === "verified" ? "var(--verified)" : "var(--info)";
  return (
    <div>
      <div className="flex items-center gap-1.5 pb-2">
        <span style={{ color }} className="[&>svg]:h-3 [&>svg]:w-3">
          {icon}
        </span>
        <p className="text-caption uppercase" style={{ color }}>
          {title}
        </p>
      </div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function FlowRow({
  who,
  amount,
  ts,
  positive,
}: {
  who: string;
  amount: number;
  ts: string;
  positive?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--text-primary)] truncate">{who}</p>
        <MonoText size="sm" className="text-[var(--text-tertiary)]">
          {formatTimeOfDay(ts)}
        </MonoText>
      </div>
      <MonoText
        size="sm"
        className={positive ? "text-[var(--verified)]" : "text-[var(--text-primary)]"}
      >
        {positive ? "+" : "−"}{formatNGN(amount)}
      </MonoText>
    </li>
  );
}
