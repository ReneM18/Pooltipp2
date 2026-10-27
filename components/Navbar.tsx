"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import RankBadge from "@/components/RankBadge";
import SeasonFrame from "@/components/SeasonFrame";
import SeasonDeco from "@/components/SeasonDeco";
import { useMyOverallRank } from "@/lib/myOverallRank";
import CountUp from "@/components/CountUp";
import { TrophyIcon, GearIcon, CartIcon } from "@/components/Icons";
import { useStartHref } from "@/lib/useStartHref";
import { useHeaderCache, writeHeaderCache } from "@/lib/headerCache";
import { getAvailableRankIcons } from "@/lib/rankTiers";
import { LOW_STARS_THRESHOLD } from "@/lib/poolScore";

export default function Navbar() {
  const {
    displayName,
    freeStars,
    activeRankIcon,
    isRegistered,
    sessionChecked,
    isLowOnStars,
    photos,
    isAdmin,
    authUserId,
    profileLoaded,
    extrasLoaded,
    adminChecked,
  } = useUser();
  // Logo führt zur im Profil gewählten Startseite.
  const startHref = useStartHref();

  const myRank = useMyOverallRank();

  // Beim Öffnen sofort die Werte vom letzten Besuch zeigen (nur Anzeige,
  // lib/headerCache.ts), bis die frischen aus der Datenbank da sind. Vorher
  // stand hier sekundenlang ein Demo-Wert, der dann umsprang.
  const cache = useHeaderCache();
  const showCache = cache !== null && (!sessionChecked || cache.userId === authUserId);
  const loggedIn = sessionChecked ? isRegistered : showCache;
  const coins = profileLoaded ? freeStars : showCache ? cache.coins ?? null : null;
  // Rote Warnung nur für Eingeloggte: Gäste haben gar kein Guthaben.
  const lowOnCoins = loggedIn && (profileLoaded ? isLowOnStars : coins !== null && coins <= LOW_STARS_THRESHOLD);
  const name = profileLoaded ? displayName : showCache ? cache.name ?? "" : "";
  const photo = extrasLoaded ? photos[0] : showCache ? cache.photo ?? null : null;
  const badge =
    profileLoaded && extrasLoaded
      ? activeRankIcon
      : showCache && cache.rangPunkte && cache.rankIconId
        ? getAvailableRankIcons(cache.rangPunkte, cache.prestige ?? {}).find((o) => o.id === cache.rankIconId) ?? null
        : null;
  // Admin-Knopf: nur Anzeige, der Admin-Bereich prüft selbst über die Datenbank.
  const showAdmin = isAdmin || (!adminChecked && showCache && cache.isAdmin === true);
  const cachedRank = showCache && (!sessionChecked || myRank.status === "loading") ? cache.rank ?? null : null;

  // Platz fürs nächste Öffnen merken (ohne Platz: nichts zeigen).
  const rankToCache = myRank.status === "ranked" ? myRank.rank : myRank.status === "none" ? null : undefined;
  useEffect(() => {
    if (authUserId && rankToCache !== undefined) writeHeaderCache(authUserId, { rank: rankToCache });
  }, [authUserId, rankToCache]);
  // Am Handy nur "3." (Platz passt sonst nicht neben Sterne und Profilbild),
  // ab Tablet-Breite ausgeschrieben "Platz 3".
  const rankLabel =
    myRank.status === "ranked" ? (
      <>
        <span className="hidden sm:inline">Platz </span>
        {myRank.rank.toLocaleString("de-DE")}
        <span className="sm:hidden">.</span>
      </>
    ) : cachedRank !== null ? (
      <>
        <span className="hidden sm:inline">Platz </span>
        {cachedRank.toLocaleString("de-DE")}
        <span className="sm:hidden">.</span>
      </>
    ) : myRank.status === "loading" ? (
      "…"
    ) : (
      "–"
    );
  const rankTitle =
    myRank.status === "ranked"
      ? `Dein Gesamtplatz: ${myRank.rank} von ${myRank.players} Spielern`
      : myRank.status === "none" && myRank.reason === "guest"
        ? "Einloggen, um in die Rangliste zu kommen"
        : myRank.status === "none" && myRank.reason === "noPoints"
          ? "Noch kein Platz: Sammle mit deinem ersten richtigen Tipp Punkte"
          : "Zur Rangliste";

  return (
    <header className="relative border-b border-edge bg-pitch/95 backdrop-blur">
      <SeasonDeco />
      <div className="relative mx-auto flex max-w-3xl lg:max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-5 sm:py-4">
        <Link
          href={startHref}
          // Logo = "zurück an den Anfang": die Tipps-Seite vergisst den
          // angeklickten Reiter und zeigt wieder Offen, wenn es offene Spiele
          // gibt (auch wenn man schon auf der Seite ist, Rene 09.10.2026).
          onClick={() => window.dispatchEvent(new Event("pooltipp:logo"))}
          className="shrink-0 font-logo text-[22px] font-bold min-[380px]:text-2xl tracking-wide text-ink transition-opacity hover:opacity-80 sm:text-3xl"
        >
          Pool<span className="text-gold">Tipp</span>
        </Link>

        {/* Drei Knöpfe mit Abstand dazwischen, damit man am Handy sicher
            trifft, und jeder führt irgendwo hin, statt nur eine Zahl zu
            zeigen (Rene, 27.10.2026): Warenkorb mit Coins → Shop, Pokal mit
            Platz → Rangliste, Profilbild → Profil. Dazwischen nur noch der
            Admin-Knopf, den sowieso nur der Admin sieht. */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Warenkorb mit Coin-Stand: am Handy genauso wie am PC. So sieht
              man sein Guthaben und kann es an derselben Stelle einsetzen. */}
          <Link
            href="/shop"
            title={loggedIn ? (lowOnCoins ? "Deine Coins werden knapp – zum Shop" : "Deine Coins – zum Shop") : "Prämien-Shop"}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 transition-colors sm:gap-2 sm:px-3 sm:py-1.5 ${
              lowOnCoins ? "border-red-400/60 bg-red-400/10" : "border-gold/60 bg-surface hover:border-gold hover:bg-gold/10"
            }`}
          >
            <CartIcon className="h-4 w-4 shrink-0 text-gold sm:h-[18px] sm:w-[18px]" />
            {loggedIn && (
              <span className={`font-display text-base font-semibold sm:text-lg ${lowOnCoins ? "text-red-400" : "text-ink"}`}>
                {/* Noch nichts bekannt (erstes Öffnen): kurz "…" statt einer
                    falschen Zahl. */}
                {coins === null ? "…" : <CountUp value={coins} />}
              </span>
            )}
          </Link>

          {/* Admin-Knopf nur für den Admin-Account (Prüfung über die
              Datenbank, siehe isAdmin in lib/UserContext.tsx). */}
          {showAdmin && (
            <Link
              href="/admin"
              title="Admin-Bereich"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-muted transition-colors hover:border-gold hover:text-gold sm:h-9 sm:w-9"
            >
              <GearIcon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
            </Link>
          )}

          {/* Gesamtplatz in der Rangliste (Summe aller Punkte). Die
              Saison-Pass-XP stehen nur noch im Saison-Pass. */}
          <Link
            href="/rangliste"
            className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-surface px-2 py-1 transition-colors hover:border-action sm:gap-2 sm:px-3 sm:py-1.5"
            title={rankTitle}
          >
            <TrophyIcon className="h-4 w-4 text-action sm:h-[18px] sm:w-[18px]" />
            <span className="font-display text-base font-semibold text-ink sm:text-lg">{rankLabel}</span>
          </Link>

          {/* Profilbild nur für Eingeloggte. Gäste haben kein Profil und
              sehen stattdessen "Einloggen". Solange beim Laden noch nicht
              feststeht, wer da ist, bleibt der Platz leer. */}
          {!sessionChecked && !showCache ? (
            <span className="ml-0.5 h-11 w-11 shrink-0" aria-hidden />
          ) : !loggedIn ? (
            <Link
              href="/registrieren"
              className="ml-0.5 shrink-0 whitespace-nowrap rounded-full border border-gold px-2.5 py-1 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch sm:px-3 sm:py-1.5"
            >
              Einloggen
            </Link>
          ) : (
            // Profilbild 40 px (mit Saison-Rahmen 46 px), die Tippfläche ist
            // mindestens 44 px groß, damit man am Handy gut ins Profil kommt.
            <Link
              href="/profil"
              title="Mein Profil"
              className="relative ml-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center"
            >
              <SeasonFrame size={40}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-base font-semibold text-muted transition-colors hover:text-ink">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Profilbild" className="h-full w-full object-cover" />
                  ) : (
                    name.slice(0, 1).toUpperCase()
                  )}
                </span>
              </SeasonFrame>
              {badge && (
                <span className="absolute -bottom-1 -right-1.5 rounded-full">
                  <RankBadge option={badge} size="kopf" />
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
