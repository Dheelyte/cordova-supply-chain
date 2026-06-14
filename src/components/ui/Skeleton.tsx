import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: "sm" | "md" | "lg" | "full";
}

const radiusMap = {
  sm: "rounded-[4px]",
  md: "rounded-[6px]",
  lg: "rounded-[10px]",
  full: "rounded-full",
} as const;

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, rounded = "md", ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn("skeleton", radiusMap[rounded], className)}
      {...props}
    />
  )
);
Skeleton.displayName = "Skeleton";
