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

        <Link
          href="/teams"
          className="my-1.5 ml-auto flex shrink-0 items-center rounded-full bg-blue-500 px-3 py-1.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
        >
          Tipprunden →
        </Link>
      </div>

      {/* Deutet an, dass sich die Leiste noch weiter wischen lässt (z. B.
          bis "Freunde"/"Tipprunden"), statt dass Inhalte einfach unsichtbar
          am Rand abgeschnitten wirken. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-pitch to-transparent" />
    </nav>
  );
}
