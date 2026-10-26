"use client";

import { cn } from "@/lib/cn";

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[var(--radius-lb-pill)] bg-current/5 p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-lb-pill)] px-4 py-2 text-sm font-semibold transition-colors",
            active === tab.key ? "bg-lb-accent text-lb-on-accent" : "text-current/60 hover:bg-current/8 hover:text-current",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px]",
                active === tab.key ? "bg-lb-on-accent/15" : "bg-current/10",
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
