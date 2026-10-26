import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lb-zone-light">
      <AmbientBackground variant="light" />
      <div className="relative z-10">
        <PublicHeader />
        <main>{children}</main>
        <PublicFooter />
      </div>
    </div>
  );
}
