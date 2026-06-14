"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CheckCircle2,
  XCircle,
  Hourglass,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { MonoText } from "@/components/ui/MonoText";
import { Button } from "@/components/ui/Button";
import { EvidencePanel } from "./EvidencePanel";
import type { MockTransaction } from "@/lib/mock-api/fixtures/transactions";
import { formatHash, formatNGN, formatTimeOfDay } from "@/lib/utils/format";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";

export interface TransactionsTableProps {
  data: MockTransaction[];
}

const TYPE_PILL: Record<
  MockTransaction["type"],
  { label: string; status: "verified" | "risk" | "pending"; icon: React.ComponentType<{ className?: string }> }
> = {
  validated: { label: "Validated", status: "verified", icon: CheckCircle2 },
  fraud_blocked: { label: "Fraud-blocked", status: "risk", icon: XCircle },
  pending: { label: "Pending", status: "pending", icon: Hourglass },
};

export function TransactionsTable({ data }: TransactionsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const columns = React.useMemo<ColumnDef<MockTransaction>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Timestamp",
        cell: ({ row }) => (
          <div className="leading-tight">
            <MonoText size="sm" className="block text-[var(--text-primary)]">
              {format(new Date(row.original.timestamp), "yyyy-MM-dd")}
            </MonoText>
            <MonoText size="sm" className="text-[var(--text-tertiary)]">
              {formatTimeOfDay(row.original.timestamp)}
            </MonoText>
          </div>
        ),
        sortingFn: (a, b) =>
          new Date(a.original.timestamp).getTime() -
          new Date(b.original.timestamp).getTime(),
      },
      {
        id: "counterparty",
        header: "Counterparty",
        accessorFn: (r) => `${r.fromName} → ${r.toName}`,
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight">
            <p className="text-small text-[var(--text-primary)] truncate">
              {row.original.fromName}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)] truncate">
              → {row.original.toName}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => (
          <MonoText
            size="sm"
            className={cn(
              "block text-right",
              row.original.type === "fraud_blocked"
                ? "text-[var(--risk)]"
                : "text-[var(--text-primary)]"
            )}
          >
            {row.original.type === "fraud_blocked" ? "−" : ""}
            {formatNGN(row.original.amount)}
          </MonoText>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const t = TYPE_PILL[row.original.type];
          return (
            <Badge status={t.status} size="sm" dot>
              {t.label}
            </Badge>
          );
        },
      },
      {
        id: "linkedScanId",
        header: "Scan",
        cell: ({ row }) =>
          row.original.linkedScanId ? (
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              {row.original.linkedScanId}
            </MonoText>
          ) : (
            <span className="text-[11px] text-[var(--text-tertiary)]">—</span>
          ),
      },
      {
        id: "linkedBatchId",
        header: "Batch",
        cell: ({ row }) =>
          row.original.linkedBatchId ? (
            <MonoText size="sm" className="text-[var(--text-secondary)]">
              {formatHash(row.original.linkedBatchId, 8, 4)}
            </MonoText>
          ) : (
            <span className="text-[11px] text-[var(--text-tertiary)]">—</span>
          ),
      },
      {
        id: "ref",
        header: "Reference",
        cell: ({ row }) => (
          <MonoText size="sm" className="text-[var(--text-secondary)]">
            {row.original.squadRef ?? row.original.id}
          </MonoText>
        ),
      },
    ],
    []
  );

  const filteredData = React.useMemo(() => {
    if (!globalFilter) return data;
    const q = globalFilter.toLowerCase();
    return data.filter((t) => {
      return (
        t.id.toLowerCase().includes(q) ||
        t.squadRef?.toLowerCase().includes(q) ||
        t.fromName.toLowerCase().includes(q) ||
        t.toName.toLowerCase().includes(q) ||
        t.linkedBatchId?.toLowerCase().includes(q) ||
        t.linkedScanId?.toLowerCase().includes(q)
      );
    });
  }, [data, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)] overflow-hidden">
      {/* Search */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-inset)] px-3 py-2">
        <input
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search ID, reference, counterparty…"
          className="h-7 flex-1 rounded-[5px] border border-[var(--border-hairline)] bg-[var(--bg-elevated)] px-2 font-mono-ui text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--border-focus)]"
        />
        <span className="text-caption uppercase text-[var(--text-tertiary)]">
          <MonoText size="sm">{filteredData.length}</MonoText> rows
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[var(--bg-inset)]">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={
                        canSort ? h.column.getToggleSortingHandler() : undefined
                      }
                      className={cn(
                        "px-3 py-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)] border-b border-[var(--border-hairline)] text-left",
                        canSort && "cursor-pointer hover:text-[var(--text-secondary)]"
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort &&
                          (sorted === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-50" />
                          ))}
                      </span>
                    </th>
                  );
                })}
                <th className="border-b border-[var(--border-hairline)]" />
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-10 text-center text-[var(--text-tertiary)]"
                >
                  No transactions match those filters.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => {
              const isExpanded = expandedId === row.original.id;
              return (
                <React.Fragment key={row.original.id}>
                  <tr
                    onClick={() =>
                      setExpandedId(isExpanded ? null : row.original.id)
                    }
                    className={cn(
                      "cursor-pointer border-t border-[var(--border-hairline)] transition-colors duration-150",
                      isExpanded
                        ? "bg-[var(--bg-overlay)]"
                        : "hover:bg-[var(--bg-overlay)]"
                    )}
                  >
                    {row.getVisibleCells().map((c) => (
                      <td
                        key={c.id}
                        className="px-3 py-2 align-top text-small"
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    ))}
                    <td className="px-3 py-2 align-middle">
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform duration-200",
                          isExpanded && "rotate-180 text-[var(--accent)]"
                        )}
                      />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[var(--bg-inset)]">
                      <td
                        colSpan={columns.length + 1}
                        className="px-3 py-3 border-t border-[var(--border-hairline)]"
                      >
                        <EvidencePanel txn={row.original} />
                        {row.original.blockReason && (
                          <div className="mt-3 rounded-[6px] border border-[var(--risk-border)] bg-[var(--risk-soft)] px-3 py-2 text-[12px] text-[var(--risk)]">
                            <span className="font-semibold uppercase tracking-[0.04em] mr-1">
                              Block reason:
                            </span>
                            {row.original.blockReason}
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-end">
                          <Link href={`/transactions/${row.original.id}`}>
                            <Button size="sm" variant="ghost">
                              Open detail page →
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
