import Link from "next/link";

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-blue-400/20 bg-gradient-to-r from-[#0b1220] to-[#0d1512]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/teams" className="font-display text-xl font-bold tracking-wide text-ink">
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
      {children}
    </div>
  );
}
