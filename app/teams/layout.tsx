import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {/* Die normale Navbar (Sterne, Punkte, Profilbild) bleibt hier bewusst
          sichtbar – vorher wirkte der Tipprunden-Bereich wie eine komplett
          andere App, weil sie komplett verschwand. Die blaue Unterzeile
          darunter kennzeichnet weiterhin optisch, dass man in einem
          eigenen Unterbereich ist. */}
      <div className="sticky top-0 z-20">
        <Navbar />
        <header className="border-b border-blue-400/20 bg-gradient-to-r from-[#0b1220] to-[#0d1512]">
          <div className="mx-auto flex max-w-3xl lg:max-w-6xl items-center justify-between px-5 py-3">
            <Link href="/teams" className="font-display text-base font-bold tracking-wide text-ink">
              PoolTipp <span className="text-blue-400">Teams</span>
            </Link>
            <Link
              href="/"
              className="rounded-full border border-edge px-3 py-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              ← Zurück zu PoolTipp
            </Link>
          </div>
        </header>
      </div>
      {children}
      <Footer />
    </div>
  );
}
