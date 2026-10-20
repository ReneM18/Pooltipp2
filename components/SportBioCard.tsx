"use client";

import { CSSProperties, useMemo, useRef, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import RankBadge from "@/components/RankBadge";
import { RankIconOption } from "@/lib/rankTiers";
import { SEASON_THEME } from "@/lib/seasonTheme";
import {
  bioSport,
  COUNTRIES,
  isBioEmpty,
  isFanRole,
  mainRole,
  PALETTES,
  roleDef,
  SportBio,
  Station,
  stationPlace,
  stationTitle,
  stationYears,
} from "@/lib/sportBio";

// Sportlerkarte im Panini-Stil (Rene, 20.10.2026: Prototyp v4 "weltklasse").
// Vorderseite in den Vereinsfarben mit Rang-Icon, Platz, Hauptrolle und
// Zahlen; antippen dreht sie um und zeigt die Laufbahn mit Erfolgen.
// Editionen (Holo, Gold, Saison) gibt es mit dem Premium-Pass.
// Daten und Regeln: lib/sportBio.ts.

/** Kartenfarben: Verein aus der App (Teamfarben), sonst gewählte Palette. */
export function useCardColors(stations: Station[] | undefined, palette: number | undefined): [string, string] {
  const { teams } = useAppData();
  return useMemo(() => {
    for (const st of stations ?? []) {
      if (!st.club) continue;
      const team = teams.find((t) => t.name.toLowerCase() === st.club!.toLowerCase());
      if (team) return [team.primaryColor, team.secondaryColor];
    }
    const p = PALETTES[palette ?? 0] ?? PALETTES[0];
    return [p[1], p[2]];
  }, [stations, palette, teams]);
}

export default function SportBioCard({
  bio,
  name,
  photo,
  rankIcon,
  place,
  onEdit,
  compact = false,
  className = "",
}: {
  bio: SportBio | null;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
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
        <SportCard bio={bio} name={name} photo={photo} rankIcon={rankIcon} place={place} />
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
export function SportCard({
  bio,
  name,
  photo,
  rankIcon,
  place,
}: {
  bio: SportBio;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const data = bio.data;
  const stations = data.stations ?? [];
  const main = stations[0];
  const [c1, c2] = useCardColors(stations, data.palette);
  const style = data.cardStyle ?? "standard";

  const frame =
    style === "gold"
      ? "linear-gradient(135deg,#8a6a1f,#f5d77a 30%,#b8892c 55%,#ffe9a8 75%,#8a6a1f)"
      : style === "saison"
        ? `linear-gradient(135deg,${SEASON_THEME.colorFrom},${SEASON_THEME.colorTo})`
        : c1;
  const foil = style === "holo" || style === "gold" || style === "saison";

  // Weitere Sportarten als Kreise; die Hauptsportart steht schon oben links
  // (Rene, 20.10.2026: sonst zwei Fußbälle neben dem Rang-Icon).
  const sports = Array.from(new Set(stations.map((s) => s.sport).filter(Boolean) as string[]))
    .filter((s) => s !== main?.sport)
    .slice(0, 3);
  const flag = main?.land ? COUNTRIES[main.land]?.flag ?? "" : "";
  // Nur ausgefüllte Felder zeigen (Rene, 20.10.2026: kein "–"). Die Sportart
  // steht schon oben links, darum hier nur die Position.
  const facts: [string, string][] = main
    ? ([
        [main.pos ?? "", "Position"],
        [main.league ?? "", "Liga"],
        [main.from ? (main.to ? `${Math.max(0, Number(main.to) - Number(main.from))} J.` : `seit ${main.from}`) : "", "Dabei"],
      ] as [string, string][]).filter(([v]) => v)
    : [];
  const vars = { "--c1": c1, "--c2": c2 } as CSSProperties;

  return (
    <div className="mx-auto w-full max-w-[320px] [perspective:1200px]">
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Karte umdrehen: Vorderseite" : "Karte umdrehen: Laufbahn"}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
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
        <div
          className="absolute inset-0 overflow-hidden rounded-[18px] p-2.5 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] [backface-visibility:hidden]"
          style={{ background: frame }}
        >
          <div
            className="relative h-full overflow-hidden rounded-xl"
            style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${c1} 55%, #000) 0%, #0b100e 70%)` }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-35"
              style={{ background: `repeating-linear-gradient(115deg, ${c2} 0 14px, transparent 14px 38px)` }}
            />
            {/* Kopf: Rückennummer links, Rang + Sportarten rechts */}
            <div className="absolute inset-x-3 top-2.5 z-[3] flex items-start justify-between">
              <div className="font-display text-[44px] font-black leading-[0.9] text-white [text-shadow:0_2px_0_rgba(0,0,0,0.35)]">
                {data.nr}
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest opacity-85">
                  {bioSport(main?.sport)?.label ?? ""}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {rankIcon && (
                  <span className="flex items-center gap-1.5 rounded-full bg-black/50 py-0.5 pl-0.5 pr-2.5 ring-1 ring-white/20">
                    <RankBadge option={rankIcon} size="md" />
                    {place ? <span className="font-display text-xs font-bold text-white">#{place}</span> : null}
                  </span>
                )}
                <div className="flex gap-1">
                  {sports.map((s) => (
                    <span
                      key={s}
                      title={bioSport(s)?.label}
                      className="grid h-8 w-8 place-items-center rounded-full bg-black/45 text-base ring-1 ring-white/20"
                    >
                      {bioSport(s)?.icon}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {/* Foto bzw. Anfangsbuchstabe */}
            <div className="absolute bottom-[37%] left-1/2 z-[2] aspect-square w-[52%] -translate-x-1/2">
              <div
                className="grid h-full w-full place-items-center overflow-hidden rounded-full font-display text-6xl font-extrabold text-white"
                style={{
                  background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${c1} 70%, #fff) 0%, ${c1} 45%, color-mix(in srgb, ${c1} 50%, #000) 100%)`,
                  border: `4px solid ${c2}`,
                  boxShadow: "0 0 0 4px rgba(0,0,0,0.35)",
                }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  name.slice(0, 1).toUpperCase()
                )}
              </div>
              <span
                className={`absolute -right-4 top-1 rotate-12 rounded-md border-2 border-current bg-black/60 px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-wide ${
                  bio.verified ? "text-action" : "text-[#cfd8d3]"
                }`}
              >
                {bio.verified ? "✓ bestätigt" : "eigene Angabe"}
              </span>
            </div>
            {/* Namensschild */}
            <div className="absolute inset-x-0 bottom-0 z-[3] bg-gradient-to-b from-transparent via-black/75 to-black/90 px-3.5 pb-3.5 pt-3">
              {main && (
                <span className="inline-block -skew-x-6 rounded bg-gold px-2.5 py-0.5 font-display text-[13px] font-extrabold uppercase tracking-wider text-[#111]">
                  <span className="inline-block skew-x-6">
                    {roleDef(main.role).icon} {stationTitle(main)}
                  </span>
                </span>
              )}
              <p className="mt-1.5 truncate font-display text-[26px] font-extrabold leading-tight text-white">{name}</p>
              <p className="truncate text-[13px] text-[#dfe7e2]">
                {flag} {main ? stationPlace(main) : ""}
                {main && stationYears(main) ? <span className="opacity-70"> · {stationYears(main)}</span> : null}
              </p>
              {facts.length > 0 && (
                <div className={`mt-2.5 grid gap-1.5 ${facts.length === 3 ? "grid-cols-3" : facts.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {facts.map(([v, l]) => (
                    <div key={l} className="min-w-0 rounded-lg border border-white/10 bg-white/[0.07] px-1.5 py-1 text-center">
                      <b className="block truncate font-display text-[13px] text-white">{v}</b>
                      <i className="block text-[9px] uppercase not-italic tracking-wider text-[#aab8b1]">{l}</i>
                    </div>
                  ))}
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

        {/* Rückseite: Laufbahn und Erfolge */}
        <div
          className="absolute inset-0 flex flex-col gap-2.5 overflow-hidden rounded-[18px] border-[3px] bg-surface p-4 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ borderColor: style === "gold" ? "#d4a943" : style === "saison" ? SEASON_THEME.colorFrom : c1 }}
        >
          <p className="font-display text-base font-bold text-ink">Laufbahn von {name}</p>
          <ul className="flex min-h-0 flex-col gap-2.5 overflow-y-auto border-l-2 border-edge pl-3.5">
            {stations.map((st, i) => (
              <li key={i} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-gold ring-[3px] ring-surface" />
                <p className="font-display text-[11px] font-bold tracking-wide text-gold">{stationYears(st) || " "}</p>
                <p className="text-sm font-semibold text-ink">
                  {roleDef(st.role).icon} {stationTitle(st)}
                  {st.sport && !isFanRole(st.role) ? ` · ${bioSport(st.sport)?.icon ?? ""}` : ""}
                </p>
                <p className="text-xs text-muted">{[stationPlace(st), st.pos, st.league].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
            {data.since && (
              <li className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-gold ring-[3px] ring-surface" />
                <p className="font-display text-[11px] font-bold tracking-wide text-gold">seit {data.since}</p>
                <p className="text-sm font-semibold text-ink">❤️ Sport-Fan</p>
              </li>
            )}
          </ul>
          {(data.honors?.length ?? 0) > 0 && (
            <div className="mt-auto flex flex-wrap gap-1.5">
              {data.honors!.map((h) => (
                <span key={h} className="rounded-full border border-gold/35 bg-gold/15 px-2 py-1 text-[11px] font-semibold text-gold">
                  {h}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
