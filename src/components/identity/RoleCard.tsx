"use client";

import * as React from "react";
import { Factory, Truck, Store, User, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Role } from "@/stores/auth";
import { cn } from "@/lib/utils/cn";

const META: Record<
  Role,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    inviteOnly?: boolean;
  }
> = {
  manufacturer: {
    label: "Manufacturer",
    description: "Originate batches under NAFDAC registration.",
    icon: Factory,
  },
  wholesaler: {
    label: "Wholesaler",
    description: "Mid-chain custody. Move verified units to retailers.",
    icon: Truck,
  },
  retailer: {
    label: "Retailer",
    description: "Pharmacy. Last-mile dispensing under PCN premise license.",
    icon: Store,
  },
  consumer: {
    label: "Consumer",
    description: "Scan packs at point of purchase.",
    icon: User,
  },
  regulator: {
    label: "Regulator",
    description: "NAFDAC oversight. Invite-only.",
    icon: ShieldCheck,
    inviteOnly: true,
  },
};

export const SELECTABLE_ROLES: Role[] = [
  "manufacturer",
  "wholesaler",
  "retailer",
  "consumer",
];

export function RoleCard({
  role,
  selected,
  onSelect,
}: {
  role: Role;
  selected: boolean;
  onSelect: (role: Role) => void;
}) {
  const meta = META[role];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      disabled={meta.inviteOnly}
      onClick={() => onSelect(role)}
      className={cn(
        "group relative flex flex-col gap-2 rounded-[10px] border bg-[var(--bg-elevated)]",
        "p-4 text-left transition-colors duration-200",
        meta.inviteOnly
          ? "cursor-not-allowed opacity-60 border-[var(--border-hairline)]"
          : selected
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-[var(--border-hairline)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-overlay)]"
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[6px] border",
            selected
              ? "border-[var(--accent)] bg-[var(--bg-base)] text-[var(--accent)]"
              : "border-[var(--border-hairline)] bg-[var(--bg-inset)] text-[var(--text-secondary)]"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        {meta.inviteOnly && (
          <Badge status="neutral" size="sm">
            Invite-only
          </Badge>
        )}
        {selected && !meta.inviteOnly && (
          <Badge status="accent" size="sm" dot>
            Selected
          </Badge>
        )}
      </div>
      <div>
        <p className="text-small font-semibold text-[var(--text-primary)]">
          {meta.label}
        </p>
        <p className="text-[12px] text-[var(--text-secondary)]">
          {meta.description}
        </p>
      </div>
    </button>
  );
}
