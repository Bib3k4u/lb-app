"use client";

import Link from "next/link";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-12 px-5 text-[15px]",
  lg: "h-14 px-7 text-base",
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-lb-accent text-lb-on-accent shadow-lb-accent hover:brightness-110 hover:-translate-y-px",
  ghost: "border border-current/15 bg-current/5 hover:bg-current/10 hover:-translate-y-px",
  danger: "bg-lb-alert text-white hover:brightness-110 hover:-translate-y-px",
  subtle: "text-current/70 hover:text-current hover:bg-current/8",
};

type Props = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading, fullWidth, href, className, children, disabled, ...rest },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-lb-pill)] font-semibold cursor-pointer transition-all active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});
