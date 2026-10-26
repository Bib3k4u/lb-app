import Image from "next/image";
import Link from "next/link";

export const NEELKANTH_URL = "https://neelkanthgym.in";

/** "LimitBeyond by Neelkanth Gym" — the platform is LimitBeyond; the NG tile
 *  and the "by Neelkanth Gym" line carry the gym's brand. The tile is yellow
 *  with black letters, so it reads on both dark and light surfaces. */
export function Logo({ href = "/", tagline = true }: { href?: string; tagline?: boolean }) {
  return (
    <Link href={href} aria-label="LimitBeyond by Neelkanth Gym" className="inline-flex items-center gap-3">
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-lb-accent font-heading text-[23px] leading-none font-bold tracking-tight text-lb-on-accent shadow-lb-accent"
      >
        NG
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-heading text-[26px] font-bold tracking-wide uppercase">
          LIMIT<span className="text-lb-accent">BEYOND</span>
        </span>
        {tagline && (
          <span className="mt-1 text-[10px] font-extrabold tracking-[0.2em] text-lb-ink2 uppercase">
            by Neelkanth Gym
          </span>
        )}
      </span>
    </Link>
  );
}

/** The full Neelkanth Gym logo, switching with the theme. */
export function NeelkanthLogo({ className = "h-16 w-auto" }: { className?: string }) {
  return (
    <>
      <Image
        src="/brand/neelkanth-dark.png"
        alt="Neelkanth Gym"
        width={640}
        height={226}
        className={`${className} [[data-theme=light]_&]:hidden`}
      />
      <Image
        src="/brand/neelkanth-light.png"
        alt=""
        aria-hidden="true"
        width={640}
        height={226}
        className={`hidden ${className} [[data-theme=light]_&]:block`}
      />
    </>
  );
}
