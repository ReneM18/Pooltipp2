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
    // Ab Tablet-/Desktop-Breite (sm) kompakter: kleinere Schrift, weniger
    // Abstand, Rechtslinks und © in einer Zeile – damit der Footer neben den
    // Spielen nicht so viel Platz einnimmt. Am Handy bleibt die gut lesbare
    // größere Schrift.
    <footer className="mt-10 border-t border-edge bg-surface/40 sm:mt-6">
      <div className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8 sm:py-4">
        <h2 className="mb-2 font-display text-base font-bold text-ink sm:mb-1 sm:text-sm">
          Über PoolTipp
        </h2>
        <p className="text-sm leading-relaxed text-muted sm:text-xs sm:leading-normal">
          PoolTipp ist das kostenlose Social-Tippspiel für echte Sportfans: Tippe live vor jedem
          Spiel deiner Lieblingsligen (Fußball, NFL, NBA, NHL) das Ergebnis. Jeder Tipp ist gratis
          und bringt Rangliste-Punkte – je genauer, desto mehr. Bei den Booster-Spielen des Tages
          setzt du zusätzlich Sterne ein: exakt getroffen gibt's das Dreifache zurück, bei der
          Tendenz den Einsatz, nur bei einem Fehltipp geht die Hälfte verloren. Dazu gibt's echte
          Live-Ergebnisse und Tabellen im Matchcenter, einen Saison-Pass mit Belohnungen fürs
          tägliche Reinschauen, eine Rangliste pro Sportart und private Tipprunden für Freunde,
          Verein oder Kollegen. Alles komplett kostenlos – gespielt wird nur um virtuelle Sterne,
          nie um echtes Geld.
        </p>

        <div className="mt-5 flex flex-col gap-4 border-t border-edge pt-4 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-3">
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
          <p className="shrink-0 text-xs text-muted sm:text-[11px]" suppressHydrationWarning>
            © {new Date().getFullYear()} PoolTipp
          </p>
        </div>
      </div>
    </footer>
  );
}
