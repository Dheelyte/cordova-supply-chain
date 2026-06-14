"use client";

import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { useAuth, type Role } from "@/stores/auth";
import { cn } from "@/lib/utils/cn";

const ROLES: { id: Role; label: string; sublabel: string }[] = [
  { id: "manufacturer", label: "Manufacturer", sublabel: "Originate batches" },
  { id: "wholesaler", label: "Wholesaler", sublabel: "Mid-chain custody" },
  { id: "retailer", label: "Retailer", sublabel: "Last-mile dispensing" },
  { id: "consumer", label: "Consumer", sublabel: "Scan & verify" },
  { id: "regulator", label: "Regulator", sublabel: "Network oversight" },
];

export function RoleSwitcher() {
  const session = useAuth((s) => s.session);
  const setRole = useAuth((s) => s.setRole);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!session) return null;
  const active = ROLES.find((r) => r.id === session.role) ?? ROLES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-[6px] border border-[var(--border-hairline)]",
          "bg-[var(--bg-elevated)] px-2.5 py-1.5 text-left",
          "hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]",
          "transition-colors duration-200"
        )}
      >
        <span className="text-caption uppercase text-[var(--text-tertiary)]">
          Role
        </span>
        <span className="text-small font-medium text-[var(--text-primary)]">
          {active.label}
        </span>
        <ChevronsUpDown className="h-3 w-3 text-[var(--text-tertiary)]" />
      </button>
      {open && (
        <div
          className={cn(
            "absolute right-0 z-40 mt-1.5 w-[260px] overflow-hidden",
            "rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-overlay)]",
            "shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
          )}
        >
          <div className="border-b border-[var(--border-hairline)] px-3 py-2">
            <p className="text-caption uppercase text-[var(--text-tertiary)]">
              Workspace view
            </p>
          </div>
          <ul className="py-1">
            {ROLES.map((r) => {
              const selected = r.id === session.role;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRole(r.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left",
                      "hover:bg-[var(--bg-elevated)] transition-colors duration-150"
                    )}
                  >
                    <div className="flex-1">
                      <p className="text-small font-medium text-[var(--text-primary)]">
                        {r.label}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {r.sublabel}
                      </p>
                    </div>
                    {selected && (
                      <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
