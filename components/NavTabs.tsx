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
      {/* Handy & Tablet (Standard, bis lg:): horizontal scrollbare Leiste
          zum Wischen, Scrollbar versteckt – fühlt sich wie eine native App
          an. touch-pan-x + overscroll-x-contain verhindert, dass das
          Wischen zusätzlich die ganze Seite vertikal "mitzieht".
          Ab lg: (echtes Desktop/Web, ≥1024px) ist die Leiste eine eigene,
          für breite Bildschirme gebaute Variante: kein Wischen/Scrollen
          mehr nötig (der Seiteninhalt ist ab lg: ohnehin breiter, siehe
          max-w-5xl unten, dadurch passt alles in eine Zeile), dafür mehr
          Abstand zwischen den Punkten statt der mobil-engen Reiter. */}
      <div className="mx-auto flex max-w-3xl lg:max-w-5xl items-stretch gap-0.5 overflow-x-auto px-2 touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-x-visible lg:gap-1 lg:px-6">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex shrink-0 items-center px-3 py-3.5 font-display text-lg font-semibold tracking-wide transition-colors lg:px-4 ${
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

        {/* Rechtsbündig in derselben Zeile (ml-auto) – am Handy/Tablet ganz
            rechts in der Scroll-Leiste, ab lg: rechts in der einzeiligen
            Desktop-Leiste. lg:flex-wrap oben ist nur ein Sicherheitsnetz,
            falls ein Fenster doch mal knapper ist; normalerweise passt ab
            lg: alles in eine Zeile. */}
        <div className="my-2 ml-auto flex shrink-0 items-center gap-1.5 lg:gap-2">
          <Link
            href="/duelle"
            className="flex shrink-0 items-center rounded-full bg-gold px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:opacity-90 lg:px-3.5 lg:py-1.5 lg:text-sm"
          >
            Duelle
          </Link>
          <Link
            href="/teams"
            className="flex shrink-0 items-center rounded-full bg-blue-500 px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:bg-blue-400 lg:px-3.5 lg:py-1.5 lg:text-sm"
          >
            Tipprunden
          </Link>
          <Link
            href="/turnier"
            className="flex shrink-0 items-center rounded-full bg-violet-500 px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:bg-violet-400 lg:px-3.5 lg:py-1.5 lg:text-sm"
          >
            Turniere
          </Link>
        </div>
      </div>
    </nav>
  );
}
