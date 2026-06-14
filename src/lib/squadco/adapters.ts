/**
 * Adapters between the SquadCo wire shapes and the frontend's
 * mock-derived display types.
 *
 * These exist because the rich frontend UX predates the backend and
 * carries fields the backend doesn't model yet (counterparty names,
 * forensic linkage, etc.). The adapters fill those in with safe
 * placeholders so the existing tables and panels can render real data
 * without breaking. See MISMATCHES.md for the full list of fields that
 * the backend doesn't provide.
 */
import type {
  MockTransaction,
  TransactionType,
} from "@/lib/mock-api/fixtures/transactions";
import type { WalletTransaction } from "./types";

/**
 * Map a backend transaction status onto the frontend's display `type`.
 * The backend models a 2D (CREDIT/DEBIT × COMPLETED/FAILED/FROZEN/...)
 * matrix; the frontend's UI only branches on one axis (validated /
 * fraud_blocked / pending). The mapping below favours clarity over
 * fidelity.
 */
function mapType(t: WalletTransaction): TransactionType {
  if (t.status === "FRAUD_BLOCKED") return "fraud_blocked";
  if (t.status === "PENDING" || t.status === "FROZEN") return "pending";
  if (t.status === "FAILED") return "fraud_blocked";
  return "validated";
}

/**
 * Convert a backend `WalletTransaction` to the frontend's
 * `MockTransaction`-shaped display row. Unknown fields
 * (counterparty names, forensic linkage) are filled with safe
 * placeholders so the existing TransactionsTable + EvidencePanel
 * components can render without changes.
 */
export function adaptWalletTransaction(
  t: WalletTransaction,
  selfUserId: string,
  selfName: string
): MockTransaction {
  const isCredit = t.transaction_type === "CREDIT";
  // The backend doesn't yet expose the counterparty's user id or name.
  // We surface the half we know (this user) on the side that's
  // *receiving* the money for credits and *sending* for debits.
  return {
    id: t.transaction_reference,
    timestamp: t.created_at,
    amount: t.amount,
    type: mapType(t),
    fromUserId: isCredit ? "" : selfUserId,
    fromName: isCredit ? "External counterparty" : selfName,
    toUserId: isCredit ? selfUserId : "",
    toName: isCredit ? selfName : "External counterparty",
    squadRef: t.transaction_reference,
    blockReason:
      t.status === "FRAUD_BLOCKED" || t.status === "FAILED"
        ? t.remarks || "Blocked at the wire by SquadCo."
        : undefined,
  };
}
