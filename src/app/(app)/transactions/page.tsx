"use client";

import * as React from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { CounterTile } from "@/components/transactions/CounterTile";
import { TransactionsTable } from "@/components/transactions/TransactionsTable";
import { useSquadWalletTransactions } from "@/hooks/use-squad-wallet";
import { adaptWalletTransaction } from "@/lib/squadco/adapters";
import { useAuth } from "@/stores/auth";

type TypeFilter = "all" | "validated" | "fraud_blocked" | "pending";

function spark(seed: number, base: number, points = 12, drift = 0.12): number[] {
  const out: number[] = [];
  let v = base * 0.82;
  for (let i = 0; i < points; i++) {
    v *= 1 + Math.sin((seed + i) * 1.4) * drift + (Math.random() - 0.5) * 0.04;
    out.push(Math.max(0, Math.round(v)));
  }
  out[out.length - 1] = base;
  return out;
}

export default function TransactionsPage() {
  const session = useAuth((s) => s.session);
  const [page, setPage] = React.useState(1);
  const PER_PAGE = 50;
  const txns = useSquadWalletTransactions(page, PER_PAGE);

  // Adapt backend rows into the frontend's display shape. Unknown fields
  // (counterparty, forensic linkage) are placeholders — see
  // adapters.ts + MISMATCHES.md #4 and #6.
  const ledger = React.useMemo(() => {
    const rows = txns.data?.transactions ?? [];
    return rows.map((t) =>
      adaptWalletTransaction(
        t,
        session?.userId ?? "",
        session?.name ?? "You"
      )
    );
  }, [txns.data, session]);

  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [counterparty, setCounterparty] = React.useState<string>("all");
  const [from, setFrom] = React.useState<string>("");
  const [to, setTo] = React.useState<string>("");

  // YTD totals from real data only — no historical baseline now that we're
  // wired to the backend. Running sum across the current page; a future
  // /wallet/totals endpoint could surface lifetime numbers cheaply.
  const ytd = React.useMemo(() => {
    const validatedLive = ledger
      .filter((t) => t.type === "validated")
      .reduce((s, t) => s + t.amount, 0);
    const blockedLive = ledger
      .filter((t) => t.type === "fraud_blocked")
      .reduce((s, t) => s + t.amount, 0);
    return { validated: validatedLive, blocked: blockedLive };
  }, [ledger]);

  const counterparties = React.useMemo(() => {
    const set = new Set<string>();
    ledger.forEach((t) => {
      set.add(t.fromName);
      set.add(t.toName);
    });
    return Array.from(set).sort();
  }, [ledger]);

  const filtered = React.useMemo(() => {
    return ledger.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (counterparty !== "all" && t.fromName !== counterparty && t.toName !== counterparty)
        return false;
      if (from) {
        if (new Date(t.timestamp) < new Date(from)) return false;
      }
      if (to) {
        if (new Date(t.timestamp) > new Date(`${to}T23:59:59.999Z`)) return false;
      }
      return true;
    });
  }, [ledger, typeFilter, counterparty, from, to]);

  const clear = () => {
    setTypeFilter("all");
    setCounterparty("all");
    setFrom("");
    setTo("");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Ledger · SquadCo wallet"
        title="Transactions"
        description="Live CREDIT/DEBIT history from your SquadCo virtual account."
      />

      {txns.isLoading && !txns.data && (
        <div className="mt-4 rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
          Loading transactions from SquadCo…
        </div>
      )}
      {txns.error && (
        <div className="mt-4 rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk-soft)] px-3 py-2 text-[12px] text-[var(--risk)]">
          Failed to load transactions:{" "}
          {(txns.error as Error).message}. Make sure you're signed in.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <CounterTile
          label="Validated payments · YTD"
          amount={ytd.validated}
          tone="verified"
          caption="Settled with both AI verdict and ledger path green."
          series={spark(7, ytd.validated)}
          badge={`+${ledger.filter((t) => t.type === "validated").length} this session`}
        />
        <CounterTile
          label="Fraud blocked · YTD"
          amount={ytd.blocked}
          tone="risk"
          caption="Settlements automatically halted at the wire."
          series={spark(13, ytd.blocked)}
          badge={`${ledger.filter((t) => t.type === "fraud_blocked").length} blocked`}
        />
      </div>

      {/* Filters */}
      <Card padded className="mt-6">
        <div className="flex items-center justify-between pb-3">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Filters
          </p>
          <Button size="sm" variant="ghost" onClick={clear}>
            Clear all
          </Button>
        </div>
        <div className="grid gap-3 border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Type">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">All types</option>
              <option value="validated">Validated</option>
              <option value="fraud_blocked">Fraud-blocked</option>
              <option value="pending">Pending</option>
            </Select>
          </FormField>
          <FormField label="Counterparty">
            <Select
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            >
              <option value="all">All counterparties</option>
              {counterparties.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="From">
            <Input
              type="date"
              mono
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </FormField>
          <FormField label="To">
            <Input
              type="date"
              mono
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </FormField>
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge status="verified" size="sm" dot>
            {ledger.filter((t) => t.type === "validated").length} validated
          </Badge>
          <Badge status="risk" size="sm" dot>
            {ledger.filter((t) => t.type === "fraud_blocked").length} blocked
          </Badge>
          <Badge status="pending" size="sm" dot>
            {ledger.filter((t) => t.type === "pending").length} pending
          </Badge>
        </div>
        <p className="text-caption uppercase text-[var(--text-tertiary)]">
          showing <MonoText size="sm">{filtered.length}</MonoText> of{" "}
          <MonoText size="sm">{ledger.length}</MonoText>
        </p>
      </div>

      <div className="mt-2">
        <TransactionsTable data={filtered} />
      </div>

      {txns.data && txns.data.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Page <MonoText size="sm">{txns.data.current_page}</MonoText> of{" "}
            <MonoText size="sm">{txns.data.total_pages}</MonoText> ·{" "}
            <MonoText size="sm">{txns.data.total_items}</MonoText> total
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= txns.data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
