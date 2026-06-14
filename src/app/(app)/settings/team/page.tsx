"use client";

import * as React from "react";
import {
  UserPlus,
  ShieldCheck,
  MailPlus,
  MoreHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/stores/auth";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Operator" | "Reviewer" | "Auditor";
  scope: string;
  initials: string;
  lastActive: string;
  twoFactor: boolean;
  status: "active" | "invited";
}

const SEED: Member[] = [
  {
    id: "mbr_001",
    name: "Adeyemi Okafor",
    email: "adeyemi@lagospharma.ng",
    role: "Owner",
    scope: "All operations",
    initials: "AO",
    lastActive: "3 minutes ago",
    twoFactor: true,
    status: "active",
  },
  {
    id: "mbr_002",
    name: "Bukola Ajayi",
    email: "bukola@lagospharma.ng",
    role: "Operator",
    scope: "Batch initialization · custody handoffs",
    initials: "BA",
    lastActive: "2 hours ago",
    twoFactor: true,
    status: "active",
  },
  {
    id: "mbr_003",
    name: "Chinedu Eze",
    email: "chinedu@lagospharma.ng",
    role: "Reviewer",
    scope: "Settlement approvals · ledger reconciliation",
    initials: "CE",
    lastActive: "yesterday",
    twoFactor: true,
    status: "active",
  },
  {
    id: "mbr_004",
    name: "Dr. Folake Adeniyi",
    email: "folake@lagospharma.ng",
    role: "Auditor",
    scope: "Read-only · forensic verdicts and custody",
    initials: "FA",
    lastActive: "4 days ago",
    twoFactor: false,
    status: "active",
  },
  {
    id: "mbr_005",
    name: "Pending",
    email: "ops-night@lagospharma.ng",
    role: "Operator",
    scope: "Awaiting acceptance",
    initials: "—",
    lastActive: "invited 12h ago",
    twoFactor: false,
    status: "invited",
  },
];

const ROLE_META: Record<
  Member["role"],
  { caption: string; pill: "accent" | "info" | "verified" | "neutral" }
> = {
  Owner: { caption: "Full control · org settings", pill: "accent" },
  Operator: { caption: "Day-to-day operations · scan + custody", pill: "info" },
  Reviewer: { caption: "Settlement approvals + ledger", pill: "verified" },
  Auditor: { caption: "Read-only forensic audit", pill: "neutral" },
};

export default function TeamSettingsPage() {
  const session = useAuth((s) => s.session);
  const [filter, setFilter] = React.useState<"all" | "active" | "invited">("all");

  const visible = SEED.filter((m) =>
    filter === "all" ? true : m.status === filter
  );

  const stats = {
    active: SEED.filter((m) => m.status === "active").length,
    invited: SEED.filter((m) => m.status === "invited").length,
    twoFa: SEED.filter((m) => m.twoFactor && m.status === "active").length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Settings · team"
        title={session?.organization ?? "Team"}
        description="Members of your organization and the permissions they carry on the forensic gateway."
        actions={
          <Button variant="primary" leadingIcon={<UserPlus />}>
            Invite member
          </Button>
        }
      />

      {/* Stats */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Stat label="Active members" value={stats.active} />
        <Stat label="Pending invites" value={stats.invited} tone="pending" />
        <Stat
          label="2FA enrolled"
          value={`${stats.twoFa} / ${stats.active}`}
          tone="verified"
          asString
        />
      </div>

      {/* Members */}
      <Card padded className="mt-6">
        <div className="flex items-start justify-between pb-3">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Permissions cascade · removing a member instantly revokes their
              forensic access.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {(["all", "active", "invited"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-[6px] border px-2 py-1 text-caption uppercase transition-colors duration-150 ${
                  filter === f
                    ? "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <ul className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
          {visible.map((m) => {
            const roleMeta = ROLE_META[m.role];
            const isInvite = m.status === "invited";
            return (
              <li
                key={m.id}
                className="grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-[8px] border border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2.5"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                    isInvite
                      ? "border-dashed border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-tertiary)]"
                      : "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  } text-[12px] font-semibold`}
                >
                  {m.initials}
                </span>
                <div className="min-w-0">
                  <p className="text-small font-medium text-[var(--text-primary)] truncate">
                    {isInvite ? "Pending invitation" : m.name}
                  </p>
                  <MonoText size="sm" className="text-[var(--text-tertiary)] truncate block">
                    {m.email}
                  </MonoText>
                </div>
                <div className="min-w-0">
                  <Badge size="sm" status={roleMeta.pill}>
                    {m.role}
                  </Badge>
                  <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)] truncate">
                    {m.scope}
                  </p>
                </div>
                {m.twoFactor ? (
                  <Badge size="sm" status="verified" dot>
                    <ShieldCheck className="h-3 w-3" /> 2FA
                  </Badge>
                ) : (
                  <Badge size="sm" status="pending" dot>
                    no 2FA
                  </Badge>
                )}
                <span className="text-[11px] uppercase tracking-[0.04em] text-[var(--text-tertiary)] whitespace-nowrap">
                  {m.lastActive}
                </span>
                {isInvite ? (
                  <Button size="sm" variant="ghost" leadingIcon={<MailPlus />}>
                    Resend
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" leadingIcon={<MoreHorizontal />}>
                    Manage
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Roles reference */}
      <Card inset padded className="mt-6">
        <CardTitle>Role reference</CardTitle>
        <CardDescription>
          What each role can do on the forensic gateway.
        </CardDescription>
        <ul className="mt-3 grid gap-2 border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-2">
          {(Object.keys(ROLE_META) as Member["role"][]).map((r) => (
            <li
              key={r}
              className="rounded-[6px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Badge size="sm" status={ROLE_META[r].pill}>
                  {r}
                </Badge>
              </div>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                {ROLE_META[r].caption}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  asString,
}: {
  label: string;
  value: number | string;
  tone?: "verified" | "pending" | "neutral";
  asString?: boolean;
}) {
  const color =
    tone === "verified"
      ? "var(--verified)"
      : tone === "pending"
        ? "var(--pending)"
        : "var(--text-primary)";
  return (
    <Card padded>
      <p className="text-caption uppercase text-[var(--text-tertiary)]">
        {label}
      </p>
      <MonoText
        size="lg"
        className="mt-1 block text-[26px] leading-none"
        style={{ color }}
      >
        {asString ? value : String(value)}
      </MonoText>
    </Card>
  );
}
