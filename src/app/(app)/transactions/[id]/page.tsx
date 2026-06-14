"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Hourglass,
  ArrowLeft,
  FileDown,
  Flag,
  Copy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { EvidencePanel } from "@/components/transactions/EvidencePanel";
import { useWallet } from "@/stores/wallet";
import { findUser } from "@/lib/mock-api/fixtures/users";
import { formatNGN, formatTimeOfDay } from "@/lib/utils/format";
import { format } from "date-fns";

export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const ledger = useWallet((s) => s.ledger);
  const txn = ledger.find((t) => t.id === params.id);

  if (!txn) {
    return (
      <div className="mt-12 text-center">
        <p className="text-h3 text-[var(--text-secondary)]">
          Transaction not found in this ledger.
        </p>
        <Link href="/transactions">
          <Button variant="ghost" leadingIcon={<ArrowLeft />} className="mt-4">
            Back to ledger
          </Button>
        </Link>
      </div>
    );
  }

  const isFraud = txn.type === "fraud_blocked";
  const isPending = txn.type === "pending";
  const counterparty = findUser(txn.toUserId);

  const status = isFraud
    ? {
        label: "Fraud-blocked",
        tone: "risk" as const,
        icon: <XCircle className="h-3.5 w-3.5" />,
      }
    : isPending
      ? {
          label: "Pending",
          tone: "pending" as const,
          icon: <Hourglass className="h-3.5 w-3.5" />,
        }
      : {
          label: "Validated",
          tone: "verified" as const,
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        };

  return (
    <div>
      <PageHeader
        eyebrow="Ledger · transaction"
        title={
          isFraud
            ? "Fraud blocked at the wire"
            : isPending
              ? "Settlement pending"
              : "Settlement validated"
        }
        description={`${txn.fromName} → ${txn.toName}`}
        actions={
          <>
            <Button variant="ghost" leadingIcon={<ArrowLeft />} onClick={() => router.back()}>
              Back
            </Button>
            <Button variant="secondary" leadingIcon={<FileDown />}>
              Download receipt
            </Button>
            {!isFraud && (
              <Button variant="danger" leadingIcon={<Flag />}>
                Dispute
              </Button>
            )}
          </>
        }
      />

      {/* Status banner */}
      <div
        className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border px-3.5 py-3"
        style={{
          borderColor:
            status.tone === "verified"
              ? "var(--verified-border)"
              : status.tone === "risk"
                ? "var(--risk-border)"
                : "var(--pending-border)",
          background:
            status.tone === "verified"
              ? "var(--verified-soft)"
              : status.tone === "risk"
                ? "var(--risk-soft)"
                : "var(--pending-soft)",
        }}
      >
        <Badge status={status.tone} dot>
          {status.icon}
          {status.label}
        </Badge>
        <MonoText size="sm" className="text-[var(--text-secondary)]">
          {txn.id}
        </MonoText>
        {txn.squadRef && (
          <>
            <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
              Squad ref
            </span>
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              {txn.squadRef}
            </MonoText>
          </>
        )}
        <Button size="sm" variant="ghost" leadingIcon={<Copy />}>
          Copy
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Money path */}
        <Card padded>
          <div className="pb-3">
            <CardTitle>Money path</CardTitle>
            <CardDescription>
              Buyer → counterparty via Squad Transfer API.
            </CardDescription>
          </div>
          <div className="grid gap-3 border-t border-[var(--border-hairline)] pt-4 sm:grid-cols-2">
            <PartyCell title="Buyer" name={txn.fromName} sub="Lagos Pharma Ltd · GTBank ••••2913" />
            <PartyCell
              title="Counterparty"
              name={txn.toName}
              sub={
                counterparty
                  ? `${counterparty.bankName} ${txn.recipientNubanMasked ?? ""}`
                  : (txn.recipientBank ?? "—")
              }
              flagged={counterparty?.verificationStatus === "suspended"}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 border-t border-[var(--border-hairline)] pt-4">
            <Cell label="Amount">
              <MonoText
                className={isFraud ? "text-[var(--risk)]" : "text-[var(--text-primary)]"}
                size="lg"
              >
                {isFraud ? "−" : ""}
                {formatNGN(txn.amount)}
              </MonoText>
            </Cell>
            <Cell label="Date">
              <MonoText size="sm">
                {format(new Date(txn.timestamp), "yyyy-MM-dd")}
              </MonoText>
            </Cell>
            <Cell label="Time">
              <MonoText size="sm">{formatTimeOfDay(txn.timestamp)}</MonoText>
            </Cell>
          </div>

          {txn.blockReason && (
            <div className="mt-4 rounded-[8px] border border-[var(--risk-border)] bg-[var(--risk-soft)]/40 px-3 py-2.5">
              <p className="text-caption uppercase text-[var(--risk)]">
                Block reason
              </p>
              <p className="mt-1 text-small text-[var(--text-secondary)]">
                {txn.blockReason}
              </p>
            </div>
          )}
        </Card>

        {/* Forensic evidence */}
        <Card padded>
          <div className="pb-3">
            <CardTitle>Forensic evidence</CardTitle>
            <CardDescription>
              The verdict and custody trail that gated this transfer.
            </CardDescription>
          </div>
          <div className="border-t border-[var(--border-hairline)] pt-4">
            <EvidencePanel txn={txn} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function PartyCell({
  title,
  name,
  sub,
  flagged,
}: {
  title: string;
  name: string;
  sub: string;
  flagged?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-3">
      <p className="text-caption uppercase text-[var(--text-tertiary)]">
        {title}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-small font-semibold text-[var(--text-primary)]">{name}</p>
        {flagged ? (
          <Badge status="risk" size="sm" dot>
            suspended
          </Badge>
        ) : (
          <Badge status="verified" size="sm" dot>
            verified
          </Badge>
        )}
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{sub}</p>
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption uppercase text-[var(--text-tertiary)]">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
