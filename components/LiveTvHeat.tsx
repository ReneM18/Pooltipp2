"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveGame } from "@/lib/live/types";
import { HEAT_LEVELS, heatLevel, liveHeat, type HeatStats, type LiveHeatResponse } from "@/lib/liveHeat";
import Emoji from "@/components/Emoji";

// Karte "Live im TV" unter dem Spiel-Detail im Matchcenter (Rene,
// 27.10.2026, Variante C): je laufendem TV-Spiel eine Kachel mit Tacho
// 0–100 (wie spannend gerade), Schüssen, Ecken und Karten. Nur Spiele mit
// TV-Sender UND Live-Statistik, das heißeste zuerst; ohne solche Spiele
// keine Karte. Statistik für alle Spiele in einer Abfrage, alle 2 Min.

export interface TvGame {
  game: LiveGame;
  tv: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

const REFRESH_MS = 2 * 60 * 1000;
// Bis hier darf die Statistik noch leer sein, danach gilt sie als kaputt.
const EMPTY_OK_MINUTE = 15;

function useLiveHeat(ids: string[]): Map<string, HeatStats> | null {
  const key = ids.slice().sort().join(",");
  const [stats, setStats] = useState<Map<string, HeatStats> | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      fetch(`/api/live-heat?ids=${key}`)
        .then((res) => res.json() as Promise<LiveHeatResponse>)
        .then((body) => {
          if (cancelled || body.error) return;
          setStats(new Map(body.stats.map((s) => [s.id, s])));
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [key]);
  return stats;
}

function hasStats(s: HeatStats, minute: number): boolean {
  const total = (x: HeatStats["home"]) => x.shots + x.onTarget + x.corners + x.cards;
  return total(s.home) + total(s.away) > 0 || minute <= EMPTY_OK_MINUTE;
}

const LEVEL_COLOR = { heiss: "#ef4444", spannend: "#f59e0b", ruhig: "#eab308", fad: "#60a5fa" } as const;

function Gauge({ heat }: { heat: number }) {
  const level = heatLevel(heat);
  const r = 31;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[74px] w-[74px]" role="img" aria-label={`Spannung ${heat} von 100, ${HEAT_LEVELS[level].label}`}>
      <svg width="74" height="74" viewBox="0 0 74 74" aria-hidden>
        <circle cx="37" cy="37" r={r} fill="none" strokeWidth="7" className="stroke-edge" />
        <circle
          cx="37"
          cy="37"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={LEVEL_COLOR[level]}
          strokeDasharray={`${(c * heat) / 100} ${c}`}
          transform="rotate(-90 37 37)"
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-extrabold leading-none text-ink">{heat}</span>
        <span className="mt-0.5 text-[9px] font-semibold text-muted">{HEAT_LEVELS[level].label}</span>
      </span>
    </div>
  );
}

export default function LiveTvHeat({
  games,
  selectedId,
  onSelect,
}: {
  games: TvGame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const stats = useLiveHeat(games.map((g) => g.game.id));
  const tiles = useMemo(() => {
    if (!stats) return [];
    return games
      .flatMap((g) => {
        const s = stats.get(g.game.id);
        if (!s || !hasStats(s, g.game.elapsed ?? 0)) return [];
        return [{ ...g, s, heat: liveHeat(g.game, s) }];
      })
      .sort((a, b) => b.heat - a.heat);
  }, [games, stats]);

  if (tiles.length === 0) return null;
  return (
    <section className="mt-4 rounded-card border border-muted/25 bg-pitch/40 p-3 sm:p-4" aria-label="Live im TV">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-ink">
          <Emoji e="📺" /> Live im TV
        </p>
        <p className="text-[11px] text-muted">
          {tiles.length} {tiles.length === 1 ? "Spiel" : "Spiele"} · heißestes zuerst
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const sum = (k: keyof HeatStats["home"]) => t.s.home[k] + t.s.away[k];
          const selected = t.game.id === selectedId;
          return (
            <button
              key={t.game.id}
              type="button"
              onClick={() => onSelect(t.game.id)}
              aria-pressed={selected}
              className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-colors ${
                selected ? "border-muted/50 bg-surface-hover" : "border-edge bg-surface hover:bg-surface-hover"
              }`}
            >
              <span className="max-w-full truncate rounded-md border border-edge px-1.5 text-[10px] font-bold text-muted">
                {t.tv} · {t.game.statusText}
              </span>
              <span className="w-full text-xs font-semibold leading-tight text-ink">
                <span className="block truncate">{t.home}</span>
                <span className="block font-display text-[15px] font-bold">
                  {t.homeScore} : {t.awayScore}
                </span>
                <span className="block truncate">{t.away}</span>
              </span>
              <Gauge heat={t.heat} />
              <span className="text-[10px] text-muted">
                <Emoji e="🎯" /> {sum("shots")} Schüsse · <Emoji e="⛳" /> {sum("corners")} · <Emoji e="🟨" /> {sum("cards")}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
