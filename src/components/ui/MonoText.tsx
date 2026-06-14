import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface MonoTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md" | "lg";
  truncate?: boolean;
  /** Render with subtle selection-on-hover affordance */
  selectable?: boolean;
  as?: "span" | "code" | "div";
}

const sizeMap = {
  sm: "text-mono-small",
  md: "text-mono",
  lg: "font-mono-ui text-[15px] tracking-[-0.005em] font-medium",
} as const;

export const MonoText = React.forwardRef<HTMLSpanElement, MonoTextProps>(
  (
    {
      className,
      size = "md",
      truncate,
      selectable = true,
      as = "span",
      children,
      ...props
    },
    ref
  ) => {
    const Comp = as as "span";
    return (
      <Comp
        ref={ref}
        className={cn(
          sizeMap[size],
          "text-[var(--text-primary)]",
          truncate && "truncate",
          selectable && "selection:bg-[var(--accent-soft)]",
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
MonoText.displayName = "MonoText";
