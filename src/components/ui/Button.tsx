"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "rounded-[8px] font-medium text-[13px] tracking-[-0.005em]",
    "transition-[background-color,border-color,color,box-shadow] duration-200",
    "[transition-timing-function:cubic-bezier(0.2,0,0,1)]",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-focus)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "select-none whitespace-nowrap",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary: accent fill on dark, used sparingly
        primary:
          "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 active:bg-[var(--accent)]/80 disabled:bg-[var(--accent)]/40",
        // Secondary: hairline outline on elevated
        secondary:
          "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-hairline)] hover:bg-[var(--bg-overlay)] hover:border-[var(--border-strong)]",
        // Ghost: no chrome until hover
        ghost:
          "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
        // Destructive: risk red
        danger:
          "bg-[var(--risk-soft)] text-[var(--risk)] border border-[var(--risk-border)] hover:bg-[var(--risk)]/20",
        // Success: verified green
        verified:
          "bg-[var(--verified-soft)] text-[var(--verified)] border border-[var(--verified-border)] hover:bg-[var(--verified)]/20",
        // Link: minimal underline-on-hover
        link: "bg-transparent text-[var(--text-primary)] underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-7 px-2.5 text-[12px]",
        md: "h-9 px-3.5",
        lg: "h-11 px-5 text-[14px]",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      leadingIcon,
      trailingIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : leadingIcon ? (
          <span className="flex h-3.5 w-3.5 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">
            {leadingIcon}
          </span>
        ) : null}
        {children}
        {!loading && trailingIcon ? (
          <span className="flex h-3.5 w-3.5 items-center justify-center [&_svg]:h-3.5 [&_svg]:w-3.5">
            {trailingIcon}
          </span>
        ) : null}
      </button>
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
