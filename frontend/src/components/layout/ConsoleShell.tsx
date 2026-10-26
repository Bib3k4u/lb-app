"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { AmbientBackground } from "./AmbientBackground";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isGymOwner, isSuperAdmin } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const grants = user?.grants ?? [];
  const superAdmin = isSuperAdmin(grants);
  const gymOwner = isGymOwner(grants);
  // A registered-but-not-yet-activated gym owner holds no grants at all
  // (FR-AUTH-16) — every other section needs a real gym scope to mean
  // anything, so there is nothing to link to yet besides the status itself.
  const awaitingActivation = grants.length === 0;

  const nav: NavItem[] = [{ href: "/console", label: "Dashboard", icon: LayoutDashboard }];
  if (!awaitingActivation) {
    if (superAdmin) {
      nav.push({ href: "/console/gyms", label: "Gyms", icon: Building2 });
    } else {
      if (gymOwner) nav.push({ href: "/console/locations", label: "Locations", icon: MapPin });
      nav.push({ href: "/console/roster", label: "Roster", icon: Users });
      nav.push({ href: "/console/verifications", label: "Verifications", icon: ShieldCheck });
      if (gymOwner) nav.push({ href: "/console/plans", label: "Plans", icon: CreditCard });
      nav.push({ href: "/console/feedback", label: "Feedback", icon: MessageSquare });
      nav.push({ href: "/console/insights", label: "Insights", icon: BarChart3 });
    }
  }

  async function onSignOut() {
    await logout();
    router.push("/admin/login");
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/console" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-lb-field)] px-3.5 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-lb-accent text-lb-on-accent" : "text-lb-ink2 hover:bg-lb-glass hover:text-lb-ink",
              )}
            >
              <item.icon className="size-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-lb-glass-line px-3 py-4">
        <Link
          href="/console/profile"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 rounded-[var(--radius-lb-field)] px-3.5 py-2.5 text-sm font-medium text-lb-ink2 hover:bg-lb-glass hover:text-lb-ink"
        >
          <User className="size-4.5" />
          {user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Your profile" : "Your profile"}
        </Link>
        <button
          onClick={onSignOut}
          className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-lb-field)] px-3.5 py-2.5 text-sm font-medium text-lb-ink2 transition-colors hover:bg-lb-glass hover:text-lb-alert"
        >
          <LogOut className="size-4.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="lb-zone-dark h-dvh overflow-hidden">
      <AmbientBackground variant="dark" />
      <div className="relative z-10 flex h-dvh">
        <aside className="hidden h-dvh w-64 shrink-0 overflow-hidden border-r border-lb-glass-line lg:block">
          {SidebarContent}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="lb-overlay absolute inset-y-0 left-0 w-72 overflow-hidden rounded-none border-0">
              {SidebarContent}
            </aside>
          </div>
        )}

        <div className="flex h-dvh flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-lb-glass-line px-5 lg:justify-end">
            <button
              className="flex size-10 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-lb-glass lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            {superAdmin && (
              <span className="hidden rounded-[var(--radius-lb-pill)] bg-lb-accent/14 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-lb-accent sm:inline-flex">
                Super Admin
              </span>
            )}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                className="flex size-10 cursor-pointer items-center justify-center rounded-full text-lb-ink2 transition-colors hover:bg-lb-glass hover:text-lb-ink lg:hidden"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                {mobileOpen && <X className="size-5" />}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto px-5 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
