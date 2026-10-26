import { LucideIcon } from "lucide-react";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accent?: boolean;
}

export function StatTile({ label, value, icon: Icon, accent }: Props) {
  return (
    <GlassCard className="flex flex-1 flex-col items-start gap-2 min-w-[140px]">
      {Icon && (
        <span className="flex size-9 items-center justify-center rounded-[var(--radius-lb-field)] bg-lb-accent/14 text-lb-accent">
          <Icon className="size-4.5" />
        </span>
      )}
      <span className={cn("lb-num text-[26px] font-extrabold leading-none", accent && "text-lb-accent")}>
        {value}
      </span>
      <span className="text-[12px] font-medium text-current/50">{label}</span>
    </GlassCard>
  );
}
