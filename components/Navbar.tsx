"use client";

import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import RankBadge from "@/components/RankBadge";
import SeasonFrame from "@/components/SeasonFrame";
import { StarIcon, TrophyIcon, GearIcon, CartIcon } from "@/components/Icons";

export default function Navbar() {
  const { displayName, freeStars, passXP, activeRankIcon, isRegistered, isLowOnStars, photos, isAdmin } = useUser();

  return (
    <header className="border-b border-edge bg-pitch/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl lg:max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-5 sm:py-4">
        <Link
          href="/"
          className="font-logo text-2xl font-bold tracking-wide text-ink transition-opacity hover:opacity-80 sm:text-3xl"
        >
          Pool<span className="text-gold">Tipp</span>
        </Link>

        {/* Reihenfolge von links nach rechts: Warenkorb, Einstellungen,
            Registrieren (nur solange man nicht registriert ist), Sterne,
            Ranglisten-Punkte, Profil – die beiden "Punkte"-Anzeigen (Sterne
            und Ranglisten-Punkte) stehen jetzt bewusst zusammen direkt vorm
            Profilbild, statt durch den Warenkorb getrennt zu sein. */}
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/shop"
            title="Prämien-Shop"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/60 bg-surface text-gold transition-colors hover:border-gold hover:bg-gold/10 sm:h-9 sm:w-9"
          >
            <CartIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </Link>

          {/* Admin-Knopf nur für den Admin-Account (Prüfung über die
              Datenbank, siehe isAdmin in lib/UserContext.tsx). */}
          {isAdmin && (
            <Link
              href="/admin"
              title="Admin-Bereich"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-muted transition-colors hover:border-gold hover:text-gold sm:h-9 sm:w-9"
            >
              <GearIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </Link>
          )}

          {!isRegistered && (
            <Link
              href="/registrieren"
              className="hidden rounded-full border border-gold px-3 py-1.5 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch md:block"
            >
              Einloggen
            </Link>
          )}

          <div
            className={`flex items-center gap-0.5 rounded-full px-0.5 py-1 sm:gap-2 sm:border sm:px-3 sm:py-1.5 ${
              isLowOnStars
                ? "sm:border-red-400/60 sm:bg-red-400/10"
                : "sm:border-edge sm:bg-surface"
            }`}
            title={isLowOnStars ? "Deine Gratis-Sterne werden knapp" : "Deine Gratis-Sterne"}
          >
            <StarIcon className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${isLowOnStars ? "text-red-400" : "text-gold"}`} />
            <span
              className={`font-display text-base font-semibold sm:text-lg ${
                isLowOnStars ? "text-red-400" : "text-ink"
              }`}
            >
              {freeStars.toLocaleString("de-DE")}
            </span>
          </div>

          <div
            className="flex items-center gap-0.5 rounded-full px-0.5 py-1 sm:gap-2 sm:border sm:border-edge sm:bg-surface sm:px-3 sm:py-1.5"
            title="Deine Saison-Pass-XP"
          >
            <TrophyIcon className="h-4 w-4 text-action sm:h-[18px] sm:w-[18px]" />
            <span className="font-display text-base font-semibold text-ink sm:text-lg">
              {passXP.toLocaleString("de-DE")}
            </span>
          </div>

          <Link href="/profil" className="relative ml-0.5 flex shrink-0 items-center">
            <SeasonFrame size={32}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-sm font-semibold text-muted transition-colors hover:text-ink sm:h-9 sm:w-9 sm:text-base">
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt="Profilbild" className="h-full w-full object-cover" />
                ) : (
                  displayName.slice(0, 1).toUpperCase()
                )}
              </span>
            </SeasonFrame>
            {activeRankIcon && (
              <span className="absolute -bottom-1.5 -right-1.5 rounded-full">
                <RankBadge option={activeRankIcon} size="xs" />
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
