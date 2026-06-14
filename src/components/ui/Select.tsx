"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  invalid?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-8 pl-2 pr-7 text-[12px]",
  md: "h-10 pl-3 pr-8 text-[13px]",
  lg: "h-11 pl-3.5 pr-8 text-[14px]",
} as const;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, size = "md", children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full appearance-none rounded-[6px] border bg-[var(--bg-elevated)]",
          "text-[var(--text-primary)]",
          "transition-[border-color,box-shadow] duration-200",
          "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--border-focus)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          sizeMap[size],
          invalid
            ? "border-[var(--risk-border)] focus:border-[var(--risk)] focus:ring-[var(--risk-border)]"
            : "border-[var(--border-hairline)] hover:border-[var(--border-strong)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
    </div>
  )
);
Select.displayName = "Select";
