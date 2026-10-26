import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lb-card)] border border-lb-alert/25 bg-lb-alert/5 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-lb-alert/14 text-lb-alert">
        <AlertTriangle className="size-5" />
      </span>
      <p className="max-w-sm text-sm text-current/70">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
