"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Logisch gruppiert: erst die eigene Spiel-Schleife (Tippen, Spiele,
// Fortschritt), danach alles Community-Bezogene (Rangliste, Feed, Freunde).
// Der Prämien-Shop hat jetzt sein eigenes Icon oben in der Navbar, direkt
// bei der Sterne-Anzeige – daher hier nicht mehr als Tab.
const tabs = [
  { href: "/", label: "Tipps" },
  { href: "/matchcenter", label: "Matchcenter" },
  { href: "/fortschritt", label: "Saison-Pass" },
  { href: "/rangliste", label: "Rangliste" },
  { href: "/feed", label: "Feed" },
  { href: "/freunde", label: "Freunde" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="relative border-b border-edge bg-pitch">
      {/* Handy (Standard, kein Präfix): horizontal scrollbare Leiste zum
          Wischen, Scrollbar versteckt – fühlt sich wie eine native App an.
          touch-pan-x + overscroll-x-contain verhindert, dass das Wischen
          zusätzlich die ganze Seite vertikal "mitzieht".
          Ab sm: (Web/größere Breite) wird stattdessen umgebrochen
          (flex-wrap) statt gescrollt – dort soll NICHTS zur Seite
          geschoben werden und es gibt keine sichtbare Scrollbar, weil der
          Inhalt einfach in eine zweite Zeile rutscht, sobald er nicht mehr
          reinpasst (klassisches, responsives Navbar-Verhalten). */}
      <div className="mx-auto flex max-w-3xl items-stretch gap-0.5 overflow-x-auto px-2 touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-x-visible sm:py-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex shrink-0 items-center px-3 py-3.5 font-display text-lg font-semibold tracking-wide transition-colors ${
                isActive ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />
              )}
            </Link>
          );
        })}

        {/* Am Handy ganz rechts in der Scroll-Leiste (ml-auto). Ab sm:
            fließt die Gruppe stattdessen ganz normal hinter den Reitern mit
            (sm:ml-0) – sonst würde sie beim Umbrechen allein und weit
            rechts in einer eigenen Zeile hängen, mit viel Leerraum davor. */}
        <div className="my-2 ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <Link
            href="/duelle"
            className="flex shrink-0 items-center rounded-full bg-gold px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:opacity-90"
          >
            Duelle
          </Link>
          <Link
            href="/teams"
            className="flex shrink-0 items-center rounded-full bg-blue-500 px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:bg-blue-400"
          >
            Tipprunden
          </Link>
          <Link
            href="/turnier"
            className="flex shrink-0 items-center rounded-full bg-violet-500 px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:bg-violet-400"
          >
            Turniere
          </Link>
        </div>
      </div>
    </nav>
  );
}
