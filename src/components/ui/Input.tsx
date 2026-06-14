"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  /** Render value/text in JetBrains Mono — for IDs, BVNs, hashes */
  mono?: boolean;
  /** Inline status badge at the right edge */
  trailing?: React.ReactNode;
  /** Inline async check indicator */
  checking?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-8 px-2 text-[12px]",
  md: "h-10 px-3 text-[13px]",
  lg: "h-11 px-3.5 text-[14px]",
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, invalid, mono, trailing, checking, size = "md", ...props },
    ref
  ) => {
    return (
      <div className="relative">
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "w-full rounded-[6px] border bg-[var(--bg-elevated)]",
            "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
            "transition-[border-color,box-shadow,background-color] duration-200",
            "focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--border-focus)]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            sizeMap[size],
            invalid
              ? "border-[var(--risk-border)] focus:border-[var(--risk)] focus:ring-[var(--risk-border)]"
              : "border-[var(--border-hairline)] hover:border-[var(--border-strong)]",
            mono && "font-mono-ui tracking-[-0.005em]",
            (trailing || checking) && "pr-9",
            className
          )}
          {...props}
        />
        {(checking || trailing) && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-tertiary)]" />
            ) : (
              trailing
            )}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
