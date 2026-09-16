"use client";

import Link from "next/link";
import { useUser } from "@/lib/UserContext";

export default function Navbar() {
  const { displayName, freeStars, points } = useUser();

  return (
    <header className="sticky top-0 z-10 border-b border-edge bg-pitch/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3 sm:px-5 sm:py-4">
        <span className="font-display text-lg font-bold tracking-wide text-ink sm:text-2xl">
          Pool<span className="text-gold">Tipp</span>
        </span>

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
            href="/profil"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface font-display text-xs font-semibold text-muted transition-colors hover:text-ink sm:h-8 sm:w-8 sm:text-sm"
          >
            {displayName.slice(0, 1).toUpperCase()}
          </Link>
        </div>
      </div>
    </header>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6L12 17.6 6.1 20.6l1.4-6.6-5-4.6 6.6-.7L12 2.5z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
    >
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" />
      <path d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3" />
      <path d="M12 13v3M9 20h6M9.5 16h5l.5 2a2 2 0 01-2 2h-2a2 2 0 01-2-2l.5-2z" />
    </svg>
  );
}
