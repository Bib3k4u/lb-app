import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of service",
  description: "The terms that govern gym owners, staff and members using LimitBeyond.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:pt-24">
      <h1 className="text-4xl font-extrabold tracking-tight">Terms of service</h1>
      <p className="mt-3 text-sm text-lb-navy/50">Last updated 30 September 2026</p>

      <div className="mt-10 flex flex-col gap-8 text-lb-navy/80">
        <div>
          <h2 className="text-xl font-bold text-lb-navy">1. Who this applies to</h2>
          <p className="mt-2 leading-relaxed">
            These terms apply to anyone using LimitBeyond — as a Gym Owner registering a gym, a Location Admin or
            Trainer managing it, or a Member using the mobile app to check in and train.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">2. Gym registration and verification</h2>
          <p className="mt-2 leading-relaxed">
            A registered gym is placed in a pending state until our team verifies it and a subscription payment is
            recorded. Only once a gym is live can trainers and members register against it. We may decline to verify
            a gym, or suspend a live gym, at our discretion — most commonly for non-payment or misrepresentation of
            the business.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">3. Accounts and access</h2>
          <p className="mt-2 leading-relaxed">
            You are responsible for the security of your own account credentials. A Gym Owner is responsible for the
            Location Admins they appoint, and for the accuracy of member and trainer approvals made within their gym.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">4. Billing</h2>
          <p className="mt-2 leading-relaxed">
            Subscription fees for using LimitBeyond are billed to the Gym Owner and recorded against the gym&apos;s
            account. Plans and pricing you set for your own members are yours to define and collect — LimitBeyond
            records these transactions but is not a party to them.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">5. Acceptable use</h2>
          <p className="mt-2 leading-relaxed">
            You agree not to use LimitBeyond to store or transmit content you do not have the right to, to attempt to
            access data outside your gym or location scope, or to interfere with the platform&apos;s operation.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">6. Termination</h2>
          <p className="mt-2 leading-relaxed">
            Either party may end this relationship at any time. On closure of a gym, its operational data is retained
            for a reasonable period for records purposes, then removed in accordance with our privacy policy.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold text-lb-navy">7. Changes to these terms</h2>
          <p className="mt-2 leading-relaxed">
            We may update these terms from time to time. Continued use of LimitBeyond after an update constitutes
            acceptance of the revised terms.
          </p>
        </div>
      </div>
    </section>
  );
}
