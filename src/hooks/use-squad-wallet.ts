"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { wallet as squadWallet } from "@/lib/squadco";
import type {
  TransferRequest,
  WalletBalanceData,
  WalletTransactionsData,
} from "@/lib/squadco";
import { useAuth } from "@/stores/auth";

const KEY = {
  balance: ["squad", "wallet", "balance"] as const,
  transactions: (page: number, perPage: number) =>
    ["squad", "wallet", "transactions", page, perPage] as const,
};

/**
 * Live wallet balance from `GET /wallet/`. Disabled until a session exists.
 * Re-fetches on focus so the user sees fresh balances when returning to the
 * tab after an off-platform top-up.
 */
export function useSquadWalletBalance() {
  const hasSession = useAuth((s) => !!s.session);
  return useQuery<WalletBalanceData>({
    queryKey: KEY.balance,
    queryFn: () => squadWallet.getWallet(),
    enabled: hasSession,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Live transaction history from `GET /wallet/transactions`. */
export function useSquadWalletTransactions(page = 1, perPage = 20) {
  const hasSession = useAuth((s) => !!s.session);
  return useQuery<WalletTransactionsData>({
    queryKey: KEY.transactions(page, perPage),
    queryFn: () => squadWallet.getTransactions(page, perPage),
    enabled: hasSession,
    staleTime: 30_000,
  });
}

/**
 * `POST /wallet/transfer`. Invalidates balance + first transactions page on
 * success so the UI reflects the new state without an explicit refetch.
 */
export function useSquadTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransferRequest) => squadWallet.transfer(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY.balance });
      qc.invalidateQueries({ queryKey: ["squad", "wallet", "transactions"] });
    },
  });
}
