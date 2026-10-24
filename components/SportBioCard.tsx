"use client";

import { CSSProperties, ReactNode, useMemo, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import RankBadge from "@/components/RankBadge";
import { getSportRankIcon, isUnsterblich, PrestigeBySport, RankIconOption, unsterblichIcon } from "@/lib/rankTiers";
import { SEASON_THEME } from "@/lib/seasonTheme";
import { Sport, SPORT_ICONS, sportLabel, SPORTS } from "@/lib/types";
import {
  bioSport,
  COUNTRIES,
  honorIcon,
  isBioEmpty,
  isFanRole,
  mainRole,
  roleDef,
  APP_SPORT_OF_BIO,
  BIO_SPORT_OF_APP,
  sortedHonors,
  SportCardStat,
  useSportCardStats,
  SportBio,
  Station,
  stationPlace,
  stationTitle,
} from "@/lib/sportBio";

// Sportlerkarte im Panini-Stil (Rene, 20.10.2026: Prototyp v4 "weltklasse").
// Vorderseite in den Vereinsfarben mit Rang-Icon, Platz, Hauptrolle und
// Zahlen; antippen dreht sie um und zeigt die Laufbahn mit Erfolgen.
// Editionen (Holo, Gold, Saison) gibt es mit dem Premium-Pass.
// Daten und Regeln: lib/sportBio.ts.

/** Kartenfarben: Verein aus der App (Teamfarben), sonst die Farben des
 * Rang-Icons – Farben verdient man sich (Rene, 20.10.2026). */
export function useCardColors(stations: Station[] | undefined, rankIcon?: RankIconOption | null): [string, string] {
  const { teams } = useAppData();
  return useMemo(() => {
    for (const st of stations ?? []) {
      if (!st.club) continue;
      const team = teams.find((t) => t.name.toLowerCase() === st.club!.toLowerCase());
      if (team) return [team.primaryColor, team.secondaryColor];
    }
    if (rankIcon) return [rankIcon.colorFrom, rankIcon.colorTo];
    return ["#1f7a4a", "#ffffff"];
  }, [stations, rankIcon, teams]);
}

const EMPTY_BIO: SportBio = { data: {}, verified: false, visibility: "friends" };

export default function SportBioCard({
  bio,
  userId,
  name,
  photo,
  rankIcon,
  place,
  points,
  onEdit,
  showEmpty = false,
  compact = false,
  className = "",
}: {
  bio: SportBio | null;
  userId?: string | null;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
  points?: number | null;
  // Nur im eigenen Profil: öffnet den Baukasten unter Einstellungen.
  onEdit?: () => void;
  // Bei Freunden: ohne ausgefüllte Karte trotzdem die leere Karte zeigen.
  showEmpty?: boolean;
  // Kleiner, links oben im Profil am PC.
  compact?: boolean;
  className?: string;
}) {
  const own = !!onEdit;
  const empty = !bio || isBioEmpty(bio.data);
  // Ohne Angaben: eigene Karte und die von Freunden leer mit Name und Bild,
  // sonst gar nicht (Rene, 23.10.2026: "soll ja überall gleich aussehen").
  if (empty && !own && !showEmpty) return null;
  return (
    <section aria-label="Sportlerkarte" className={`${compact ? "" : "mb-8"} ${className}`}>
      {/* Klein: ganze Karte verkleinert, damit Schrift und Abstände stimmen. */}
      <div style={compact ? { zoom: 0.78 } : undefined}>
        <SportCard bio={bio ?? EMPTY_BIO} own={own} userId={userId} name={name} photo={photo} rankIcon={rankIcon} place={place} points={points} />
      </div>
      {own && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>👥 Sehen deine Freunde</span>
          <button type="button" onClick={onEdit} className="font-semibold text-gold hover:underline">
            {empty ? "Karte gestalten" : "Bearbeiten"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Die Karte selbst, auch als Live-Vorschau im Baukasten. */
// v5 (Rene, 20.10.2026): vorne alles Wichtige ohne Jahre, unten die
// PoolTipp-Zahlen; hinten Erfolge mit Verein und Jahr, Laufbahn mit Rolle
// und Verein, Interessen an anderen Sportarten.
export function SportCard({
  bio,
  own = false,
  userId,
  name,
  photo,
  rankIcon,
  place,
  points,
}: {
  bio: SportBio;
  // Eigene Karte: zeigt den Hinweis "Bald kaufbar".
  own?: boolean;
  userId?: string | null;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
  points?: number | null;
}) {
  const [flipped, setFlipped] = useState(false);
  // Gewählte Karte: eine Sportart oder die Unsterblich-Karte (alle Sportarten).
  const [chosen, setChosen] = useState<Sport | "unsterblich" | null>(null);
  const all = useSportCardStats(userId);
  const data = bio.data;
  const stations = data.stations ?? [];
  const honors = sortedHonors(data);
  const interests = data.interests ?? [];

  // Karte pro Sportart (Rene, 20.10.2026): alle Sportarten mit Rangpunkten
  // oder Tipps, dazu die aus der Laufbahn. Start: die mit den meisten Punkten.
  const bioSports = stations.map((st) => APP_SPORT_OF_BIO[st.sport ?? ""]).filter((x): x is Sport => !!x);
  const statSports = (all ?? []).filter((x) => x.points > 0 || (x.tips ?? 0) > 0).map((x) => x.sport);
  const cardSports = SPORTS.filter((sp) => statSports.includes(sp) || bioSports.includes(sp));
  const best = (all ?? []).filter((x) => cardSports.includes(x.sport)).sort((a, b) => b.points - a.points)[0]?.sport;
  // Unsterblich (GOAT in allen Sportarten, lib/rankTiers.ts): eigene Karte mit
  // allen Sportarten (Rene, 20.10.2026: "einheitliches System").
  const pointsBySport = Object.fromEntries((all ?? []).map((x) => [x.sport, x.points])) as Partial<Record<Sport, number>>;
  const prestigeBySport = Object.fromEntries((all ?? []).map((x) => [x.sport, x.prestige])) as PrestigeBySport;
  const immortal = !!all && isUnsterblich(pointsBySport, prestigeBySport);
  const showImmortal = immortal && (chosen === "unsterblich" || chosen === null);
  const sport: Sport | null =
    showImmortal ? null : chosen && chosen !== "unsterblich" && cardSports.includes(chosen) ? chosen : best ?? bioSports[0] ?? null;
  const stat = all?.find((x) => x.sport === sport) ?? null;
  const bioKey = sport ? BIO_SPORT_OF_APP[sport] : undefined;
  const sportStations = bioKey && !showImmortal ? stations.filter((st) => st.sport === bioKey) : stations;
  const main = sportStations.find((st) => !isFanRole(st.role)) ?? sportStations[0];
  const second = sportStations.find((st) => st !== main && !isFanRole(st.role));
  // Erfolge dieser Sportart: mit einem Verein aus dieser Sportart oder ohne Verein.
  const sportHonors = honors.filter((h) => !h.club || sportStations.some((st) => st.club === h.club));

  // Rang, Platz und Punkte dieser Sportart; ohne Daten (SQL fehlt) wie bisher.
  const cardRank = showImmortal
    ? unsterblichIcon("-karte")
    : stat && sport
      ? stat.points > 0
        ? getSportRankIcon(sport, stat.points, "-karte", stat.prestige)
        : null
      : rankIcon ?? null;
  const cardPlace = showImmortal ? place : stat ? stat.place : place;
  // Tipps dieser Karte (für "Kaufbar ab 500 Tipps"); null = unbekannt.
  const cardTips = showImmortal
    ? all && all.every((x) => x.tips != null)
      ? all.reduce((n, x) => n + (x.tips ?? 0), 0)
      : null
    : stat?.tips ?? null;
  const cardPoints = showImmortal ? (all ?? []).reduce((n, x) => n + x.points, 0) : stat ? stat.points : points;
  const [c1, c2] = useCardColors(sportStations, cardRank);
  // Unsterblich-Karte immer in der Gold-Edition mit Glanz.
  const style = showImmortal ? "gold" : data.cardStyle ?? "standard";

  const frame =
    style === "gold"
      ? "linear-gradient(135deg,#8a6a1f,#f5d77a 30%,#b8892c 55%,#ffe9a8 75%,#8a6a1f)"
      : style === "saison"
        ? `linear-gradient(135deg,${SEASON_THEME.colorFrom},${SEASON_THEME.colorTo})`
        : c1;
  const foil = style === "holo" || style === "gold" || style === "saison";
  const flag = main?.land ? COUNTRIES[main.land]?.flag ?? "" : "";
  const sportShort = showImmortal ? "Alle Sportarten" : sport ? sportLabel(sport) : bioSport(main?.sport)?.label ?? "";
  const ribbon = showImmortal
    ? "🐐 Unsterblich"
    : main
      ? `${roleDef(main.role).icon} ${stationTitle(main)}`
      : sport
        ? `${SPORT_ICONS[sport]} ${sportLabel(sport)}-Tipper`
        : "";
  const facts: [string, string][] = showImmortal ? [] : ([
    [main?.pos ?? "", "Position"],
    [main?.league ?? "", "Niveau"],
    [sportHonors.length ? `🏆 ${sportHonors.length}` : "", sportHonors.length === 1 ? "Erfolg" : "Erfolge"],
  ] as [string, string][]).filter(([v]) => v);
  const top = sportHonors[0];
  const alsoLine = showImmortal
    ? main
      ? `${roleDef(main.role).icon} ${stationTitle(main)}`
      : ""
    : [
    second ? `+ ${roleDef(second.role).icon} ${stationTitle(second)}` : "",
    top ? `${honorIcon(top.t)} ${top.t}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const vars = { "--c1": c1, "--c2": c2 } as CSSProperties;
  const flip = () => setFlipped((f) => !f);

  return (
    <div className="mx-auto w-full max-w-[320px] [perspective:1200px]">
      {/* Sportart wechseln: je Sportart das eigene Rang-Abzeichen. */}
      {cardSports.length + (immortal ? 1 : 0) > 1 && (
        <div role="tablist" aria-label="Karte für Sportart" className="mb-3 flex flex-wrap justify-center gap-1.5">
          {immortal && (
            <button
              type="button"
              role="tab"
              aria-selected={showImmortal}
              onClick={() => {
                setChosen("unsterblich");
                setFlipped(false);
              }}
              className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-3 font-display text-xs font-semibold transition-colors ${
                showImmortal ? "border-gold bg-gold/15 text-gold" : "border-edge bg-surface text-muted hover:text-ink"
              }`}
            >
              <RankBadge option={unsterblichIcon("-tab")} size="sm" />
              Unsterblich
            </button>
          )}
          {cardSports.map((sp) => {
            const st = all?.find((x) => x.sport === sp);
            const icon = st && st.points > 0 ? getSportRankIcon(sp, st.points, "-tab", st.prestige) : null;
            const active = !showImmortal && sp === sport;
            return (
              <button
                key={sp}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setChosen(sp);
                  setFlipped(false);
                }}
                className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-3 font-display text-xs font-semibold transition-colors ${
                  active ? "border-gold bg-gold/15 text-gold" : "border-edge bg-surface text-muted hover:text-ink"
                }`}
              >
                {icon ? <RankBadge option={icon} size="sm" /> : <span className="grid h-6 w-6 place-items-center text-sm">{SPORT_ICONS[sp]}</span>}
                {sportLabel(sp)}
              </button>
            );
          })}
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Karte umdrehen: Vorderseite" : "Karte umdrehen: Rückseite"}
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            flip();
          }
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty("--fx", `${((e.clientX - r.left) / r.width) * 100}%`);
        }}
        style={vars}
        className={`relative aspect-[5/7.2] w-full cursor-pointer outline-none transition-transform duration-700 [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Vorderseite */}
        {/* Jede Seite ist nur sichtbar, solange sie vorne ist – sonst schien
            die Vorderseite gespiegelt durch (Rene, 20.10.2026). */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[18px] p-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] [backface-visibility:hidden] [transform:rotateY(0deg)]"
          style={{ background: frame, visibility: flipped ? "hidden" : "visible", transition: "visibility 0s linear 0.35s" }}
        >
          <div
            className="relative h-full overflow-hidden rounded-xl"
            style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${c1} 55%, #000) 0%, #0b100e 72%)` }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{ background: `repeating-linear-gradient(115deg, ${c2} 0 14px, transparent 14px 38px)` }}
            />
            {/* Kopf: Nummer + Sportart links, Rang rechts */}
            <div className="absolute inset-x-3 top-2.5 z-[3] flex items-start justify-between">
              <div className="font-display text-[42px] font-black leading-[0.9] text-white [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
                {data.nr}
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest opacity-90">
                  {[sportShort, main?.pos && !showImmortal ? posShort(main.pos) : ""].filter(Boolean).join(" · ")}
                </span>
              </div>
              {cardRank && (
                <span className="flex items-center gap-1.5 rounded-full bg-black/50 py-0.5 pl-0.5 pr-2.5 ring-1 ring-white/20">
                  <RankBadge option={cardRank} size="md" />
                  {cardPlace ? <span className="font-display text-xs font-bold text-white">#{cardPlace}</span> : null}
                </span>
              )}
            </div>
            {/* Foto; Stempel nur, wenn bestätigt (Rene, 20.10.2026) */}
            <div className="absolute left-1/2 top-[15%] z-[2] aspect-square w-[50%] -translate-x-1/2">
              <div
                className="grid h-full w-full place-items-center overflow-hidden rounded-full font-display text-6xl font-extrabold text-white"
                style={{
                  background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${c1} 70%, #fff) 0%, ${c1} 45%, color-mix(in srgb, ${c1} 50%, #000) 100%)`,
                  border: `4px solid ${c2}`,
                  boxShadow: "0 0 0 4px rgba(0,0,0,0.35)",
                }}
              >
                {data.photo || photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.photo || photo || ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  name.slice(0, 1).toUpperCase()
                )}
              </div>
              {bio.verified && (
                <span className="absolute -right-4 top-1 rotate-12 rounded-md border-2 border-current bg-black/60 px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-wide text-action">
                  ✓ bestätigt
                </span>
              )}
            </div>
            {/* Namensschild */}
            <div className="absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-b from-transparent via-black/80 to-black/90 px-3 pb-2.5 pt-3">
              {ribbon && (
                <span className="inline-block -skew-x-6 rounded bg-gold px-2.5 py-0.5 font-display text-[12px] font-extrabold uppercase tracking-wider text-[#111]">
                  <span className="inline-block skew-x-6">{ribbon}</span>
                </span>
              )}
              <p className="mt-1 truncate font-display text-[25px] font-extrabold leading-tight text-white">{name}</p>
              {main && stationPlace(main) && (
                <p className="truncate text-[12.5px] text-[#dfe7e2]">
                  {flag} {stationPlace(main)}
                </p>
              )}
              {alsoLine && <p className="truncate text-[11.5px] text-gold">{alsoLine}</p>}
              {showImmortal && (
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {(all ?? [])
                    .filter((x) => SPORTS.includes(x.sport))
                    .map((x) => (
                      <div key={x.sport} className="flex min-w-0 flex-col items-center rounded-lg border border-white/10 bg-white/[0.07] px-1 py-1">
                        <RankBadge option={getSportRankIcon(x.sport, x.points, "-u", x.prestige)} size="sm" />
                        <b className="mt-0.5 block truncate font-display text-[11px] text-white">{x.points.toLocaleString("de-DE")}</b>
                      </div>
                    ))}
                </div>
              )}
              {facts.length > 0 && (
                <div className={`mt-2 grid gap-1.5 ${facts.length === 3 ? "grid-cols-3" : facts.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {facts.map(([v, l]) => (
                    <div key={l} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.07] px-1.5 py-1 text-center">
                      <b className="block truncate font-display text-[12.5px] text-white">{v}</b>
                      <i className="block text-[8.5px] uppercase not-italic tracking-wider text-[#aab8b1]">{l}</i>
                    </div>
                  ))}
                </div>
              )}
              {/* PoolTipp-Rangpunkte, beschriftet wie die Felder darüber. Die
                  Tipp-Serie gehört nicht auf die Karte, sie ändert sich täglich
                  (Rene, 20.10.2026). */}
              {cardPoints != null && (
                <div className="mt-1.5 flex items-baseline justify-center gap-1.5 border-t border-white/10 pt-1.5">
                  <b className="font-display text-[13px] text-gold">{cardPoints.toLocaleString("de-DE")}</b>
                  <i className="text-[8.5px] uppercase not-italic tracking-wider text-[#aab8b1]">
                    Rangpunkte{showImmortal ? " gesamt" : sport ? ` ${sportLabel(sport)}` : ""} bei PoolTipp
                  </i>
                </div>
              )}
            </div>
            {foil && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[4] opacity-55 mix-blend-color-dodge transition-[background-position] duration-150"
                style={{
                  background:
                    "linear-gradient(105deg, transparent 30%, rgba(255,240,200,.55) 45%, rgba(160,220,255,.45) 52%, transparent 66%)",
                  backgroundSize: "250% 250%",
                  backgroundPosition: "var(--fx, 30%) 50%",
                }}
              />
            )}
          </div>
        </div>

        {/* Rückseite: Erfolge, Laufbahn, Interessen */}
        <div
          className="absolute inset-0 flex flex-col gap-2.5 overflow-hidden rounded-[18px] border-[3px] bg-surface p-3.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            borderColor: style === "gold" ? "#d4a943" : style === "saison" ? SEASON_THEME.colorFrom : c1,
            visibility: flipped ? "visible" : "hidden",
            transition: "visibility 0s linear 0.35s",
          }}
        >
          <p className="flex items-baseline justify-between gap-2 font-display text-[15px] font-bold text-ink">
            <span className="truncate">{name}</span>
            <span className="shrink-0 text-[10px] font-semibold text-muted">Sportlerkarte · {SEASON_THEME.name}</span>
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pl-1.5">
            {showImmortal && all && all.some((x) => x.tips != null) && (
              <BackSection title="Tipp-Statistik alle Sportarten">
                <p className="-mt-1 text-[10.5px] text-muted">
                  {periodText(
                    all.map((x) => x.firstTip).filter((d): d is string => !!d).sort()[0] ?? null,
                    all.map((x) => x.lastTip).filter((d): d is string => !!d).sort().slice(-1)[0] ?? null
                  )}
                </p>
                <table className="w-full text-[11px] text-ink">
                  <thead>
                    <tr className="text-[8.5px] uppercase tracking-wider text-muted">
                      <th className="pb-1 text-left font-normal">Sportart</th>
                      <th className="pb-1 text-right font-normal">Treffer</th>
                      <th className="pb-1 text-right font-normal">Exakt</th>
                      <th className="pb-1 text-right font-normal">Tipps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {all
                      .filter((x) => (x.tips ?? 0) > 0)
                      .map((x) => {
                        const [treffer, exakt, tips] = statTiles(x);
                        return (
                          <tr key={x.sport} className="border-t border-edge">
                            <td className="py-1">
                              {SPORT_ICONS[x.sport]} {sportLabel(x.sport)}
                            </td>
                            <td className="py-1 text-right font-display font-bold text-gold">{treffer[0]}</td>
                            <td className="py-1 text-right">{exakt[0]}</td>
                            <td className="py-1 text-right">{tips[0]}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </BackSection>
            )}
            {stat && stat.tips != null && stat.tips > 0 && sport && (
              <BackSection title={`Tipp-Statistik ${sportLabel(sport)}`}>
                <p className="-mt-1 text-[10.5px] text-muted">{periodText(stat.firstTip, stat.lastTip)}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {statTiles(stat).map(([v, l]) => (
                    <div key={l} className="min-w-0 rounded-lg border border-edge bg-white/[0.04] px-1.5 py-1.5 text-center">
                      <b className="block truncate font-display text-[15px] text-gold">{v}</b>
                      <i className="block text-[8.5px] uppercase not-italic tracking-wider text-muted">{l}</i>
                    </div>
                  ))}
                </div>
              </BackSection>
            )}
            {sportHonors.length > 0 && (
              <BackSection title="Erfolge">
                <ul className="flex flex-col gap-1.5">
                  {sportHonors.map((h, i) => (
                    <li key={i} className="grid grid-cols-[20px_1fr] items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/[0.08] px-2 py-1.5">
                      <span aria-hidden className="text-sm">
                        {honorIcon(h.t)}
                      </span>
                      <span className="min-w-0 text-[12.5px] font-semibold leading-tight text-ink">
                        {h.t}
                        {h.league ? ` · ${h.league}` : ""}
                        {h.club && <span className="block truncate text-[11px] font-normal text-muted">{h.club}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </BackSection>
            )}
            {stations.length > 0 && (
              <BackSection title="Laufbahn">
                <ul className="flex flex-col gap-1 border-l-2 border-edge pl-3">
                  {stations.map((st, i) => (
                    <li key={i} className="relative text-xs text-ink">
                      <span aria-hidden className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-gold ring-[3px] ring-surface" />
                      <b className="font-semibold">
                        {roleDef(st.role).icon} {stationTitle(st)}
                      </b>
                      {st.club && <span className="text-muted"> · {st.club}</span>}
                    </li>
                  ))}
                </ul>
              </BackSection>
            )}
            {interests.length > 0 && (
              <BackSection title="Interessen">
                <div className="flex flex-wrap gap-1.5">
                  {interests.map((it) => (
                    <span key={it.k} className="rounded-full border border-edge bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-ink">
                      {bioSport(it.k)?.icon} {bioSport(it.k)?.label}
                      {it.fav ? ` · ${it.fav}` : ""}
                    </span>
                  ))}
                </div>
              </BackSection>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-edge pt-1.5 text-[10px] text-muted">
            <span />
            {bio.verified ? <b className="font-bold text-action">✓ bestätigt von PoolTipp</b> : <span>Angaben vom Spieler selbst</span>}
          </div>
        </div>
      </div>
      {/* Umdrehen als klare Schaltfläche unter der Karte (Rene, 20.10.2026:
          der runde Pfeil an der Ecke sah nicht gut aus). */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={flip}
          className="inline-flex items-center gap-2 rounded-full border border-edge bg-surface px-4 py-1.5 font-display text-xs font-semibold text-ink transition-colors hover:border-gold/60 hover:text-gold"
        >
          <FlipIcon />
          {flipped ? "Vorderseite zeigen" : "Rückseite zeigen"}
        </button>
        {/* Nur Hinweis, nicht anklickbar (Rene, 20.10.2026). Nur bei der eigenen
            Karte. Kaufbar frühestens ab BUY_MIN_TIPS Tipps dieser Karte
            (Sportart bzw. alle bei Unsterblich). */}
        {own && (
          <span
            title="Kaufen kann man die Karte später ab 500 getippten Spielen, nur mit klar erkennbarem eigenem Gesicht, nach Antrag und Freigabe. Die Karte wird gedruckt und dir nach Hause geschickt, die Statistik zählt vom ersten Tipp bis zum Kauf."
            className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-dashed border-gold/40 px-3 py-1.5 font-display text-xs font-semibold text-gold/80"
          >
            🛒{" "}
            {cardTips == null
              ? `Kaufbar ab ${BUY_MIN_TIPS} Tipps`
              : cardTips >= BUY_MIN_TIPS
                ? "Kaufbar · bald im Shop"
                : `Kaufbar ab ${BUY_MIN_TIPS} Tipps · noch ${(BUY_MIN_TIPS - cardTips).toLocaleString("de-DE")}`}
          </span>
        )}
      </div>
      {/* Erklärung direkt bei der Karte (Rene, 20.10.2026: "der Text gehört in
          die Nähe der Karte"). */}
      <details className="group mt-2 text-center">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          ℹ️ So funktioniert die Karte <span className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-2 rounded-card border border-edge bg-surface p-3 text-left text-xs leading-relaxed text-muted">
          <ul className="flex flex-col gap-1.5">
            <li>
              <b className="text-ink">Pro Sportart eine Karte:</b> Oben wechselst du die Sportart. Jede Karte zeigt deinen Rang, Platz
              und deine Rangpunkte in dieser Sportart.
            </li>
            <li>
              <b className="text-ink">Rückseite:</b> deine Tipp-Statistik dieser Sportart (Treffer, exakt, Tipps) vom ersten Tipp bis
              heute, dazu Erfolge, Laufbahn und Interessen.
            </li>
            <li>
              <b className="text-ink">Eigene Angaben:</b> Laufbahn und Erfolge trägst du selbst ein, sie bringen keine Punkte. „✓
              bestätigt“ setzt nur der Admin.
            </li>
            <li>
              <b className="text-ink">Unsterblich:</b> Wer in allen Sportarten GOAT ist, bekommt eine eigene Karte mit allen Sportarten.
            </li>
            <li>
              <b className="text-ink">Kaufen (bald):</b> frühestens ab 500 getippten Spielen in der Sportart und nur mit klar
              erkennbarem eigenem Gesicht, nach Antrag und Freigabe. Die Karte wird gedruckt und dir nach Hause geschickt, die
              Statistik darauf zählt vom ersten Tipp bis zum Kauf.
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}

// Frühestens ab so vielen getippten Spielen kaufbar (Rene, 20.10.2026).
const BUY_MIN_TIPS = 500;

function FlipIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

// Kacheln: Treffer in %, exakt in %, Zahl der Tipps (einer Sportart).
function statTiles(st: SportCardStat): [string, string][] {
  const ev = st.evaluated ?? 0;
  const pct = (n: number | null) => (ev > 0 ? `${Math.round(((n ?? 0) / ev) * 100)} %` : "–");
  return [
    [pct(st.richtig), "Treffer"],
    [pct(st.exakt), "Exakt"],
    [(st.tips ?? 0).toLocaleString("de-DE"), "Tipps"],
  ];
}

// Zeitraum der Statistik (Rene, 20.10.2026: "von wann bis wann").
function periodText(first: string | null, last: string | null): string {
  if (!first) return "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Vienna" });
  const a = fmt(first);
  const b = last ? fmt(last) : a;
  return a === b ? `Tipps vom ${a}` : `Tipps vom ${a} bis ${b}`;
}

function BackSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-gold">{title}</p>
      {children}
    </div>
  );
}

// Kurzform der Position für den Kopf: "Mittelfeld" -> "MF".
const POS_SHORT: Record<string, string> = {
  Tor: "TW", Abwehr: "AB", Mittelfeld: "MF", Sturm: "ST", Verteidigung: "VT", Rückraum: "RR", Kreis: "KR", Außen: "AU",
  Aufbau: "PG", Flügel: "F", Center: "C", Quarterback: "QB", "Running Back": "RB", Receiver: "WR", Line: "OL",
  Linebacker: "LB", "Defensive Back": "DB", Kicker: "K", Zuspiel: "ZU", Mitte: "MI", Diagonal: "DI", Libero: "LI",
};
function posShort(pos: string): string {
  return POS_SHORT[pos] ?? pos.slice(0, 2).toUpperCase();
}

/** Kleines Abzeichen mit der Hauptrolle unter dem Namen. */
export function SportBioTag({ bio }: { bio: SportBio | null }) {
  const role = mainRole(bio?.data);
  if (!role) return null;
  return (
    <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/60 bg-gold/15 px-3 py-1 font-display text-xs font-bold text-gold">
      <span aria-hidden>{role[0]}</span>
      {role[1]}
      {bio?.verified && <span className="text-action">✓</span>}
    </span>
  );
}
