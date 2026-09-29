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
      {/* touch-pan-x + overscroll-x-contain: verhindert, dass ein seitliches
          Wischen über die Reiter auf dem Handy zusätzlich die ganze Seite
          vertikal "mitzieht" (das war das Auf-und-ab-Schwimmen beim
          Bewegen der Leiste). items-stretch statt items-center hält alle
          Kinder auf derselben Zeilenhöhe, statt einzeln zu zentrieren. */}
      <div className="mx-auto flex max-w-3xl items-stretch gap-0.5 overflow-x-auto px-2 touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
      </div>

      {/* Deutet an, dass sich die Reiter-Leiste noch weiter wischen lässt. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 top-0 h-[52px] w-8 bg-gradient-to-l from-pitch to-transparent" />

      {/* Eigene Zeile statt Teil der scrollbaren Reiter-Leiste: mit flex-wrap
          bleiben alle Pills auf jeder Bildschirmbreite sichtbar, statt bei
          schmalem Fenster (z. B. am Desktop ohne Wisch-Geste) rechts
          unsichtbar abgeschnitten zu sein. Trennlinie + eigener
          Hintergrundton heben die Zeile klar von den Reitern ab. */}
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-1.5 border-t border-edge bg-surface/40 px-2 pb-2.5 pt-2">
        <Link
          href="/duelle"
          className="flex shrink-0 items-center rounded-full bg-gold px-3 py-1.5 font-display text-sm font-semibold text-pitch transition-colors hover:opacity-90"
        >
          Duelle →
        </Link>
        <Link
          href="/teams"
          className="flex shrink-0 items-center rounded-full bg-blue-500 px-3 py-1.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
        >
          Tipprunden →
        </Link>
        <Link
          href="/turnier"
          className="flex shrink-0 items-center rounded-full bg-violet-500 px-3 py-1.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-violet-400"
        >
          Turniere →
        </Link>
      </div>
    </nav>
  );
}
