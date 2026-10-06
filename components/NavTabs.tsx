"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDuels } from "@/lib/DuelsContext";

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
  // Offene Duell-Einladungen als Zahl am Duelle-Knopf.
  const { invitesForMe } = useDuels();

  return (
    <nav className="relative border-b border-edge bg-pitch">
      {/* Handy & Tablet (Standard, bis lg:): horizontal scrollbare Leiste
          zum Wischen, Scrollbar versteckt – fühlt sich wie eine native App
          an. touch-pan-x + overscroll-contain (statt nur -x) +
          overflow-y-hidden verhindern zusammen, dass das seitliche Wischen
          zusätzlich die ganze Seite vertikal "mitzieht" bzw. "schwimmt"
          (die fest angeheftete Kopfzeile in AppChrome.tsx bekommt zusätzlich
          einen GPU-Compositing-Hint, weil position:sticky + horizontales
          Wischen direkt darunter auf iOS Safari sonst zum Ruckeln neigt).
          Ab lg: (echtes Desktop/Web, ≥1024px) ist die Leiste eine eigene,
          für breite Bildschirme gebaute Variante: kein Wischen/Scrollen
          mehr nötig (der Seiteninhalt ist ab lg: ohnehin breiter, siehe
          max-w-5xl unten, dadurch passt alles in eine Zeile), dafür mehr
          Abstand zwischen den Punkten statt der mobil-engen Reiter. */}
      <div className="mx-auto flex max-w-3xl lg:max-w-6xl items-stretch gap-0.5 overflow-x-auto overflow-y-hidden px-2 touch-pan-x overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-x-visible lg:gap-1 lg:px-6">
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
            className="relative flex shrink-0 items-center gap-1 rounded-full bg-gold px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:opacity-90 lg:px-3.5 lg:py-1.5 lg:text-sm"
          >
            <span aria-hidden>⚔️</span> Duelle
            {invitesForMe.length > 0 && (
              <span
                className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white lg:h-5 lg:min-w-5 lg:text-xs"
                aria-label={`${invitesForMe.length} offene Duell-Einladungen`}
              >
                {invitesForMe.length}
              </span>
            )}
          </Link>
          <Link
            href="/teams"
            className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500 px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:bg-blue-400 lg:px-3.5 lg:py-1.5 lg:text-sm"
          >
            <span aria-hidden>👥</span> Tipprunden
          </Link>
          <Link
            href="/turnier"
            className="flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-2.5 py-1 font-display text-xs font-semibold text-pitch transition-colors hover:bg-violet-400 lg:px-3.5 lg:py-1.5 lg:text-sm"
          >
            <span aria-hidden>🏆</span> Turniere
          </Link>
        </div>
      </div>
    </nav>
  );
}
