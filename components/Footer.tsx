import Link from "next/link";

const LEGAL_LINKS: { href: string; label: string }[] = [
  { href: "/datenschutz", label: "Datenschutzerklärung" },
  { href: "/cookie-richtlinie", label: "Cookie-Richtlinie" },
  { href: "/barrierefreiheit", label: "Barrierefreiheitserklärung" },
  { href: "/agb", label: "Geschäftsbedingungen" },
  { href: "/impressum", label: "Impressum" },
];

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-edge bg-surface/40">
      <div className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
        <h2 className="mb-2 font-display text-base font-bold text-ink">Über PoolTipp</h2>
        <p className="text-sm leading-relaxed text-muted">
          PoolTipp ist das kostenlose Social-Tippspiel für echte Sportfans: Tippe live vor jedem
          Spiel deiner Lieblingsligen (Fußball, NFL, NBA, NHL) das Ergebnis. Dein Einsatz zählt –
          exakt getroffen bringt Sterne-Bonus obendrauf, bei der Tendenz gibt's den Einsatz zurück,
          nur bei einem Fehltipp geht ein Teil verloren, nie alles auf einmal. Je genauer dein Tipp,
          desto mehr Rangliste-Punkte, Sterne und Prämien-Shop-Guthaben sammelst du. Dazu gibt's echte
          Live-Ergebnisse und Tabellen im Matchcenter, einen Saison-Pass mit Belohnungen fürs
          tägliche Reinschauen, eine Rangliste pro Sportart und private Tipprunden für Freunde,
          Verein oder Kollegen. Alles komplett kostenlos – gespielt wird nur um virtuelle Sterne,
          nie um echtes Geld.
        </p>

        <nav className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-edge pt-4">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[11px] text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* suppressHydrationWarning: Jahr wird zur Bauzeit UND im Browser
            berechnet – nur in der einen Sekunde um Silvester könnten die
            beiden minimal auseinanderlaufen. Offizieller React-Standardweg
            für genau diesen Fall, statt es künstlich zu verzögern. */}
        <p className="mt-4 text-xs text-muted" suppressHydrationWarning>
          © {new Date().getFullYear()} PoolTipp
        </p>
      </div>
    </footer>
  );
}
