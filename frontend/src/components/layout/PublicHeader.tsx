"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, LayoutDashboard, Menu, X } from "lucide-react";
import { Logo, NEELKANTH_URL } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";

const links = [
  { href: "/why-limitbeyond", label: "Why LimitBeyond" },
  { href: "/join", label: "For Gyms" },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const hasAccess = (user?.grants?.length ?? 0) > 0;
  // "Dashboard" only once registration is complete (access granted, or the gym
  // submitted and awaiting review); until then the button resumes the form.
  const registrationDone = hasAccess || Boolean(user?.pendingGym);
  const dashboardHref = registrationDone ? "/console" : "/admin/register";
  const dashboardLabel = registrationDone ? "Dashboard" : "Complete registration";
  const pathname = usePathname() ?? "";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const onAuth = pathname.startsWith("/admin");

  const linkClass = (active: boolean) =>
    cn(
      "relative py-1 text-sm font-semibold transition-colors",
      active
        ? "text-lb-ink after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-lb-accent"
        : "text-lb-ink2 hover:text-lb-ink",
    );

  return (
    <header className="sticky top-0 z-40 border-b border-lb-glass-line bg-lb-ground/85 backdrop-blur-lg">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5" style={{ height: "4.5rem" }}>
        <Logo />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={linkClass(isActive(link.href))}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={NEELKANTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 py-1 text-sm font-semibold text-lb-ink2 transition-colors hover:text-lb-ink"
          >
            Neelkanth Gym <ArrowUpRight className="size-3.5" />
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {loading ? (
            <span className="h-10 w-44" aria-hidden />
          ) : user ? (
            <Button href={dashboardHref} size="sm">
              <LayoutDashboard className="size-4" /> {dashboardLabel}
            </Button>
          ) : (
            <>
              <Button href="/admin/login" variant="ghost" size="sm" className={cn(onAuth && "border-lb-accent/60 bg-lb-accent/10")}>
                Admin login
              </Button>
              <Button href="/admin/register" size="sm">
                Get started
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            className="flex size-10 cursor-pointer items-center justify-center rounded-full text-lb-ink transition-colors hover:bg-lb-glass-2"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col gap-1 border-t border-lb-glass-line px-5 py-4 md:hidden">
          {[...links, user ? { href: dashboardHref, label: dashboardLabel } : { href: "/admin/login", label: "Admin login" }].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "rounded-[var(--radius-lb-field)] px-3 py-2.5 text-sm font-semibold",
                isActive(link.href) ? "bg-lb-accent/15 text-lb-ink" : "text-lb-ink2 hover:bg-lb-glass-2",
              )}
            >
              {link.label}
            </Link>
          ))}
          <a
            href={NEELKANTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-[var(--radius-lb-field)] px-3 py-2.5 text-sm font-semibold text-lb-ink2 hover:bg-lb-glass-2"
          >
            Neelkanth Gym <ArrowUpRight className="size-3.5" />
          </a>
          {!user && (
            <Button href="/admin/register" className="mt-2">
              Get started
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
