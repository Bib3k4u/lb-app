import Link from "next/link";
import { Logo, NEELKANTH_URL, NeelkanthLogo } from "./Logo";

export function PublicFooter() {
  return (
    <footer className="relative z-10 mt-24 border-t border-lb-glass-line bg-lb-ground text-lb-ink">
      <div className="lb-ambient" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <div className="mt-5">
              <a href={NEELKANTH_URL} target="_blank" rel="noopener noreferrer" aria-label="Neelkanth Gym website">
                <NeelkanthLogo className="h-14 w-auto" />
              </a>
            </div>
            <p className="mt-4 max-w-xs text-sm text-lb-ink2">
              The operations platform for gym owners — roster, plans, billing, attendance and feedback across every
              location, in one console.
            </p>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-dim">Platform</p>
            <div className="flex flex-col gap-2 text-sm text-lb-ink2">
              <Link href="/why-limitbeyond" className="hover:text-lb-ink">
                Why LimitBeyond
              </Link>
              <Link href="/join" className="hover:text-lb-ink">
                For gym owners
              </Link>
              <Link href="/admin/login" className="hover:text-lb-ink">
                Admin login
              </Link>
              <a href={NEELKANTH_URL} target="_blank" rel="noopener noreferrer" className="hover:text-lb-ink">
                Neelkanth Gym website ↗
              </a>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-dim">Legal</p>
            <div className="flex flex-col gap-2 text-sm text-lb-ink2">
              <Link href="/privacy" className="hover:text-lb-ink">
                Privacy policy
              </Link>
              <Link href="/terms" className="hover:text-lb-ink">
                Terms of service
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-lb-glass-line pt-6 text-xs text-lb-dim sm:flex-row">
          <span>© {new Date().getFullYear()} LimitBeyond. All rights reserved.</span>
          <span>LimitBeyond by Neelkanth Gym · Laxmi Nagar &amp; Madhu Vihar, Delhi</span>
        </div>
      </div>
    </footer>
  );
}
