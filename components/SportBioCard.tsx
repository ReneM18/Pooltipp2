"use client";

import { CSSProperties, ReactNode, useMemo, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import RankBadge from "@/components/RankBadge";
import { RankIconOption } from "@/lib/rankTiers";
import { SEASON_THEME } from "@/lib/seasonTheme";
import {
  bioSport,
  COUNTRIES,
  honorIcon,
  isBioEmpty,
  isFanRole,
  mainRole,
  roleDef,
  sortedHonors,
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

export default function SportBioCard({
  bio,
  name,
  photo,
  rankIcon,
  place,
  points,
  streak,
  onEdit,
  compact = false,
  className = "",
}: {
  bio: SportBio | null;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
  points?: number | null;
  streak?: number | null;
  // Nur im eigenen Profil: öffnet den Baukasten unter Einstellungen.
  onEdit?: () => void;
  // Kleiner, rechts oben im Profil am PC.
  compact?: boolean;
  className?: string;
}) {
  const own = !!onEdit;
  if (!bio || isBioEmpty(bio.data)) {
    if (!own) return null;
    return (
      <button
        type="button"
        onClick={onEdit}
        className={`group relative mb-8 block w-full overflow-hidden rounded-card ${className} border border-gold/50 bg-gradient-to-br from-gold/20 via-surface to-surface p-5 text-left transition-colors hover:border-gold`}
      >
        <span aria-hidden className="pointer-events-none absolute -right-2 -top-3 select-none text-7xl opacity-20">
          🃏
        </span>
        <p className="font-display text-xs font-bold uppercase tracking-wider text-gold">Neu · Deine Sportlerkarte</p>
        <p className="mt-1 font-display text-lg font-bold text-ink">Zeig, was du mit Sport zu tun hast</p>
        <p className="mt-1 max-w-md text-sm text-muted">
          Ex-Vereinsspieler, Jugendtrainer, Schiri oder Fan seit 1998? Deine Laufbahn als Sammelkarte in den Farben deines Vereins.
        </p>
        <span className="mt-3 inline-block rounded-full bg-gold px-4 py-1.5 font-display text-sm font-semibold text-pitch transition-opacity group-hover:opacity-90">
          Karte gestalten
        </span>
      </button>
    );
  }
  return (
    <section aria-label="Sportlerkarte" className={`${compact ? "" : "mb-8"} ${className}`}>
      {/* Klein: ganze Karte verkleinert, damit Schrift und Abstände stimmen. */}
      <div style={compact ? { zoom: 0.78 } : undefined}>
        <SportCard bio={bio} name={name} photo={photo} rankIcon={rankIcon} place={place} points={points} streak={streak} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
        {!compact && <span>Antippen zum Umdrehen</span>}
        {own && (
          <>
            <span>
              {bio.visibility === "public" ? "👁️ Sehen alle" : bio.visibility === "friends" ? "👥 Sehen deine Freunde" : "🔒 Für andere ausgeblendet"}
            </span>
            <button type="button" onClick={onEdit} className="font-semibold text-gold hover:underline">
              Bearbeiten
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/** Die Karte selbst, auch als Live-Vorschau im Baukasten. */
// v5 (Rene, 20.10.2026): vorne alles Wichtige ohne Jahre, unten die
// PoolTipp-Zahlen; hinten Erfolge mit Verein und Jahr, Laufbahn mit Rolle
// und Verein, Interessen an anderen Sportarten.
export function SportCard({
  bio,
  name,
  photo,
  rankIcon,
  place,
  points,
  streak,
}: {
  bio: SportBio;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
  points?: number | null;
  streak?: number | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const data = bio.data;
  const stations = data.stations ?? [];
  const main = stations[0];
  const second = stations.slice(1).find((st) => !isFanRole(st.role)) ?? stations[1];
  const honors = sortedHonors(data);
  const interests = data.interests ?? [];
  const [c1, c2] = useCardColors(stations, rankIcon);
  const style = data.cardStyle ?? "standard";

  const frame =
    style === "gold"
      ? "linear-gradient(135deg,#8a6a1f,#f5d77a 30%,#b8892c 55%,#ffe9a8 75%,#8a6a1f)"
      : style === "saison"
        ? `linear-gradient(135deg,${SEASON_THEME.colorFrom},${SEASON_THEME.colorTo})`
        : c1;
  const foil = style === "holo" || style === "gold" || style === "saison";
  const flag = main?.land ? COUNTRIES[main.land]?.flag ?? "" : "";
  const sportShort = bioSport(main?.sport)?.label ?? "";
  // Nur ausgefüllte Felder, keine Jahre (Rene, 20.10.2026).
  const facts: [string, string][] = main
    ? ([
        [main.pos ?? "", "Position"],
        [main.league ?? "", "Liga"],
        [honors.length ? `🏆 ${honors.length}` : "", honors.length === 1 ? "Erfolg" : "Erfolge"],
      ] as [string, string][]).filter(([v]) => v)
    : [];
  // Zweite Zeile: weitere Rolle und größter Erfolg.
  const top = honors[0];
  const alsoLine = [
    second ? `+ ${roleDef(second.role).icon} ${stationTitle(second)}` : "",
    top ? `${honorIcon(top.t)} ${top.t}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const vars = { "--c1": c1, "--c2": c2 } as CSSProperties;
  const flip = () => setFlipped((f) => !f);

  return (
    <div className="relative mx-auto w-full max-w-[320px] [perspective:1200px]">
      {/* Umdreh-Pfeil an der Ecke (Rene, 20.10.2026), dreht sich nicht mit. */}
      <button
        type="button"
        onClick={flip}
        aria-label={flipped ? "Vorderseite zeigen" : "Rückseite zeigen"}
        title="Karte umdrehen"
        className="absolute -bottom-3 -right-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-gold text-xl font-bold text-pitch shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-2 ring-pitch transition-transform hover:scale-110 motion-reduce:transition-none"
      >
        <span aria-hidden className={`inline-block transition-transform duration-700 motion-reduce:transition-none ${flipped ? "rotate-180" : ""}`}>
          ↻
        </span>
      </button>
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
                  {[sportShort, main?.pos ? posShort(main.pos) : ""].filter(Boolean).join(" · ")}
                </span>
              </div>
              {rankIcon && (
                <span className="flex items-center gap-1.5 rounded-full bg-black/50 py-0.5 pl-0.5 pr-2.5 ring-1 ring-white/20">
                  <RankBadge option={rankIcon} size="md" />
                  {place ? <span className="font-display text-xs font-bold text-white">#{place}</span> : null}
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
              {main && (
                <span className="inline-block -skew-x-6 rounded bg-gold px-2.5 py-0.5 font-display text-[12px] font-extrabold uppercase tracking-wider text-[#111]">
                  <span className="inline-block skew-x-6">
                    {roleDef(main.role).icon} {stationTitle(main)}
                  </span>
                </span>
              )}
              <p className="mt-1 truncate font-display text-[25px] font-extrabold leading-tight text-white">{name}</p>
              {main && stationPlace(main) && (
                <p className="truncate text-[12.5px] text-[#dfe7e2]">
                  {flag} {stationPlace(main)}
                </p>
              )}
              {alsoLine && <p className="truncate text-[11.5px] text-gold">{alsoLine}</p>}
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
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pr-6 pt-1.5 text-[10.5px] text-[#cfd8d3]">
                <span className="truncate">
                  PoolTipp
                  {points != null && (
                    <>
                      {" "}
                      <b className="font-display text-gold">{points.toLocaleString("de-DE")}</b> Rangpunkte
                    </>
                  )}
                  {streak ? (
                    <>
                      {" "}
                      · 🔥 <b className="font-display text-gold">{streak}</b>
                    </>
                  ) : null}
                </span>
                <span className="shrink-0">{SEASON_THEME.name}</span>
              </div>
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
            <span className="shrink-0 text-[10px] font-semibold text-muted">Sportlerkarte</span>
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
            {honors.length > 0 && (
              <BackSection title="Erfolge">
                <ul className="flex flex-col gap-1.5">
                  {honors.map((h, i) => (
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
          <div className="flex items-center justify-between gap-2 border-t border-edge pr-7 pt-1.5 text-[10px] text-muted">
            <span />
            {bio.verified ? <b className="font-bold text-action">✓ bestätigt von PoolTipp</b> : <span>Angaben vom Spieler selbst</span>}
          </div>
        </div>
      </div>
    </div>
  );
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
