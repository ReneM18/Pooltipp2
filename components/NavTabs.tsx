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
          Kinder auf derselben Zeilenhöhe, statt einzeln zu zentrieren.
          Anders als vorher wird die Scrollbar NICHT versteckt: dadurch sieht
          man am Desktop sofort, dass die Zeile mehr Inhalt hat und wie man
          weiterscrollt (das war der Grund, warum "Turniere" vorher wie
          abgeschnitten wirkte, ohne dass klar war, wie man's sieht). */}
      <div className="mx-auto flex max-w-3xl items-stretch gap-0.5 overflow-x-auto px-2 touch-pan-x overscroll-x-contain">
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

        {/* Kompakter als vorher (kürzere Labels, kleinerer Text) und in
            derselben Zeile wie die Reiter, damit alles zusammen in einer
            Menüzeile Platz hat. */}
        <div className="my-2 ml-auto flex shrink-0 items-center gap-1">
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
