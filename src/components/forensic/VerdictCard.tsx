"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Ban,
  Flag,
  FileDown,
  ArrowRight,
  KeyRound,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import type { Verdict } from "@/lib/mock-api/fixtures/scans";
import { cn } from "@/lib/utils/cn";

export interface VerdictCardProps {
  verdict: Verdict;
  score: number;
  summary: string;
  /** Called when the user accepts a PASS / scratch-promoted PASS */
  onAccept?: () => void;
  /** Called when the user blocks the transfer */
  onBlock?: () => void;
}

export function VerdictCard({
  verdict,
  score,
  summary,
  onAccept,
  onBlock,
}: VerdictCardProps) {
  // For REVIEW (60-84), the user must enter a scratch code; correct = escalate to PASS,
  // wrong 3× = escalate to FAIL.
  const [scratchOpen, setScratchOpen] = React.useState(false);
  const [resolvedVerdict, setResolvedVerdict] = React.useState<Verdict>(verdict);

  React.useEffect(() => setResolvedVerdict(verdict), [verdict]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
      >
        <Card
          emphasized
          padded
          className={cn(
            resolvedVerdict === "PASS" && "border-[var(--verified-border)]",
            resolvedVerdict === "REVIEW" && "border-[var(--pending-border)]",
            resolvedVerdict === "FAIL" && "border-[var(--risk-border)]"
          )}
          style={{
            background:
              resolvedVerdict === "PASS"
                ? "linear-gradient(180deg, var(--verified-soft), transparent)"
                : resolvedVerdict === "REVIEW"
                  ? "linear-gradient(180deg, var(--pending-soft), transparent)"
                  : "linear-gradient(180deg, var(--risk-soft), transparent)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <VerdictIcon verdict={resolvedVerdict} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-h2 leading-none">
                    {resolvedVerdict === "PASS"
                      ? "Verdict · PASS"
                      : resolvedVerdict === "REVIEW"
                        ? "Verdict · REVIEW"
                        : "Verdict · FAIL"}
                  </h2>
                  <Badge
                    status={
                      resolvedVerdict === "PASS"
                        ? "verified"
                        : resolvedVerdict === "REVIEW"
                          ? "pending"
                          : "risk"
                    }
                    dot
                  >
                    consensus {score.toFixed(1)}
                  </Badge>
                </div>
                <p className="mt-2 text-body text-[var(--text-secondary)] max-w-[640px]">
                  {summary}
                </p>
              </div>
            </div>

            {resolvedVerdict === "PASS" && (
              <Button
                variant="primary"
                size="lg"
                trailingIcon={<ArrowRight />}
                onClick={onAccept}
              >
                Accept delivery &amp; release payment
              </Button>
            )}
            {resolvedVerdict === "REVIEW" && (
              <Button
                variant="primary"
                leadingIcon={<KeyRound />}
                onClick={() => setScratchOpen(true)}
              >
                Enter scratch code
              </Button>
            )}
            {resolvedVerdict === "FAIL" && (
              <Button
                variant="danger"
                size="lg"
                leadingIcon={<Ban />}
                onClick={onBlock}
              >
                Block this transfer
              </Button>
            )}
          </div>

          {resolvedVerdict === "FAIL" && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--risk-border)]/40 pt-4">
              <Button variant="secondary" leadingIcon={<Flag />}>
                Report to NAFDAC
              </Button>
              <a href="/sample-risk-report.pdf" download>
                <Button variant="ghost" leadingIcon={<FileDown />}>
                  Download risk report
                </Button>
              </a>
              <p className="ml-auto text-[11px] uppercase tracking-[0.04em] text-[var(--risk)]">
                Settlement automatically gated
              </p>
            </div>
          )}
        </Card>
      </motion.div>

      {scratchOpen && (
        <ScratchCodeModal
          onClose={() => setScratchOpen(false)}
          onPromote={(v) => {
            setResolvedVerdict(v);
            setScratchOpen(false);
          }}
        />
      )}
    </>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  const size = "h-7 w-7";
  if (verdict === "PASS") return <CheckCircle2 className={cn(size, "text-[var(--verified)]")} />;
  if (verdict === "REVIEW") return <AlertTriangle className={cn(size, "text-[var(--pending)]")} />;
  return <XCircle className={cn(size, "text-[var(--risk)]")} />;
}

function ScratchCodeModal({
  onClose,
  onPromote,
}: {
  onClose: () => void;
  onPromote: (verdict: Verdict) => void;
}) {
  const [value, setValue] = React.useState("");
  const [attempts, setAttempts] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const CORRECT = "AEG-7741-CXT";

  function submit() {
    if (value.trim().toUpperCase() === CORRECT) {
      onPromote("PASS");
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    if (next >= 3) {
      onPromote("FAIL");
      return;
    }
    setError(
      `Code does not match the in-pack scratch reference. ${3 - next} attempt${3 - next === 1 ? "" : "s"} remaining.`
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        emphasized
        className="relative w-full max-w-[480px] border-[var(--pending-border)]"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3">
          <div>
            <p className="text-caption uppercase text-[var(--pending)]">
              Scratch-code escalation
            </p>
            <h2 className="text-h2 mt-1">Verify the pack reference.</h2>
            <p className="text-small mt-2 text-[var(--text-secondary)]">
              Locate the silver scratch panel on the inside of the carton. Reveal
              the 12-character reference and enter it below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-t border-[var(--border-hairline)] pt-3 space-y-2">
          <Input
            mono
            placeholder="AEG-7741-CXT"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            invalid={!!error}
            autoFocus
          />
          {error && (
            <p className="text-[12px] font-medium text-[var(--risk)]">{error}</p>
          )}
          <p className="text-[11px] text-[var(--text-tertiary)]">
            For the demo, the correct code is{" "}
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              AEG-7741-CXT
            </MonoText>
            . Wrong entries 3× escalate to FAIL.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Submit
          </Button>
        </div>
      </Card>
    </div>
  );
}
