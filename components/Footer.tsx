"use client";

import Link from "next/link";
import { TIPPRUNDEN_ENABLED } from "@/lib/types";
import { CoinIcon } from "./CoinIcon";

// Coin-Symbol mitten im Text, auf Höhe der Schrift.
function Coin() {
  return <CoinIcon className="relative -top-px inline h-[1.05em] w-[1.05em] align-middle" />;
}

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
      <div className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-5 sm:py-4">
        {/* Eingeklappt: die Erklärung steht weiter im Seitentext (gut für
            Suchmaschinen), nimmt aber erst nach Antippen Platz ein. */}
        <details className="group rounded-card border border-edge bg-surface/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <h2 className="font-display text-sm font-bold text-ink">So funktioniert PoolTipp</h2>
            <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gold">
              <span className="group-open:hidden">Aufklappen</span>
              <span className="hidden group-open:inline">Zuklappen</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden>
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </summary>
        {/* Drei kurze Absätze statt einem Block: Rankingsystem, Coins und Joker, Extras. */}
        <div className="flex flex-col gap-2 px-4 pb-4 text-sm leading-relaxed text-muted sm:gap-1 sm:text-xs sm:leading-normal">
          {/* Zuerst die drei Sätze aus der Willkommens-Tour, dann die Zahlen
              (Rene, 14.10.2026). */}
          <ul className="mb-1 flex flex-col gap-1 text-ink">
            <li>🏟️ <strong className="font-semibold">Du tippst gegen alle:</strong> Jedes Spiel ist ein Pool, alle, die es tippen, treten gegeneinander an.</li>
            <li>💪 <strong className="font-semibold">Schlag die Stärkeren:</strong> Tippst du besser als jemand über dir in der Rangliste, gibt es mehr Bonus, gegen Spieler unter dir weniger.</li>
            <li>🏆 <strong className="font-semibold">Steig Rang für Rang auf:</strong> von Bronze über Silber, Gold, Platin, Diamant und Meister bis zum GOAT.</li>
          </ul>
          <p>
            PoolTipp ist das kostenlose Social-Tippspiel für echte Sportfans: Tippe vor jedem Spiel
            deiner Lieblingssportarten (Fußball, American Football, Basketball, Eishockey) das Ergebnis. Jeder Tipp ist gratis und
            bringt Rangpunkte: exakt +10, richtige Tordifferenz +7, richtige Tendenz +5, falsch −3.
            Deine ersten 10 Tipps je Sportart kosten keine Punkte.
            Dazu kommt ein Bonus gegen alle, die dasselbe Spiel getippt haben: Bessere zu schlagen
            bringt doppelt, gegen Schwächere zu verlieren kostet doppelt. Wer zwei Wochen lang gar
            nicht tippt, verliert ab der dritten Woche jede Woche 5 Rangpunkte in jeder Sportart,
            aber nie unter 0. Ein Tipp genügt, und die Strafe ist weg.
          </p>
          {/* Erst wozu Coins da sind, dann woher, dann der (freiwillige)
              Booster – mit unserem Coin-Symbol (Rene, 12.10.2026). */}
          <p>
            <strong className="font-semibold text-ink">
              <Coin /> Coins sind deine Spielwährung.
            </strong>{" "}
            Im Shop tauschst du sie gegen Joker und Trainingstaschen: Mit dem Doppel-Joker zählen bei einem Spiel
            deiner Wahl die festen Punkte doppelt (exakt 20, Tordifferenz 14, Tendenz 10), ein Pause-Joker schützt dich
            eine Woche lang vor der Strafe. <Coin /> Coins bekommst du jeden Tag mit dem Tagesbonus und für
            Tipp-Serien. Bei Booster-Spielen kannst du zusätzlich 20 <Coin /> Coins einsetzen, wenn du willst: Exakt
            gewinnst du 40 dazu, mit der richtigen Tordifferenz 10, bei der richtigen Tendenz behältst du deinen
            Einsatz, ein Fehltipp kostet 10. <Coin /> Coins kann man nie mit echtem Geld kaufen.
          </p>
          {/* Sportlerkarte (Rene, 20.10.2026: "in die Beschreibung reingeben"). */}
          <p>
            <strong className="font-semibold text-ink">🃏 Deine Sportlerkarte:</strong> Im Profil gestaltest du deine Karte
            pro Sportart, mit deinem Foto, deiner Laufbahn (z. B. Ex-Vereinsspieler oder Trainer), deinen Erfolgen, deinem
            Rang-Abzeichen und deiner Tipp-Statistik dieser Sportart. Wer in allen Sportarten GOAT ist, bekommt die
            Unsterblich-Karte mit allen Sportarten. Bald kannst du deine Karte auch kaufen: frühestens ab 500 getippten Spielen
            in dieser Sportart und nur mit einem klar erkennbaren eigenen Gesicht, nach Antrag und Freigabe. Die Statistik
            auf der gekauften Karte zählt von deinem ersten Tipp bis zum Kauf.
          </p>
          <p>
            Dazu gibt's echte Live-Ergebnisse und Tabellen im Matchcenter, einen Saison-Pass mit
            Belohnungen fürs tägliche Reinschauen, eine Rangliste pro Sportart, eine Wochen-Rangliste (Dienstag 8:00 bis
            Dienstag 8:00 Uhr mitteleuropäische Zeit, nur Wochenpunkte aus Tipps aller Sportarten ohne Bonus, der Erste bekommt
            Pass-XP) und
            {TIPPRUNDEN_ENABLED ? " private Tipprunden für Freunde, Verein oder Kollegen" : " Duelle gegen Freunde"}. Alles komplett kostenlos – gespielt wird
            nur um virtuelle Coins, nie um echtes Geld.
          </p>
        </div>
        </details>

        <div className="mt-4 flex flex-col gap-3 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-3">
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
            © {new Date().getFullYear()} PoolTipp · nur virtuelle Coins, nie echtes Geld
          </p>
        </div>
      </div>
    </footer>
  );
}
