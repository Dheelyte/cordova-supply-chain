import * as React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        {children}
      </main>
    </div>
  );
}
