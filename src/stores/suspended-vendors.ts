"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SuspendedVendorsState {
  suspendedIds: string[];
  /** Per-vendor record of why and when */
  reasons: Record<string, { reason: string; suspendedAt: string; frozenTxns: number }>;
  suspend: (vendorId: string, reason: string, frozenTxns?: number) => void;
  unsuspend: (vendorId: string) => void;
  isSuspended: (vendorId: string) => boolean;
  reset: () => void;
}

export const useSuspendedVendors = create<SuspendedVendorsState>()(
  persist(
    (set, get) => ({
      suspendedIds: ["usr_ghost_tin_mismatch", "usr_ghost_residential"],
      reasons: {
        usr_ghost_tin_mismatch: {
          reason: "FIRS TIN / CAC mismatch · 3 fraud-blocked attempts",
          suspendedAt: "2026-05-09T14:22:18.401Z",
          frozenTxns: 3,
        },
        usr_ghost_residential: {
          reason: "Premise address resolves to residential apartment",
          suspendedAt: "2026-05-09T18:42:33.118Z",
          frozenTxns: 2,
        },
      },
      suspend: (vendorId, reason, frozenTxns = 0) =>
        set((s) => ({
          suspendedIds: s.suspendedIds.includes(vendorId)
            ? s.suspendedIds
            : [...s.suspendedIds, vendorId],
          reasons: {
            ...s.reasons,
            [vendorId]: {
              reason,
              suspendedAt: new Date().toISOString(),
              frozenTxns,
            },
          },
        })),
      unsuspend: (vendorId) =>
        set((s) => {
          const next = { ...s.reasons };
          delete next[vendorId];
          return {
            suspendedIds: s.suspendedIds.filter((id) => id !== vendorId),
            reasons: next,
          };
        }),
      isSuspended: (vendorId) => get().suspendedIds.includes(vendorId),
      reset: () =>
        set({
          suspendedIds: ["usr_ghost_tin_mismatch", "usr_ghost_residential"],
          reasons: {
            usr_ghost_tin_mismatch: {
              reason: "FIRS TIN / CAC mismatch · 3 fraud-blocked attempts",
              suspendedAt: "2026-05-09T14:22:18.401Z",
              frozenTxns: 3,
            },
            usr_ghost_residential: {
              reason: "Premise address resolves to residential apartment",
              suspendedAt: "2026-05-09T18:42:33.118Z",
              frozenTxns: 2,
            },
          },
        }),
    }),
    { name: "aegis.suspended-vendors" }
  )
);
