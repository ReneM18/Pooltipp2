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
        {/* Drei kurze Absätze statt einem Block: Rankingsystem, Sterne und Joker, Extras. */}
        <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted sm:gap-1 sm:text-xs sm:leading-normal">
          <p>
            PoolTipp ist das kostenlose Social-Tippspiel für echte Sportfans: Tippe vor jedem Spiel
            deiner Lieblingsligen (Fußball, NFL, NBA, NHL) das Ergebnis. Jeder Tipp ist gratis und
            bringt Rangpunkte: exakt +10, richtige Tordifferenz +7, richtige Tendenz +5, falsch −3.
            Dazu kommt ein Bonus gegen alle, die dasselbe Spiel getippt haben: Bessere zu schlagen
            bringt doppelt, gegen Schwächere zu verlieren kostet doppelt. Wer zwei Wochen lang gar
            nicht tippt, verliert ab der dritten Woche jede Woche 5 Rangpunkte in jeder Sportart,
            aber nie unter 0. Ein Tipp genügt, und die Strafe ist weg.
          </p>
          <p>
            Bei den Booster-Spielen setzt du 20 Sterne ein: exakt gewinnst du 40 dazu, mit der
            richtigen Tordifferenz 10, bei der richtigen Tendenz behältst du deinen Einsatz, ein
            Fehltipp kostet 10. Sterne gibt's außerdem mit dem täglichen Bonus, eintauschen kannst
            du sie im Shop gegen Joker: Mit dem Doppel-Joker zählen bei einem Spiel deiner Wahl die
            festen Punkte doppelt (exakt 20, Tordifferenz 14, Tendenz 10), ein Pause-Joker schützt
            dich eine Woche lang vor der Strafe.
          </p>
          <p>
            Dazu gibt's echte Live-Ergebnisse und Tabellen im Matchcenter, einen Saison-Pass mit
            Belohnungen fürs tägliche Reinschauen, eine Rangliste pro Sportart und private
            Tipprunden für Freunde, Verein oder Kollegen. Alles komplett kostenlos – gespielt wird
            nur um virtuelle Sterne, nie um echtes Geld.
          </p>
        </div>

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
