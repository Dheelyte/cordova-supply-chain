"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/stores/theme";
import { cn } from "@/lib/utils/cn";

/**
 * Two-position theme switch. Renders a segmented pill so the active mode
 * is always visible — matches the rest of the forensic UI's pattern of
 * never hiding state behind toggles.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] p-0.5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors",
          theme === "dark"
            ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        )}
      >
        <Moon className="h-3 w-3" />
        <span className="sr-only">Dark mode</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-[4px] transition-colors",
          theme === "light"
            ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]"
            : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        )}
      >
        <Sun className="h-3 w-3" />
        <span className="sr-only">Light mode</span>
      </button>
    </div>
  );
}
