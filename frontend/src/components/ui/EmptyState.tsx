import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lb-card)] border border-current/10 border-dashed py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-current/5 text-current/40">
        <Icon className="size-5" />
      </span>
      <p className="font-semibold text-current/80">{title}</p>
      {description && <p className="max-w-sm text-sm text-current/50">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="ghost" size="sm" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
