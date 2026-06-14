"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme, hydrateThemeFromDocument } from "@/stores/theme";

let workerStarted = false;

async function startMockWorker() {
  if (typeof window === "undefined") return;
  if (workerStarted) return;
  workerStarted = true;
  const { worker } = await import("@/lib/mock-api/browser");
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
    quiet: true,
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const [ready, setReady] = React.useState(false);
  const setTheme = useTheme((s) => s.setTheme);

  React.useEffect(() => {
    // Sync the store with whatever the inline boot script applied to <html>.
    setTheme(hydrateThemeFromDocument());
    startMockWorker().finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="text-mono-small uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          initializing…
        </div>
      </div>
    );
  }

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
