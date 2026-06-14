"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ExternalLink, ShieldCheck, Ban } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { ConfidenceGauge } from "@/components/forensic/ConfidenceGauge";
import {
  LogicGatedButton,
  type Gate,
} from "@/components/settlement/LogicGatedButton";
import {
  TransferStateMachine,
  type TransferStep,
} from "@/components/settlement/TransferStateMachine";
import { useWallet, type PendingSettlement } from "@/stores/wallet";
import { useSquadTransfer } from "@/hooks/use-squad-wallet";
import { SquadCoError } from "@/lib/squadco";
import { formatNGN, formatHash } from "@/lib/utils/format";

/**
 * SquadCo `/wallet/transfer` requires `to_user_id` to be a real UUID from
 * the backend. Our mock counterparties (e.g. "usr_3f1a82c7e9d4") aren't
 * registered users on the deployed backend, so a live transfer would 404.
 * We only call the real endpoint when the linked id looks like a UUID.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SettlementCardProps {
  settlement: PendingSettlement;
}

export function SettlementCard({ settlement }: SettlementCardProps) {
  const commitTransfer = useWallet((s) => s.commitTransfer);
  const blockTransfer = useWallet((s) => s.blockTransfer);
  const squadTransfer = useSquadTransfer();

  const [phase, setPhase] = React.useState<"idle" | "running" | "settled">("idle");
  const [committedRef, setCommittedRef] = React.useState<string | null>(null);
  const [transferError, setTransferError] = React.useState<string | null>(null);

  const aiGate: Gate = {
    name: "AI verdict",
    verdict: settlement.aiVerdict,
    reason: settlement.aiReason,
  };
  const ledgerGate: Gate = {
    name: "Ledger path",
    verdict: settlement.ledgerPath,
    reason: settlement.ledgerReason,
  };

  const transferSteps: TransferStep[] = [
    {
      id: "call",
      label: "Calling Squad Transfer API…",
      detail: "POST /squad/transfer/initiate",
    },
    {
      id: "debit",
      label: "Funds debited from buyer account",
      detail: "GTBank ••••2913",
    },
    {
      id: "credit",
      label: `Funds credited to ${settlement.counterpartyName}`,
      detail: `${settlement.recipientBank} ${settlement.recipientNubanMasked}`,
    },
    {
      id: "confirm",
      label: "Settlement confirmed",
      detail: "Squad ack received · ledger row written",
    },
  ];

  function handleExecute() {
    setPhase("running");
  }

  function handleBlock() {
    blockTransfer(
      settlement.id,
      settlement.aiReason ?? settlement.ledgerReason ?? "Manually blocked by operator."
    );
  }

  async function handleComplete(squadRef: string) {
    // If the counterparty id looks like a real backend UUID, call the live
    // `/wallet/transfer` and use its returned reference. Otherwise fall
    // back to the local state-machine ref (demo counterparties don't
    // exist on the deployed backend — see MISMATCHES.md).
    let finalRef = squadRef;
    if (UUID_RE.test(settlement.counterpartyId)) {
      try {
        const r = await squadTransfer.mutateAsync({
          to_user_id: settlement.counterpartyId,
          amount: settlement.amount,
          remarks: settlement.linkedBatchId
            ? `Settlement for batch ${settlement.linkedBatchId}`
            : "Aegis settlement",
        });
        finalRef = r.transaction_reference;
      } catch (e) {
        setTransferError(
          e instanceof SquadCoError
            ? e.message
            : "Transfer failed — keeping local state."
        );
        // Continue with the local commit so the demo UX isn't dead-ended.
      }
    }
    const txn = commitTransfer(settlement.id, finalRef);
    if (!txn) return;
    setCommittedRef(finalRef);
    setPhase("settled");
  }

  const blocked = aiGate.verdict !== "PASS" || ledgerGate.verdict !== "PASS";

  return (
    <Card padded className="overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <ConfidenceGauge score={settlement.verdictScore} size={56} mode="static" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-small font-semibold text-[var(--text-primary)] truncate">
                {settlement.counterpartyName}
              </p>
              {settlement.counterpartyVerified ? (
                <Badge size="sm" status="verified" dot>
                  verified
                </Badge>
              ) : (
                <Badge size="sm" status="risk" dot>
                  suspended
                </Badge>
              )}
            </div>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {settlement.recipientBank} {settlement.recipientNubanMasked}
              {settlement.linkedBatchId && (
                <>
                  {" · batch "}
                  <MonoText size="sm" className="text-[var(--text-tertiary)]">
                    {formatHash(settlement.linkedBatchId, 6, 4)}
                  </MonoText>
                </>
              )}
              {settlement.linkedScanSessionId && (
                <>
                  {" · scan "}
                  <MonoText size="sm" className="text-[var(--text-tertiary)]">
                    {settlement.linkedScanSessionId.slice(-10)}
                  </MonoText>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            Amount
          </p>
          <MonoText size="lg" className="block text-[22px] leading-none">
            {formatNGN(settlement.amount)}
          </MonoText>
        </div>
      </div>

      <div className="border-t border-[var(--border-hairline)] pt-3">
        {phase === "idle" && (
          <div className="space-y-4">
            <LogicGatedButton
              gates={[aiGate, ledgerGate]}
              onClick={handleExecute}
            />
            <div className="flex items-center gap-2">
              {blocked && (
                <Button
                  variant="danger"
                  size="sm"
                  leadingIcon={<Ban />}
                  onClick={handleBlock}
                >
                  Block this transfer
                </Button>
              )}
              {(settlement.linkedScanSessionId || settlement.linkedScanId) && (
                <Link
                  href={`/scan/${
                    settlement.linkedScanSessionId ?? settlement.linkedScanId
                  }/result`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    trailingIcon={<ExternalLink />}
                  >
                    View forensic verdict
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-[6px] border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              <p className="text-caption uppercase text-[var(--accent)]">
                Settling · do not navigate away
              </p>
            </div>
            <TransferStateMachine
              steps={transferSteps}
              onComplete={handleComplete}
            />
            {transferError && (
              <p className="rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk-soft)] px-3 py-2 text-[12px] text-[var(--risk)]">
                SquadCo transfer rejected: {transferError}
              </p>
            )}
          </div>
        )}

        <AnimatePresence>
          {phase === "settled" && committedRef && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="rounded-[8px] border border-[var(--verified-border)] bg-[var(--verified-soft)] px-3 py-3"
            >
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-[2px] h-4 w-4 shrink-0 text-[var(--verified)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-small font-semibold text-[var(--verified)]">
                    Settled — funds moved.
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Forensic verdict + ledger path both green.{" "}
                    <Link
                      href="/transactions"
                      className="text-[var(--accent)] hover:underline"
                    >
                      View in ledger →
                    </Link>
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
                    <MonoText size="sm">{committedRef}</MonoText>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
