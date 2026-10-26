import type { Metadata } from "next";
import { ArrowRight, Building2, Clock, MapPinned, ShieldCheck } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/motion/FadeIn";

export const metadata: Metadata = pageMetadata({
  title: "Join as a gym owner",
  description:
    "Register your gym on LimitBeyond: what we ask for, how verification works, and what your console looks like once you're live.",
  path: "/join",
});

const requirements = [
  { icon: Building2, title: "Your gym's legal details", body: "Legal name, trading name and GSTIN if you have one." },
  {
    icon: MapPinned,
    title: "Your first location",
    body: "Address and GPS coordinates — this sets your check-in geofence radius from day one.",
  },
  {
    icon: Clock,
    title: "A few minutes",
    body: "The registration form itself takes under five minutes to fill in.",
  },
  {
    icon: ShieldCheck,
    title: "Our verification",
    body: "Our team confirms your gym is real before it can accept members — this protects every gym on the platform, including yours.",
  },
];

const faqs = [
  {
    q: "How long does verification take?",
    a: "Our team reviews new gym registrations directly — most are verified within one business day.",
  },
  {
    q: "Can I add more locations later?",
    a: "Yes. Once your gym is live, add as many locations as you run, each with its own address, geofence and roster — all from the same console.",
  },
  {
    q: "Who can log into the console?",
    a: "You, as Gym Owner, get full access across every location. You can appoint Location Admins scoped to specific branches.",
  },
  {
    q: "Do my members need to download anything?",
    a: "Members and trainers use the LimitBeyond mobile app for check-ins, workouts and progress. This console is for running the business side.",
  },
];

export default function JoinPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Join", path: "/join" }])),
        }}
      />

      <section className="mx-auto max-w-4xl px-5 pb-16 pt-16 text-center sm:pt-24">
        <FadeIn>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-navy/45">For gym owners</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Register your gym on LimitBeyond.</h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-lb-navy/70">
            Set up your gym and first location, get verified by our team, and manage every branch from one console —
            while your app stays exactly where your members already are.
          </p>
          <Button href="/admin/register" size="lg" className="mt-8">
            Start registration <ArrowRight className="size-4" />
          </Button>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {requirements.map((req) => (
            <FadeIn key={req.title}>
              <GlassCard className="h-full border-lb-glass-line bg-lb-glass-2 text-center">
                <span className="mx-auto flex size-10 items-center justify-center rounded-[var(--radius-lb-field)] bg-lb-accent/16 text-lb-accent">
                  <req.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-bold">{req.title}</h3>
                <p className="mt-2 text-sm text-lb-navy/65">{req.body}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24">
        <FadeIn>
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Frequently asked</h2>
        </FadeIn>
        <div className="mt-10 flex flex-col gap-4">
          {faqs.map((faq) => (
            <FadeIn key={faq.q}>
              <GlassCard className="border-lb-glass-line bg-lb-glass-2">
                <p className="font-bold">{faq.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-lb-navy/65">{faq.a}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </section>
    </>
  );
}
