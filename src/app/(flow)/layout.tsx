import * as React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { RouteGuard } from "@/components/layout/RouteGuard";

/**
 * The (flow) layout is intentionally chrome-light: no sidebar, no full topbar.
 * Forensic flows (scan, onboarding) need the user's full attention.
 */
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
        <header className="flex h-12 items-center justify-between border-b border-[var(--border-hairline)] px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
              <Shield className="h-3 w-3 text-[var(--accent)]" />
            </div>
            <span className="text-small font-semibold tracking-[-0.01em]">
              Aegis
            </span>
            <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Forensic flow
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-caption uppercase text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            Exit
          </Link>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </RouteGuard>
  );
}
