import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pb-6",
        "border-b border-[var(--border-hairline)]",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-caption uppercase text-[var(--text-tertiary)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-h1 mt-1 text-[var(--text-primary)]">{title}</h1>
        {description && (
          <p className="text-body mt-2 max-w-[640px] text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
