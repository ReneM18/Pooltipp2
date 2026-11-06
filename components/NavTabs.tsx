"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDuels } from "@/lib/DuelsContext";
import { TIPPRUNDEN_ENABLED } from "@/lib/types";
import { MATCHCENTER_FIRST } from "@/lib/startPage";

// Menü am PC (ab lg:). Am Handy/Tablet gibt es dafür die feste Leiste unten
// (BottomNav).
// Logisch gruppiert: erst die eigene Spiel-Schleife (Tippen, Spiele,
// Fortschritt), danach alles Community-Bezogene (Rangliste, Feed, Freunde).
const allTabs = [
  { href: "/", label: "Tipps" },
  { href: "/matchcenter", label: "Spiele" },
  // Reihenfolge wie unten am Handy (BottomNav): erst Rangliste, dann Pass
  // (Rene, 27.10.2026).
  { href: "/rangliste", label: "Rangliste" },
  { href: "/fortschritt", label: "Saison-Pass" },
  // Feed ist ein Reiter im Bereich Freunde (FriendsTabs, Rene, 27.10.2026).
  { href: "/freunde", label: "Freunde" },
];

// Matchcenter zuerst, Tipps als zweites (Schalter in lib/startPage.ts).
const tabs = MATCHCENTER_FIRST ? [allTabs[1], allTabs[0], ...allTabs.slice(2)] : allTabs;

// Die Reiter stehen am PC oben in der Logo-Zeile neben "PoolTipp" (Rene,
// 06.11.2026, Variante A: eine Zeile weniger, die Spiele rücken nach oben).
// Die Navbar ruft das hier zwischen Logo und Coins auf. Der Goldstrich der
// gewählten Seite sitzt unten auf der Linie der Logo-Zeile.
export function NavTabLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptmenü" className="-my-4 ml-6 mr-auto hidden items-stretch self-stretch lg:flex xl:ml-10">
      {tabs.map((tab) => {
        const isActive =
          tab.href === "/freunde" ? pathname === "/freunde" || pathname === "/feed" : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            // "Spiele" nochmal antippen: Matchcenter zurück auf "Heute"
            // (Rene, 27.10.2026), siehe app/matchcenter/page.tsx.
            onClick={tab.href === "/matchcenter" ? () => window.dispatchEvent(new Event("pooltipp:spiele")) : undefined}
            className={`relative flex shrink-0 items-center whitespace-nowrap px-2.5 font-display text-base font-semibold tracking-wide transition-colors xl:px-4 xl:text-lg ${
              isActive ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" />}
          </Link>
        );
      })}
    </nav>
  );
}

const pill =
  "relative flex shrink-0 items-center gap-1 rounded-full border border-gold/45 bg-surface px-3 py-1.5 font-display text-sm font-semibold text-ink transition-colors hover:border-gold hover:bg-gold/10";

// Duelle + Turniere am PC (Rene, 06.11.2026, Variante A): im Matchcenter
// rechts in der Zeile mit den Sportarten, auf den anderen Seiten rechts oben
// über dem Inhalt (AppChrome). Am Handy stecken sie in der Leiste unten.
export function DuelTourButtons({ className = "" }: { className?: string }) {
  // Offene Duell-Einladungen als Zahl am Duelle-Knopf.
  const { invitesForMe } = useDuels();
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      {/* Duelle als eigener Knopf (Rene, 27.10.2026: "die Duelle sind weg"). */}
      <Link href="/duelle" className={pill}>
        <span aria-hidden>⚔️</span> Duelle
        {invitesForMe.length > 0 && (
          <span
            className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold leading-none text-white"
            aria-label={`${invitesForMe.length} offene Duell-Einladungen`}
          >
            {invitesForMe.length}
          </span>
        )}
      </Link>
      {TIPPRUNDEN_ENABLED && (
        <Link href="/teams" className={pill}>
          <span aria-hidden>👥</span> Tipprunden
        </Link>
      )}
      <Link href="/turnier" className={pill}>
        <span aria-hidden>🏆</span> Turniere
      </Link>
    </div>
  );
}
