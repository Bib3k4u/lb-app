import type { Metadata } from "next";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { ConsoleGuard } from "@/components/layout/ConsoleGuard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConsoleGuard>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleGuard>
  );
}
