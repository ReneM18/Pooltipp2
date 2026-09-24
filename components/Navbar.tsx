"use client";

import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import RankBadge from "@/components/RankBadge";
import { StarIcon, TrophyIcon, GearIcon } from "@/components/Icons";

export default function Navbar() {
  const { displayName, freeStars, points, activeRankIcon } = useUser();

  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-pitch/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-wide text-ink transition-opacity hover:opacity-80 sm:text-2xl"
        >
          Pool<span className="text-gold">Tipp</span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <div
            className="flex items-center gap-1 rounded-full border border-edge bg-surface px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5"
            title="Deine Gratis-Sterne"
          >
            <StarIcon className="h-3.5 w-3.5 text-gold sm:h-4 sm:w-4" />
            <span className="font-display text-sm font-semibold text-ink sm:text-base">
              {freeStars.toLocaleString("de-DE")}
            </span>
          </div>

          <div
            className="flex items-center gap-1 rounded-full border border-edge bg-surface px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5"
            title="Deine Punkte"
          >
            <TrophyIcon className="h-3.5 w-3.5 text-action sm:h-4 sm:w-4" />
            <span className="font-display text-sm font-semibold text-ink sm:text-base">
              {points.toLocaleString("de-DE")}
            </span>
          </div>

          <Link
            href="/registrieren"
            className="hidden rounded-full border border-gold px-3 py-1.5 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch md:block"
          >
            Registrieren
          </Link>

          <Link
            href="/admin"
            title="Admin-Bereich"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-muted transition-colors hover:border-gold hover:text-gold sm:h-8 sm:w-8"
          >
            <GearIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>

          <Link href="/profil" className="relative ml-0.5 flex shrink-0 items-center">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface font-display text-xs font-semibold text-muted transition-colors hover:text-ink sm:h-8 sm:w-8 sm:text-sm">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            {activeRankIcon && (
              <span className="absolute -bottom-1.5 -right-1.5 rounded-full ring-[3px] ring-pitch">
                <RankBadge option={activeRankIcon} size="xs" />
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
