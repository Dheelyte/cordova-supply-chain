"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth";

/**
 * Client-side guard for the (app) route group. Hydrates first to avoid
 * an SSR-vs-localStorage flicker; only after hydration completes does it
 * decide whether to redirect.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useAuth((s) => s.session);
  const hydrated = useAuth((s) => s.hydrated);

  React.useEffect(() => {
    if (hydrated && !session) {
      router.replace("/login");
    }
  }, [hydrated, session, router]);

  if (!hydrated) {
    return <GuardSkeleton />;
  }
  if (!session) {
    return <GuardSkeleton />;
  }
  return <>{children}</>;
}

function GuardSkeleton() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="text-mono-small uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        verifying session…
      </div>
    </div>
  );
}
