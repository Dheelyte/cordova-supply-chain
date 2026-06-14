"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useInitiatedBatches } from "@/stores/initiated-batches";
import { formatHash } from "@/lib/utils/format";
import { format } from "date-fns";

export default function BatchesPage() {
  const batches = useInitiatedBatches((s) => s.batches);
  const hydrated = useInitiatedBatches((s) => s.hydrated);
  const [search, setSearch] = React.useState("");

  // The SquadCo backend ships no "list my batches" endpoint
  // (MISMATCHES.md #1). We persist every batch initiated via
  // `POST /ledger/initiate` to localStorage and render the list off
  // that — drilling into one fetches live `GET /ledger/history/{binary_id}`.
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      (b) =>
        b.productName.toLowerCase().includes(q) ||
        b.batchNumber.toLowerCase().includes(q) ||
        b.binaryId.includes(q) ||
        (b.nafdacReg ?? "").toLowerCase().includes(q)
    );
  }, [batches, search]);

  return (
    <div>
      <PageHeader
        eyebrow="Custody"
        title="Batches"
        description="Batches you've initiated against the SquadCo ledger. Drill any row for its live provenance."
        actions={
          <Link href="/batches/new">
            <Button variant="primary" leadingIcon={<Plus />}>
              Initialize batch
            </Button>
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[240px] max-w-[420px]">
          <Input
            placeholder="Search product, batch number, binary id, NAFDAC reg…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            trailing={
              <Search className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            }
          />
        </div>
        <span className="ml-auto text-caption uppercase text-[var(--text-tertiary)]">
          <MonoText size="sm">{filtered.length}</MonoText> of{" "}
          <MonoText size="sm">{batches.length}</MonoText> initiated
        </span>
      </div>

      {hydrated && batches.length === 0 ? (
        <Card className="mt-6 text-center" padded>
          <Package className="mx-auto h-6 w-6 text-[var(--text-tertiary)]" />
          <CardTitle className="mt-2">No batches yet.</CardTitle>
          <CardDescription>
            Initiate one against the SquadCo ledger — it will appear here
            and route to its live provenance.
          </CardDescription>
          <div className="mt-4">
            <Link href="/batches/new">
              <Button variant="primary" leadingIcon={<Plus />}>
                Initialize a batch
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="mt-4 overflow-hidden" padded={false}>
          <table className="w-full border-collapse">
            <thead className="bg-[var(--bg-inset)]">
              <tr className="text-left">
                <Th>Binary ID</Th>
                <Th>Product</Th>
                <Th>Batch #</Th>
                <Th>NAFDAC</Th>
                <Th>Initiated</Th>
                <Th>Location</Th>
                <Th aria-hidden></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center">
                    <p className="text-small text-[var(--text-tertiary)]">
                      No batches match that search.
                    </p>
                  </td>
                </tr>
              )}
              {filtered.map((b) => (
                <tr
                  key={b.binaryId}
                  className="border-t border-[var(--border-hairline)] hover:bg-[var(--bg-overlay)]"
                >
                  <Td>
                    <Link
                      href={`/batches/${b.binaryId}`}
                      className="block group"
                    >
                      <MonoText
                        size="sm"
                        className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]"
                      >
                        {formatHash(b.binaryId)}
                      </MonoText>
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-medium text-[var(--text-primary)]">
                      {b.productName}
                    </span>
                  </Td>
                  <Td>
                    <MonoText size="sm">{b.batchNumber}</MonoText>
                  </Td>
                  <Td>
                    {b.nafdacReg ? (
                      <MonoText size="sm">{b.nafdacReg}</MonoText>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </Td>
                  <Td>
                    <MonoText size="sm" className="text-[var(--text-secondary)]">
                      {format(new Date(b.initiatedAt), "yyyy-MM-dd HH:mm")}
                    </MonoText>
                  </Td>
                  <Td>
                    {b.latitude != null && b.longitude != null ? (
                      <MonoText size="sm" className="text-[var(--text-tertiary)]">
                        {b.latitude.toFixed(3)}, {b.longitude.toFixed(3)}
                      </MonoText>
                    ) : (
                      <Badge size="sm" status="neutral">
                        no geo
                      </Badge>
                    )}
                  </Td>
                  <Td align="right">
                    <Link href={`/batches/${b.binaryId}`}>
                      <Button size="sm" variant="ghost">
                        Inspect
                      </Button>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{ textAlign: align ?? "left" }}
      className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] border-b border-[var(--border-hairline)]"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{ textAlign: align ?? "left" }}
      className="px-3 py-2.5 text-small align-middle"
    >
      {children}
    </td>
  );
}
