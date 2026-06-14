"use client";

import { create } from "zustand";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const STORAGE_KEY = "aegis.theme";

/**
 * Manual theme store. We deliberately do NOT use zustand/persist here — the
 * inline boot script in `layout.tsx` reads `localStorage` *before* React
 * hydrates so the user never sees a wrong-theme flash, and then this store
 * hydrates from the same key on mount.
 */
export const useTheme = create<ThemeState>((set, get) => ({
  theme: "dark",
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
      document.documentElement.dataset.theme = theme;
    }
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Read whatever the boot script applied and sync the store on mount. */
export function hydrateThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset.theme;
  return t === "light" ? "light" : "dark";
}
