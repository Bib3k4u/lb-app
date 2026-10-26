import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { organizationJsonLd } from "@/lib/jsonld";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { FadeIn } from "@/components/motion/FadeIn";
import { StaggerItem, StaggerList } from "@/components/motion/StaggerList";
import { GymFinder } from "@/components/public/GymFinder";

export const metadata: Metadata = pageMetadata({
  title: "LimitBeyond — Gym operations, made beautifully simple",
  description:
    "One console for gym owners to manage every location: roster verification, plans & billing, attendance, feedback and cross-location insights.",
  path: "/",
});

const features = [
  {
    icon: Users,
    title: "Roster & verification",
    body: "Every member and trainer who joins waits in a verification queue until a Gym Owner or Location Admin approves them — no walk-in ever gets silent access.",
  },
  {
    icon: MapPin,
    title: "Multi-location control",
    body: "Add locations, set check-in radius, review and approve new branches — all from one place, whether you run one gym or twenty.",
  },
  {
    icon: CreditCard,
    title: "Plans & billing",
    body: "Build your pricing catalogue once, sell it at any location, and keep every price in exact rupees — no rounding surprises.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance, verified",
    body: "QR and geofenced check-ins feed a live attendance stream you can see per location, per day, per member.",
  },
  {
    icon: MessageSquare,
    title: "Member feedback",
    body: "A structured feedback queue per location — respond, resolve, reopen — so nothing gets lost in a WhatsApp group.",
  },
  {
    icon: BarChart3,
    title: "Cross-location insights",
    body: "Consolidated dashboards across every branch: active members, check-in trends, trainer activity, subscriptions due.",
  },
];

const steps = [
  {
    title: "Register your gym",
    body: "Tell us about your gym and your first location — takes under five minutes.",
  },
  {
    title: "We verify you",
    body: "Our team confirms your details so every gym on the platform is a real, operating business.",
  },
  {
    title: "Subscription activated",
    body: "Once your subscription is recorded, your gym goes live on the platform.",
  },
  {
    title: "Open your doors",
    body: "Members and trainers can now find your gym, register, and your team can start approving them.",
  },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-20 pt-16 sm:pt-24">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <FadeIn>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-lb-navy/50">
              For gym owners running one location or twenty
            </p>
            <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-tight text-lb-navy sm:text-[56px]">
              Run every location from{" "}
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute inset-x-0 bottom-[0.1em] -z-10 h-[0.38em] rounded-sm bg-lb-accent/70" aria-hidden />
                one console
              </span>
              .
            </h1>
            <p className="mt-6 max-w-lg text-lg text-lb-navy/70">
              LimitBeyond is the operations platform behind the gym floor: roster verification, locations, plans,
              billing, attendance and feedback — all in one place, while your trainers and members keep training in
              the app.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/join" size="lg">
                I run a gym <ArrowRight className="size-4" />
              </Button>
              <Button href="/admin/login" variant="ghost" size="lg" className="border-lb-navy/15 bg-lb-navy/5 text-lb-navy">
                Admin login
              </Button>
            </div>
            <p className="mt-5 text-xs text-lb-navy/45">An initiative by Neelkanth Gym</p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="relative mx-auto max-w-sm py-6">
              {/* Ambient glow behind the device — purely decorative */}
              <div
                className="absolute inset-8 -z-10 rounded-[48px] bg-lb-accent/25 blur-3xl"
                aria-hidden
              />

              {/* Device frame */}
              <div className="lb-dark-panel relative rounded-[32px] border border-lb-navy/10 p-3 shadow-[0_30px_70px_-24px_rgba(23,42,53,0.4)]">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
                <div className="rounded-[24px] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-lb-dim">Today at a glance</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "Check-ins", value: "312" },
                      { label: "Active members", value: "1,204" },
                      { label: "Pending approvals", value: "7" },
                      { label: "Locations live", value: "4" },
                    ].map((stat) => (
                      <div key={stat.label} className="lb-glass p-3.5">
                        <p className="lb-num text-2xl font-extrabold text-lb-ink">{stat.value}</p>
                        <p className="text-[11px] text-lb-dim">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-lb-field)] bg-lb-good/14 px-3 py-2.5 text-xs font-semibold text-lb-good">
                    <ShieldCheck className="size-4 shrink-0" />
                    All locations verified &amp; live
                  </div>
                </div>
              </div>

              {/* Floating chips — collage touch, hidden on small screens where space is tight */}
              <div className="absolute -left-8 top-4 hidden -rotate-6 items-center gap-2 rounded-[var(--radius-lb-pill)] border border-lb-glass-line bg-lb-glass-2 px-3.5 py-2 text-xs font-semibold text-lb-navy shadow-[0_16px_30px_-14px_rgba(23,42,53,0.35)] sm:flex">
                <CheckCircle2 className="size-3.5 text-lb-good" /> Check-in verified
              </div>
              <div className="absolute -right-6 bottom-10 hidden rotate-3 items-center gap-2 rounded-[var(--radius-lb-pill)] border border-lb-glass-line bg-lb-glass-2 px-3.5 py-2 text-xs font-semibold text-lb-navy shadow-[0_16px_30px_-14px_rgba(23,42,53,0.35)] sm:flex">
                <ShieldCheck className="size-3.5 text-lb-accent" /> Approved by owner
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <GymFinder />

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <FadeIn>
          <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything a gym owner needs to run operations — nothing a member needs to lift weights.
          </h2>
        </FadeIn>

        <StaggerList className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <GlassCard className="h-full border-lb-glass-line bg-lb-glass-2">
                <span className="flex size-10 items-center justify-center rounded-[var(--radius-lb-field)] bg-lb-accent/16 text-lb-accent">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-lb-navy/65">{feature.body}</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      {/* Why LimitBeyond */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <FadeIn>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-navy/45">Why LimitBeyond</p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Multi-location gyms outgrow spreadsheets fast.
            </h2>
            <p className="mt-5 text-lb-navy/70">
              Membership lists in one sheet, payments in another, trainer assignments in a notebook, feedback in a
              WhatsApp group — it works until it doesn&apos;t. LimitBeyond replaces the sprawl with one console that
              understands gyms: locations, roles, verification, plans and attendance, built as one connected system.
            </p>
            <Button href="/why-limitbeyond" variant="ghost" className="mt-6 border-lb-navy/15 bg-lb-navy/5 text-lb-navy">
              Read the full case <ArrowRight className="size-4" />
            </Button>
          </FadeIn>
          <FadeIn delay={0.1}>
            <GlassCard className="border-lb-glass-line bg-lb-glass-2">
              <div className="flex items-center gap-3">
                <Activity className="size-5 text-lb-accent" />
                <p className="font-bold">Built around one core idea</p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-lb-navy/65">
                Authority in LimitBeyond is scoped to gyms and locations, not just roles. A trainer at your downtown
                branch can also administer your suburban branch — without a second account, and without ever seeing
                another gym&apos;s data. Reach and depth are deliberately kept separate, even for us.
              </p>
            </GlassCard>
          </FadeIn>
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden bg-lb-ground py-24 text-lb-ink">
        <div className="lb-ambient" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5">
          <FadeIn>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-dim">How it works</p>
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              From sign-up to live gym, verified every step.
            </h2>
          </FadeIn>

          <StaggerList className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <StaggerItem key={step.title}>
                <div className="lb-glass h-full p-5">
                  <span className="lb-num flex size-9 items-center justify-center rounded-full bg-lb-accent text-sm font-extrabold text-lb-on-accent">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm text-lb-ink2">{step.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <FadeIn>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to run your gym on one console?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lb-navy/70">
            Registration takes minutes. Our team verifies your gym, activates your subscription, and you&apos;re live.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/join" size="lg">
              Get started <ArrowRight className="size-4" />
            </Button>
            <Button href="/admin/login" variant="ghost" size="lg" className="border-lb-navy/15 bg-lb-navy/5 text-lb-navy">
              Admin login
            </Button>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
