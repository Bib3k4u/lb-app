"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  placeholder?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}

export function SearchableSelect({ label, placeholder = "Select…", options, value, onChange, disabled, error, required }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );

  const selected = options.find((opt) => opt.value === value);

  return (
    <div className="relative flex flex-col gap-1.5" ref={containerRef}>
      {label && (
        <span className="text-[13px] font-medium text-current/70">
          {label}
          {required && <span className="ml-0.5 text-lb-alert" aria-hidden="true">*</span>}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-13 cursor-pointer items-center justify-between rounded-[var(--radius-lb-field)] border bg-current/[0.04] px-4 text-left text-[15px] transition-colors hover:bg-current/8 disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-lb-alert" : "border-current/15",
        )}
        style={{ height: "3.25rem" }}
      >
        <span className={selected ? "text-current" : "text-current/40"}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-4 text-current/50 transition-transform", open && "rotate-180")} />
      </button>

      {error && <span className="text-[12px] text-lb-alert">{error}</span>}

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="lb-overlay absolute top-full z-20 mt-2 max-h-64 w-full overflow-y-auto lb-scrollbar p-2">
            <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-lb-field)] bg-lb-glass-2 px-3 py-2">
              <Search className="size-3.5 text-lb-dim" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent text-sm text-lb-ink outline-none placeholder:text-lb-dim"
              />
            </div>
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-lb-dim">No matches</p>}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "block w-full cursor-pointer rounded-[var(--radius-lb-field)] px-3 py-2 text-left text-sm text-lb-ink2 hover:bg-lb-glass-2 hover:text-lb-ink",
                  opt.value === value && "bg-lb-accent/14 text-lb-accent",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
