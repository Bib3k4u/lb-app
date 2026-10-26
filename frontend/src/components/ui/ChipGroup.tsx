"use client";

import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function ChipGroup({ label, options, value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] font-medium text-current/70">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer rounded-[var(--radius-lb-pill)] border px-3.5 py-2 text-sm font-medium transition-colors",
              value === opt.value
                ? "border-lb-accent bg-lb-accent text-lb-on-accent"
                : "border-current/15 bg-current/5 text-current/70 hover:bg-current/10 hover:text-current",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
