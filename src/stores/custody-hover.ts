"use client";

import { create } from "zustand";

interface CustodyHoverState {
  hoveredHopId: string | null;
  setHovered: (id: string | null) => void;
}

/**
 * Shared between the custody timeline card and the journey map pin so a hover
 * on either surface highlights its counterpart on the other.
 */
export const useCustodyHover = create<CustodyHoverState>((set) => ({
  hoveredHopId: null,
  setHovered: (hoveredHopId) => set({ hoveredHopId }),
}));
