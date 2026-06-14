"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CustodyHop } from "@/lib/mock-api/fixtures/batches";

const Inner = dynamic(() => import("./JourneyMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-[var(--bg-inset)]">
      <Skeleton className="h-full w-full" rounded="lg" />
    </div>
  ),
});

export function JourneyMap({ hops }: { hops: CustodyHop[] }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-[var(--border-hairline)]">
      <Inner hops={hops} />
      {/* Force leaflet popup/tooltip styling to match the design system */}
      <style jsx global>{`
        .leaflet-container {
          background: var(--bg-inset) !important;
          font-family: var(--font-inter), sans-serif;
        }
        .leaflet-tooltip.aegis-tooltip {
          background: var(--bg-overlay);
          color: var(--text-primary);
          border: 1px solid var(--border-strong);
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 12px;
          box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.6);
        }
        .leaflet-tooltip.aegis-tooltip:before {
          border-top-color: var(--border-strong);
        }
        .leaflet-control-zoom a {
          background: var(--bg-elevated);
          color: var(--text-primary);
          border: 1px solid var(--border-hairline);
        }
        .leaflet-control-zoom a:hover {
          background: var(--bg-overlay);
        }
      `}</style>
    </div>
  );
}
