import * as React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";

/**
 * Onboarding is the registration flow — it has to be reachable before the
 * visitor has a session. Chrome-light header, no RouteGuard.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      <header className="flex h-12 items-center justify-between border-b border-[var(--border-hairline)] px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
            <Shield className="h-3 w-3 text-[var(--accent)]" />
          </div>
          <span className="text-small font-semibold tracking-[-0.01em]">
            Aegis
          </span>
          <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Identity Wall
          </span>
        </Link>
        <Link
          href="/login"
          className="text-caption uppercase text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          Sign in instead
        </Link>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
