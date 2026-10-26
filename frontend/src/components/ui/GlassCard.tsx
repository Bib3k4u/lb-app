import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
  padded?: boolean;
}

export function GlassCard({ raised, padded = true, className, children, ...rest }: Props) {
  return (
    <div
      className={cn(raised ? "lb-glass-raised" : "lb-glass", padded && "p-4 sm:p-5", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
