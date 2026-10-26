import { InputHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAdornment?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, leftAdornment, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;

  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[13px] font-medium text-current/70">
          {label}
          {rest.required && <span className="ml-0.5 text-lb-alert" aria-hidden="true">*</span>}
        </span>
      )}
      <span className="relative flex items-center">
        {leftAdornment && <span className="absolute left-4 text-current/60 text-sm">{leftAdornment}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-13 w-full rounded-[var(--radius-lb-field)] border bg-current/[0.04] px-4 text-[15px] text-current outline-none transition-colors placeholder:text-current/40",
            error ? "border-lb-alert" : "border-current/15 focus:border-lb-accent",
            leftAdornment && "pl-11",
            className,
          )}
          style={{ height: "3.25rem" }}
          {...rest}
        />
      </span>
      {error ? (
        <span className="text-[12px] text-lb-alert">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-current/50">{hint}</span>
      ) : null}
    </label>
  );
});
