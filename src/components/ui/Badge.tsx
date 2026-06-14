import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeStatus =
  | "verified"
  | "pending"
  | "risk"
  | "info"
  | "neutral"
  | "accent";

const statusStyles: Record<BadgeStatus, string> = {
  verified:
    "bg-[var(--verified-soft)] text-[var(--verified)] border-[var(--verified-border)]",
  pending:
    "bg-[var(--pending-soft)] text-[var(--pending)] border-[var(--pending-border)]",
  risk: "bg-[var(--risk-soft)] text-[var(--risk)] border-[var(--risk-border)]",
  info: "bg-[var(--info-soft)] text-[var(--info)] border-[var(--info-border)]",
  accent:
    "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent-border)]",
  neutral:
    "bg-[var(--bg-overlay)] text-[var(--text-secondary)] border-[var(--border-hairline)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  dot?: boolean;
  size?: "sm" | "md";
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, status = "neutral", dot, size = "md", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-medium",
          "tracking-[0.01em] uppercase",
          size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
          statusStyles[status],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            aria-hidden
            className={cn(
              "inline-block rounded-full",
              size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5"
            )}
            style={{ backgroundColor: "currentColor" }}
          />
        )}
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";
