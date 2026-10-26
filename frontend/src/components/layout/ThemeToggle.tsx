"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

const KEY = "neelkanth-theme";

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      document.documentElement.dataset.theme = event.newValue === "light" ? "light" : "dark";
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("themechange", callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("themechange", callback);
  };
}

const getTheme = () => document.documentElement.dataset.theme || "dark";

/** Dark / light switch. Persists in localStorage; the root layout's inline
 *  script restores it before first paint. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* Theme still works for this visit without storage. */
    }
    window.dispatchEvent(new Event("themechange"));
  };
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "grid size-10 cursor-pointer place-items-center rounded-full border border-lb-glass-line-2 bg-lb-glass text-lb-ink transition hover:bg-lb-accent hover:text-lb-on-accent",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
