"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MOCK_TRANSACTIONS,
  type MockTransaction,
} from "@/lib/mock-api/fixtures/transactions";

export interface PendingSettlement {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyVerified: boolean;
  recipientBank: string;
  recipientNubanMasked: string;
  amount: number;
  /** Stub-fixture scan id, when seeded from the catalogue. */
  linkedScanId?: string;
  /**
   * Build stage 5 — when a settlement was created from a real scan via the
   * verdict screen's Accept CTA, this holds the backend session id. The
   * SettlementCard's LogicGatedButton drives the AI gate from this session's
   * cached `ScanResult` rather than the static `aiVerdict` below.
   */
  linkedScanSessionId?: string;
  linkedBatchId?: string;
  verdictScore: number;
  /** Gate verdicts */
  aiVerdict: "PASS" | "REVIEW" | "FAIL";
  ledgerPath: "PASS" | "REVIEW" | "FAIL";
  /** Optional reason when a gate is not PASS */
  aiReason?: string;
  ledgerReason?: string;
}

const SEED: PendingSettlement[] = [
  {
    id: "pend_001a",
    counterpartyId: "usr_3f1a82c7e9d4",
    counterpartyName: "Idumota Health Distribution",
    counterpartyVerified: true,
    recipientBank: "Access Bank",
    recipientNubanMasked: "••••1847",
    amount: 2_400_000,
    linkedScanId: "scan_authentic_a",
    linkedBatchId: "batch-coartem-001",
    verdictScore: 95.4,
    aiVerdict: "PASS",
    ledgerPath: "PASS",
  },
  {
    id: "pend_002b",
    counterpartyId: "usr_72b1e09f1c38",
    counterpartyName: "MediBio Industries",
    counterpartyVerified: true,
    recipientBank: "Zenith Bank",
    recipientNubanMasked: "••••2841",
    amount: 1_120_000,
    linkedScanId: "scan_authentic_b",
    linkedBatchId: "batch-augmentin-001",
    verdictScore: 93.6,
    aiVerdict: "PASS",
    ledgerPath: "PASS",
  },
  {
    id: "pend_003c",
    counterpartyId: "usr_3f1a82c7e9d4",
    counterpartyName: "Idumota Health Distribution",
    counterpartyVerified: true,
    recipientBank: "Access Bank",
    recipientNubanMasked: "••••1847",
    amount: 1_640_000,
    linkedScanId: "scan_borderline",
    linkedBatchId: "batch-lonart-001",
    verdictScore: 62.0,
    aiVerdict: "REVIEW",
    ledgerPath: "PASS",
    aiReason:
      "Forensic consensus 62.0 falls in the scratch-code escalation band (60–84). Verify the in-pack scratch code before releasing payment.",
  },
  {
    id: "pend_004d",
    counterpartyId: "usr_ghost_tin_mismatch",
    counterpartyName: "Quick Pharma Wholesale",
    counterpartyVerified: false,
    recipientBank: "Opay",
    recipientNubanMasked: "••••9912",
    amount: 1_800_000,
    linkedScanId: "scan_counterfeit_digital",
    linkedBatchId: "batch-coartem-002",
    verdictScore: 41.2,
    aiVerdict: "FAIL",
    ledgerPath: "FAIL",
    aiReason:
      "ELA flagged tampering concentrated on the expiry-date region. Consensus 41.2/100 — clearly counterfeit.",
    ledgerReason:
      "Vendor TIN/CAC mismatch · counterparty trust score 41.2 (suspended tier).",
  },
];

/** Input shape for `createSettlementFromScan` — mirrors the backend's
 *  `ScanResult` (canonical wire) trimmed to the fields the wallet needs. */
export interface ScanVerdictForSettlement {
  sessionId: string;
  verdict: "PASS" | "REVIEW" | "FAIL";
  consensusScore: number;
  summary: string;
  batchId?: string;
}

interface WalletState {
  balance: number;
  linkedBank: string;
  nubanMasked: string;
  pending: PendingSettlement[];
  ledger: MockTransaction[];
  /** Settle a pending transfer — caller drives the state machine, then commits */
  commitTransfer: (
    pendingId: string,
    squadRef: string
  ) => MockTransaction | null;
  /** Cancel / block a pending transfer (writes a fraud_blocked row to ledger) */
  blockTransfer: (pendingId: string, reason: string) => void;
  /**
   * Build stage 5 — create a pending settlement from a forensic scan's
   * verdict. The scan result page calls this on its "Accept delivery &
   * release payment" CTA, then routes the user to /wallet. The AI gate on
   * the resulting settlement is derived from the scan's real verdict.
   */
  createSettlementFromScan: (input: ScanVerdictForSettlement) => string;
  reset: () => void;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      balance: 4_750_000,
      linkedBank: "GTBank",
      nubanMasked: "••••2913",
      pending: SEED,
      ledger: MOCK_TRANSACTIONS,
      commitTransfer: (pendingId, squadRef) => {
        const p = get().pending.find((x) => x.id === pendingId);
        if (!p) return null;
        const txn: MockTransaction = {
          id: `TXN_${Math.random().toString(16).slice(2, 14)}`,
          timestamp: new Date().toISOString(),
          amount: p.amount,
          type: "validated",
          fromUserId: "usr_8a4f9c12c102",
          fromName: "Lagos Pharma Ltd",
          toUserId: p.counterpartyId,
          toName: p.counterpartyName,
          linkedScanId: p.linkedScanId,
          linkedBatchId: p.linkedBatchId,
          verdictScore: p.verdictScore,
          squadRef,
          recipientBank: p.recipientBank,
          recipientNubanMasked: p.recipientNubanMasked,
        };
        set((s) => ({
          balance: s.balance - p.amount,
          pending: s.pending.filter((x) => x.id !== pendingId),
          ledger: [txn, ...s.ledger],
        }));
        return txn;
      },
      blockTransfer: (pendingId, reason) => {
        const p = get().pending.find((x) => x.id === pendingId);
        if (!p) return;
        const txn: MockTransaction = {
          id: `TXN_FRAUD_${Math.random().toString(16).slice(2, 10)}`,
          timestamp: new Date().toISOString(),
          amount: p.amount,
          type: "fraud_blocked",
          fromUserId: "usr_8a4f9c12c102",
          fromName: "Lagos Pharma Ltd",
          toUserId: p.counterpartyId,
          toName: p.counterpartyName,
          linkedScanId: p.linkedScanId,
          verdictScore: p.verdictScore,
          blockReason: reason,
        };
        set((s) => ({
          pending: s.pending.filter((x) => x.id !== pendingId),
          ledger: [txn, ...s.ledger],
        }));
      },
      createSettlementFromScan: (input) => {
        // Demo counterparty + amount until a procurement-order surface lands.
        // The point of Stage 5 is that the AI gate is now derived from the
        // *real* verdict, not a static fixture field.
        const defaultCounterparty = {
          counterpartyId: "usr_3f1a82c7e9d4",
          counterpartyName: "Idumota Health Distribution",
          counterpartyVerified: true,
          recipientBank: "Access Bank",
          recipientNubanMasked: "••••1847",
        };
        const aiReason =
          input.verdict !== "PASS"
            ? `Forensic AI verdict ${input.verdict} (${input.consensusScore.toFixed(1)}/100). ${input.summary}`
            : undefined;
        const ledgerPath: PendingSettlement["ledgerPath"] = "PASS";
        const id = `pend_scan_${input.sessionId.slice(-8)}_${Math.random().toString(16).slice(2, 6)}`;
        const settlement: PendingSettlement = {
          id,
          ...defaultCounterparty,
          amount: 1_800_000,
          linkedScanSessionId: input.sessionId,
          linkedBatchId: input.batchId,
          verdictScore: input.consensusScore,
          aiVerdict: input.verdict,
          ledgerPath,
          aiReason,
        };
        set((s) => ({ pending: [settlement, ...s.pending] }));
        return id;
      },
      reset: () =>
        set({
          balance: 4_750_000,
          pending: SEED,
          ledger: MOCK_TRANSACTIONS,
        }),
    }),
    {
      name: "aegis.wallet",
      partialize: (s) => ({
        // Only the ledger persists across sessions. The pending queue is
        // a live work-list that re-hydrates from the live source each load,
        // and the wallet balance is derived from the seed minus any settled
        // outflows in this session.
        ledger: s.ledger,
      }),
    }
  )
);
