"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { RiskRegion } from "./RiskMapInner";

const Inner = dynamic(() => import("./RiskMapInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" rounded="lg" />,
});

export function RiskMap({
  regions,
  onSelect,
}: {
  regions: RiskRegion[];
  onSelect?: (state: string) => void;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[10px] border border-[var(--border-hairline)]">
      <Inner regions={regions} onSelect={onSelect} />
    </div>
  );
}

export type { RiskRegion };
