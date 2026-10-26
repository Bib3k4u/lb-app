import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: "What LimitBeyond collects, why, and who can see it.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:pt-24">
      <h1 className="text-4xl font-extrabold tracking-tight">Privacy policy</h1>
      <p className="mt-3 text-sm text-lb-navy/50">Last updated 30 September 2026</p>

      <div className="prose-lb mt-10 flex flex-col gap-8 text-lb-navy/80">
        <div>
          <h2 className="text-xl font-bold text-lb-navy">What we collect</h2>
          <p className="mt-2 leading-relaxed">
            To register a gym, we collect your gym&apos;s legal and trading name, GSTIN (if provided), and the
            address and coordinates of each location. To create an account, we collect your name, phone number,
            email address, and a password (for console accounts) or a one-time code (for the mobile app). Members
            and trainers using the mobile app may additionally provide a date of birth, gender, height, fitness
            experience level and goals, and — where relevant — health screening information.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">What we deliberately do not collect</h2>
          <p className="mt-2 leading-relaxed">
            LimitBeyond does not support progress photographs anywhere in the product. Progress tracking is limited
            to weight, measurements, body fat percentage, personal records and workout volume — never images of your
            body. Sensitive documents you do upload (such as identity documents for verification) are stored under
            restricted, authenticated access — never as a public link.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">Who can see what</h2>
          <p className="mt-2 leading-relaxed">
            Access is scoped to the gym and location you belong to. Gym Owners and Location Admins can see roster,
            attendance, billing and feedback information within their own gym and the locations they administer —
            never another gym&apos;s data. Platform administrators can see operational information across every gym
            (verification status, subscription state) but hold no more access to any individual&apos;s health
            records, personal data or progress than a Gym Owner does.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">What we never log</h2>
          <p className="mt-2 leading-relaxed">
            Our systems are built to never write passwords, one-time codes, session tokens, full phone numbers, or
            the contents of health screenings or nutrition entries to any log. Logs may contain identifiers (such as
            an account ID), never the content behind them.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">How long we keep it</h2>
          <p className="mt-2 leading-relaxed">
            Operational records (roster, attendance, billing) are retained for as long as your gym is active on the
            platform, plus a reasonable period for financial record-keeping. You can request deletion of your
            personal data at any time by contacting the gym you belong to, or LimitBeyond directly for platform-level
            accounts.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">Contact</h2>
          <p className="mt-2 leading-relaxed">
            Questions about this policy can be directed to your gym&apos;s administrator, or to LimitBeyond support
            directly.
          </p>
        </div>
      </div>
    </section>
  );
}
