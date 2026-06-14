import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RouteGuard } from "@/components/layout/RouteGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="flex min-h-screen bg-[var(--bg-base)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </RouteGuard>
  );
}
