import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const KBD = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, children, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-[4px]",
      "border border-[var(--border-hairline)] bg-[var(--bg-inset)]",
      "px-1 font-mono-ui text-[11px] font-medium text-[var(--text-secondary)]",
      "shadow-[inset_0_-1px_0_0_var(--border-hairline)]",
      className
    )}
    {...props}
  >
    {children}
  </kbd>
));
KBD.displayName = "KBD";
