"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Local-first registry of batches the user has initiated against
 * `POST /ledger/initiate`. Exists because the SquadCo backend ships
 * `GET /ledger/history/{binary_id}` but no "list my batches" endpoint
 * (see MISMATCHES.md #1). The browser remembers what it initiated; each
 * row links to the live history endpoint when the user inspects it.
 *
 * When the backend grows a list endpoint, swap this store for a TanStack
 * Query fetch — the row shape is intentionally close to the API response.
 */
export interface InitiatedBatch {
  /** Server `binary_id` — the SHA-256 of the raw QR/barcode. */
  binaryId: string;
  /** Server `batch_id` UUID. */
  batchId: string;
  productName: string;
  batchNumber: string;
  nafdacReg: string | null;
  initiatedAt: string;
  /** Optional fields captured on the form for richer list rendering. */
  rawCode: string;
  latitude: number | null;
  longitude: number | null;
}

interface InitiatedBatchesState {
  batches: InitiatedBatch[];
  hydrated: boolean;
  add: (batch: InitiatedBatch) => void;
  remove: (binaryId: string) => void;
  _hydrate: () => void;
}

export const useInitiatedBatches = create<InitiatedBatchesState>()(
  persist(
    (set) => ({
      batches: [],
      hydrated: false,
      add: (batch) =>
        set((s) => {
          // Dedupe on binaryId — re-initiating the same QR is a no-op.
          if (s.batches.some((b) => b.binaryId === batch.binaryId)) return s;
          return { batches: [batch, ...s.batches] };
        }),
      remove: (binaryId) =>
        set((s) => ({ batches: s.batches.filter((b) => b.binaryId !== binaryId) })),
      _hydrate: () => set({ hydrated: true }),
    }),
    {
      name: "aegis.initiated-batches",
      onRehydrateStorage: () => (state) => {
        state?._hydrate();
      },
    }
  )
);
