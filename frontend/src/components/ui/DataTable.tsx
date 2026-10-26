"use client";

import { LucideIcon, Inbox } from "lucide-react";
import { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { SkeletonRows } from "./Skeleton";
import { cn } from "@/lib/cn";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  keyFn,
  loading,
  error,
  onRetry,
  emptyIcon,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  onRowClick,
}: Props<T>) {
  if (loading) return <SkeletonRows rows={5} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon ?? Inbox} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto lb-scrollbar">
      <table className="w-full min-w-[560px] border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className={cn("px-4 pb-1 text-left text-[11px] font-bold uppercase tracking-wider text-current/40", col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyFn(row)}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "lb-glass [&>td]:px-4 [&>td]:py-3.5",
                onRowClick && "cursor-pointer transition-colors hover:bg-current/[0.04]",
              )}
            >
              {columns.map((col) => (
                <td key={col.header} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
