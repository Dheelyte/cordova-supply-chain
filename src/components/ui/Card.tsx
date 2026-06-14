import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  emphasized?: boolean;
  padded?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, inset, emphasized, padded = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[10px] border",
        inset ? "bg-[var(--bg-inset)]" : "bg-[var(--bg-elevated)]",
        emphasized
          ? "border-[var(--border-strong)]"
          : "border-[var(--border-hairline)]",
        padded && "p-5",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-start justify-between gap-3 pb-4", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-h3 text-[var(--text-primary)]", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-small text-[var(--text-secondary)]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mt-4 flex items-center gap-2 border-t border-[var(--border-hairline)] pt-4",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
