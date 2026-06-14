"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ScanLine,
  Wallet,
  Receipt,
  ShieldAlert,
  Settings,
  Fingerprint,
  Shield,
  Activity,
} from "lucide-react";
import { useAuth, type Role } from "@/stores/auth";
import { MonoText } from "@/components/ui/MonoText";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles that should see this item. Empty = all */
  roles?: Role[];
  /** Optional trailing indicator (count, dot) */
  trailing?: React.ReactNode;
};

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Operate",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/scan", label: "Forensic scan", icon: ScanLine },
      { href: "/batches", label: "Batches", icon: Package },
    ],
  },
  {
    section: "Settlement",
    items: [
      { href: "/wallet", label: "Wallet", icon: Wallet },
      { href: "/transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    section: "Oversight",
    items: [
      {
        href: "/risk",
        label: "Risk feed",
        icon: ShieldAlert,
        roles: ["regulator"],
      },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/settings/identity", label: "Identity", icon: Fingerprint },
      { href: "/settings/team", label: "Team", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const session = useAuth((s) => s.session);
  const role = session?.role ?? "consumer";

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen w-[248px] shrink-0 flex-col",
        "border-r border-[var(--border-hairline)] bg-[var(--bg-base)]"
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] px-4 py-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-[var(--border-strong)] bg-[var(--bg-elevated)]">
          <Shield className="h-3.5 w-3.5 text-[var(--accent)]" />
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            Aegis
          </p>
          <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Forensic gateway
          </p>
        </div>
        <Badge status="verified" size="sm" dot>
          Live
        </Badge>
      </div>

      {/* Org context */}
      {session && (
        <div className="border-b border-[var(--border-hairline)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Organization
          </p>
          <p className="mt-1 text-small font-medium text-[var(--text-primary)] truncate">
            {session.organization}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              {session.userId}
            </MonoText>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((group) => {
          const visible = group.items.filter(
            (i) => !i.roles || i.roles.includes(role)
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.section} className="mb-4">
              <p className="px-2.5 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5",
                          "transition-colors duration-150",
                          active
                            ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            active
                              ? "text-[var(--accent)]"
                              : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                          )}
                        />
                        <span className="flex-1 text-small font-medium">
                          {item.label}
                        </span>
                        {active && (
                          <span
                            aria-hidden
                            className="h-1 w-1 rounded-full bg-[var(--accent)]"
                          />
                        )}
                        {item.trailing}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer — system trace */}
      <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-[var(--verified)]" />
            <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              System status
            </p>
          </div>
          <ThemeToggle />
        </div>
        <p className="mt-1 text-mono-small text-[var(--text-secondary)]">
          all_subsystems_nominal
        </p>
        <p className="text-mono-small text-[var(--text-tertiary)]">
          p50=842ms · p99=1.2s
        </p>
      </div>
    </aside>
  );
}
