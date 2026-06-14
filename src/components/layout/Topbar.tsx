"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, Search, ChevronRight, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { KBD } from "@/components/ui/KBD";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/utils/cn";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  batches: "Batches",
  new: "New",
  scan: "Forensic scan",
  wallet: "Wallet",
  transactions: "Transactions",
  risk: "Risk feed",
  settings: "Settings",
  identity: "Identity",
  team: "Team",
  result: "Verdict",
};

function humanize(seg: string) {
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  // Dynamic segments (ids, hashes) — render in mono via a sentinel
  return seg;
}

export function Topbar() {
  const pathname = usePathname();
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);

  const segments = pathname.split("/").filter(Boolean);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-4",
        "border-b border-[var(--border-hairline)] bg-[var(--bg-base)]/85 backdrop-blur",
        "px-6"
      )}
    >
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1.5"
      >
        {segments.length === 0 ? (
          <span className="text-small text-[var(--text-secondary)]">Home</span>
        ) : (
          segments.map((seg, i) => {
            const isLast = i === segments.length - 1;
            const looksLikeId = /^[a-f0-9]{8,}$/i.test(seg) || seg.length > 18;
            return (
              <React.Fragment key={`${seg}-${i}`}>
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 text-[var(--text-tertiary)]" />
                )}
                {looksLikeId ? (
                  <MonoText
                    size="sm"
                    className={cn(
                      isLast
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    {seg.length > 18 ? `${seg.slice(0, 8)}…${seg.slice(-4)}` : seg}
                  </MonoText>
                ) : (
                  <span
                    className={cn(
                      "text-small",
                      isLast
                        ? "font-medium text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    )}
                  >
                    {humanize(seg)}
                  </span>
                )}
              </React.Fragment>
            );
          })
        )}
      </nav>

      {/* Search trigger (visual only for now) */}
      <button
        type="button"
        className={cn(
          "hidden items-center gap-2 rounded-[6px] border border-[var(--border-hairline)]",
          "bg-[var(--bg-elevated)] px-2.5 py-1.5 text-left",
          "hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]",
          "transition-colors duration-200 md:flex"
        )}
      >
        <Search className="h-3 w-3 text-[var(--text-tertiary)]" />
        <span className="text-small text-[var(--text-tertiary)]">
          Search IDs, batches, vendors…
        </span>
        <KBD>⌘K</KBD>
      </button>

      {/* Notifications */}
      <button
        type="button"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-[6px]",
          "border border-[var(--border-hairline)] bg-[var(--bg-elevated)]",
          "text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]",
          "transition-colors duration-200"
        )}
        aria-label="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--risk)]"
        />
      </button>

      {/* Role switcher */}
      <RoleSwitcher />

      {/* User */}
      {session && (
        <div className="flex items-center gap-2.5 border-l border-[var(--border-hairline)] pl-4">
          <div
            aria-hidden
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              "border border-[var(--border-strong)] bg-[var(--bg-elevated)]",
              "text-[11px] font-semibold text-[var(--text-primary)]"
            )}
          >
            {session.initials}
          </div>
          <div className="hidden leading-tight md:block">
            <p className="text-small font-medium text-[var(--text-primary)]">
              {session.name}
            </p>
            <div className="flex items-center gap-1.5">
              <MonoText size="sm" className="text-[var(--text-tertiary)]">
                {session.trustScore.toFixed(1)}
              </MonoText>
              <Badge
                size="sm"
                status={
                  session.tier === "verified"
                    ? "verified"
                    : session.tier === "limited"
                      ? "pending"
                      : "risk"
                }
              >
                {session.tier}
              </Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[6px]",
              "text-[var(--text-tertiary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
              "transition-colors duration-200"
            )}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}
