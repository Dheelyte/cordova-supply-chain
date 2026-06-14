"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface AlignmentOverlayProps {
  aligned: boolean;
  /** Aspect ratio of the alignment frame, w/h */
  aspectRatio?: number;
  className?: string;
}

const corners = [
  { pos: "top-0 left-0", sides: "border-t-[3px] border-l-[3px]", radius: "rounded-tl-[6px]" },
  { pos: "top-0 right-0", sides: "border-t-[3px] border-r-[3px]", radius: "rounded-tr-[6px]" },
  { pos: "bottom-0 left-0", sides: "border-b-[3px] border-l-[3px]", radius: "rounded-bl-[6px]" },
  { pos: "bottom-0 right-0", sides: "border-b-[3px] border-r-[3px]", radius: "rounded-br-[6px]" },
] as const;

export function AlignmentOverlay({
  aligned,
  aspectRatio = 1.4,
  className,
}: AlignmentOverlayProps) {
  const color = aligned ? "var(--verified)" : "var(--text-tertiary)";

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className
      )}
    >
      <motion.div
        animate={
          aligned
            ? { boxShadow: "0 0 0 0 rgba(0, 214, 143, 0.0)" }
            : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
        }
        transition={{ duration: 0.3 }}
        style={{ aspectRatio }}
        className="relative w-[58%] max-w-[440px]"
      >
        {corners.map((c) => (
          <motion.span
            key={c.pos}
            aria-hidden
            animate={
              aligned
                ? { borderColor: color, scale: 1.04 }
                : { borderColor: color, scale: 1 }
            }
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className={cn(
              "absolute h-5 w-5",
              c.pos,
              c.sides,
              c.radius
            )}
          />
        ))}

        {aligned && (
          <motion.span
            aria-hidden
            animate={{ opacity: [0.0, 0.6, 0.0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-[6px]"
            style={{ boxShadow: `inset 0 0 0 1px ${color}` }}
          />
        )}
      </motion.div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-base)]/80 px-3 py-1 backdrop-blur">
        <span
          className="text-[11px] font-mono-ui uppercase tracking-[0.08em]"
          style={{ color }}
        >
          {aligned ? "aligned · capture ready" : "align label within frame"}
        </span>
      </div>
    </div>
  );
}
