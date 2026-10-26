"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Point {
  label: string;
  value: number;
}

export function BarChart({ data, valueLabel = "value" }: { data: Point[]; valueLabel?: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) return null;

  return (
    <div>
      <div className="flex h-40 items-stretch gap-1.5" role="img" aria-label={`Bar chart of ${valueLabel} over time`}>
        {data.map((point, i) => {
          const heightPct = Math.max(3, (point.value / max) * 100);
          return (
            <div
              key={point.label}
              className="group relative flex flex-1 flex-col justify-end"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            >
              {hovered === i && (
                <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[#17140f] px-2 py-1 text-[11px] font-semibold text-white shadow-lb-soft">
                  <span className="lb-num">{point.value}</span> · {point.label}
                </div>
              )}
              <div
                className={cn(
                  "w-full rounded-t-[4px] bg-lb-accent/70 transition-colors group-hover:bg-lb-accent",
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 text-center text-[10px] text-current/40">
        {data.map((point) => (
          <span key={point.label} className="flex-1 truncate">
            {point.label}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{valueLabel} by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <td>{point.label}</td>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
