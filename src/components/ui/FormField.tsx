import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Tag shown at the right of the label (e.g. "mono · 11 digits") */
  trailingLabel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  trailingLabel,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-caption uppercase text-[var(--text-tertiary)]"
        >
          {label}
          {required && <span className="ml-1 text-[var(--accent)]">·</span>}
        </label>
        {trailingLabel && (
          <span className="text-[10px] uppercase tracking-[0.04em] text-[var(--text-tertiary)]">
            {trailingLabel}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-[var(--risk)]">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-[var(--text-tertiary)]">{hint}</p>
      ) : null}
    </div>
  );
}
