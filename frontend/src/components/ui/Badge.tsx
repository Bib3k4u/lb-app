import { cn } from "@/lib/cn";

type Tone = "good" | "alert" | "accent" | "neutral";

const toneClasses: Record<Tone, string> = {
  good: "bg-lb-good/14 text-lb-good border-lb-good/26",
  alert: "bg-lb-alert/14 text-lb-alert border-lb-alert/26",
  accent: "bg-lb-accent/14 text-lb-accent border-lb-accent/26",
  neutral: "bg-current/8 text-current/60 border-current/15",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-lb-pill)] border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
