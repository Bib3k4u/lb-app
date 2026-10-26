import type { Metadata } from "next";
import { ArrowRight, MessagesSquare, Receipt, ShieldQuestion, Sigma, Split, UserX } from "lucide-react";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/motion/FadeIn";

export const metadata: Metadata = pageMetadata({
  title: "Why LimitBeyond",
  description:
    "The real operational problems multi-location gyms run into — spreadsheets, WhatsApp roster changes, unverifiable payments — and how LimitBeyond solves each one.",
  path: "/why-limitbeyond",
});

const problems = [
  {
    icon: UserX,
    problem: "Anyone can claim to be a member.",
    solution:
      "Every self-registration — member or trainer — sits in a Pending Verification queue until a Gym Owner or Location Admin at that exact location approves it. No membership desk, no access.",
  },
  {
    icon: Split,
    problem: "A trainer who also runs the front desk needs two logins.",
    solution:
      "Authority is a set of grants, not a single role. One account can hold Trainer at one location and Location Admin at another, evaluated independently per location — never a blanket \"admin everywhere\" shortcut.",
  },
  {
    icon: Receipt,
    problem: "Payments get rounded, disputed, or lost in a notebook.",
    solution:
      "Every price is stored as an exact integer — no floating-point rounding on money, ever — and subscription and plan pricing has one source of truth per gym.",
  },
  {
    icon: MessagesSquare,
    problem: "Member complaints disappear into a WhatsApp group.",
    solution:
      "A structured feedback queue per location: submit, respond, resolve, reopen. Nothing depends on someone remembering to scroll up.",
  },
  {
    icon: Sigma,
    problem: "You can't see all your locations at once.",
    solution:
      "One dashboard, every location: active members, check-in trends, trainer activity and memberships expiring soon — consolidated or filtered per branch.",
  },
  {
    icon: ShieldQuestion,
    problem: "You don't know who can see what.",
    solution:
      "A resource outside your scope simply doesn't exist as far as the API is concerned — it returns \"not found,\" never a confirmation that another gym's data exists. Platform administrators get operational reach across gyms, never member-level data depth.",
  },
];

export default function WhyLimitBeyondPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Why LimitBeyond", path: "/why-limitbeyond" },
            ]),
          ),
        }}
      />

      <section className="mx-auto max-w-4xl px-5 pb-20 pt-16 sm:pt-24">
        <FadeIn>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-lb-navy/45">Why LimitBeyond</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Gyms don&apos;t fail on the floor. They fail in the back office.
          </h1>
          <p className="mt-6 text-lg text-lb-navy/70">
            Most gym software is built for a single front desk. The moment you open a second location, or your
            trainer starts covering the front desk, the spreadsheets and shared logins stop making sense. LimitBeyond
            is built around the actual shape of a multi-location gym business — not retrofitted onto one.
          </p>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-24">
        <div className="grid gap-5 md:grid-cols-2">
          {problems.map((item) => (
            <FadeIn key={item.problem}>
              <GlassCard className="h-full border-lb-glass-line bg-lb-glass-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-lb-field)] bg-lb-alert/12 text-lb-alert">
                    <item.icon className="size-4.5" />
                  </span>
                  <p className="pt-1.5 font-bold text-lb-navy">{item.problem}</p>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-lb-navy/65">{item.solution}</p>
              </GlassCard>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
        <FadeIn>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Built for gym owners. Used by every role beneath them.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lb-navy/70">
            Your Location Admins, trainers and members all use the same LimitBeyond mobile app for their own
            day-to-day — check-ins, workouts, progress. This console is where you run the business behind it.
          </p>
          <Button href="/join" size="lg" className="mt-8">
            Register your gym <ArrowRight className="size-4" />
          </Button>
        </FadeIn>
      </section>
    </>
  );
}
