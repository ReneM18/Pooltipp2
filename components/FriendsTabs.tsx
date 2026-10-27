"use client";

import Link from "next/link";
import { useDuels } from "@/lib/DuelsContext";

// Freunde, Feed und Duelle sind ein Bereich "Freunde" mit drei Reitern
// (Rene, 27.10.2026: weniger Punkte im Menü). Die Seiten bleiben unter
// ihren Adressen (/freunde, /feed, /duelle), jede zeigt oben diese Reiter
// statt einer eigenen Überschrift.

type Tab = "freunde" | "feed" | "duelle";

const TABS: { id: Tab; href: string; label: string }[] = [
  { id: "freunde", href: "/freunde", label: "Freunde" },
  { id: "feed", href: "/feed", label: "Feed" },
  { id: "duelle", href: "/duelle", label: "Duelle" },
];

// Gehört die Adresse zum Bereich Freunde? Für die Menüs (aktiver Punkt).
export function isFriendsArea(pathname: string): boolean {
  return TABS.some((t) => pathname.startsWith(t.href));
}

export default function FriendsTabs({ active, className = "mb-4" }: { active: Tab; className?: string }) {
  const { invitesForMe } = useDuels();
  const invites = invitesForMe.length;
  return (
    <div className={className}>
      <h1 className="mb-3 font-display text-xl font-bold text-ink sm:text-2xl">Freunde</h1>
      <nav aria-label="Freunde-Bereich" className="flex gap-1 rounded-full border border-edge bg-surface p-1 sm:inline-flex">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 font-display text-sm font-semibold transition-colors sm:flex-none ${
                on ? "bg-action text-pitch" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.id === "duelle" && invites > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
                  aria-label={`${invites} offene Duell-Einladungen`}
                >
                  {invites}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
