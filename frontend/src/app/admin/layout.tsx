import type { Metadata } from "next";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lb-zone-dark">
      <AmbientBackground variant="dark" />
      <div className="relative z-10">
        <PublicHeader />
        <main className="flex min-h-[calc(100dvh-4.5rem)] items-center justify-center px-5 py-12 sm:py-16">
          {children}
        </main>
        <PublicFooter />
      </div>
    </div>
  );
}
