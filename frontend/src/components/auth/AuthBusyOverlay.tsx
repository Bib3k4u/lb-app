import { Loader2 } from "lucide-react";

/** Covers its (relatively positioned) parent while an auth step is in flight,
 *  so the pause between Google closing and the next screen never looks hung. */
export function AuthBusyOverlay({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[inherit] bg-lb-ground/85 backdrop-blur-sm"
    >
      <Loader2 className="size-8 animate-spin text-lb-accent" />
      <p className="text-sm font-semibold text-lb-ink">{label}</p>
    </div>
  );
}
