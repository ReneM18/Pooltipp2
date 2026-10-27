"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveGame } from "@/lib/live/types";
import { HEAT_LEVELS, heatActions, heatLevel, liveHeat, type HeatSnapshot, type HeatStats, type HeatTrend, type LiveHeatResponse } from "@/lib/liveHeat";
import Emoji from "@/components/Emoji";

// Karte "Live im TV" unter dem Spiel-Detail im Matchcenter (Rene,
// 27.10.2026, Variante C): je laufendem TV-Spiel eine Kachel mit Tacho
// 0–100 (wie spannend gerade, ▲/▼ = Trend der letzten ~10 Min.), Schüssen,
// Ecken, Karten und xG, mit Info-Knopf. Nur Spiele mit
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
// Für den Trend: Stände je Spiel (Spielminute + Aktionen), nur im Browser.
const TREND_MINUTES = 10;
const history = new Map<string, HeatSnapshot[]>();
// Jede Antwort nur einmal merken (die Liste rechnet bei jedem Live-Takt neu).
const recorded = new WeakSet<HeatStats>();

function remember(id: string, snap: HeatSnapshot) {
  const list = history.get(id) ?? [];
  const last = list[list.length - 1];
  if (last && last.minute === snap.minute) list[list.length - 1] = snap;
  else if (!last || snap.minute > last.minute) list.push(snap);
  history.set(id, list.filter((x) => snap.minute - x.minute <= 30));
}

// Stand von vor etwa TREND_MINUTES Minuten (mindestens 5 Minuten alt).
function earlierSnapshot(id: string, minute: number): HeatSnapshot | null {
  const list = (history.get(id) ?? []).filter((x) => minute - x.minute >= 5);
  if (list.length === 0) return null;
  return list.reduce((best, x) => (Math.abs(minute - x.minute - TREND_MINUTES) < Math.abs(minute - best.minute - TREND_MINUTES) ? x : best));
}
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
  return heatActions(s) > 0 || minute <= EMPTY_OK_MINUTE;
}

const LEVEL_COLOR = { heiss: "#ef4444", spannend: "#f59e0b", ruhig: "#eab308", fad: "#60a5fa" } as const;

function Gauge({ heat, trend }: { heat: number; trend: HeatTrend }) {
  const level = heatLevel(heat);
  const r = 31;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[74px] w-[74px]" role="img" aria-label={`Spannung ${heat} von 100, ${HEAT_LEVELS[level].label}${trend === "up" ? ", wird heißer" : trend === "down" ? ", flacht ab" : ""}`}>
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
        {/* Keine Zahl im Kreis, sonst denkt man an Minuten (Rene, 27.10.2026). */}
        <span className="text-xl leading-none">
          <Emoji e={HEAT_LEVELS[level].emoji} />
        </span>
        <span className="mt-0.5 text-[10px] font-bold text-ink">
          {HEAT_LEVELS[level].label}
          {trend === "up" && <span className="text-red-400"> ▲</span>}
          {trend === "down" && <span className="text-sky-400"> ▼</span>}
        </span>
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
        const minute = g.game.elapsed ?? 0;
        if (!s || !hasStats(s, minute)) return [];
        const { heat, trend } = liveHeat(g.game, s, earlierSnapshot(g.game.id, minute));
        if (!recorded.has(s)) {
          recorded.add(s);
          remember(g.game.id, { minute, actions: heatActions(s) });
        }
        return [{ ...g, s, heat, trend }];
      })
      .sort((a, b) => b.heat - a.heat);
  }, [games, stats]);

  const [info, setInfo] = useState(false);
  if (tiles.length === 0) return null;
  // Empfehlung zum Einschalten am heißesten Spiel (Rene, 27.10.2026,
  // Variante B), aber nur, wenn dort wirklich etwas los ist.
  const recommend = tiles[0].heat >= 45;
  return (
    <section className="mt-4 rounded-card border border-muted/25 bg-pitch/40 p-3 sm:p-4" aria-label="Was läuft gerade im TV?">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-ink">
          <Emoji e="📺" /> Was läuft gerade im TV?
        </p>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-muted">
            heißestes zuerst
          </span>
          {/* Info (Rene, 27.10.2026: "mach ein Info rein") */}
          <button
            type="button"
            onClick={() => setInfo((v) => !v)}
            aria-expanded={info}
            aria-label="Was ist das?"
            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
              info ? "border-gold bg-gold text-pitch" : "border-muted/50 text-muted hover:text-ink"
            }`}
          >
            i
          </button>
        </span>
      </div>
      {info && (
        <div className="mb-3 rounded-lg border border-edge bg-pitch/60 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          <p className="mb-1.5 font-semibold text-ink">Welches Spiel lohnt sich gerade im TV?</p>
          <p>
            Hier stehen alle laufenden Tippspiele, die im TV kommen. Je voller der Kreis, desto mehr ist gerade los:{" "}
            <span className="text-red-400">🔥 Heiß</span>, <span className="text-amber-400">⚡ Spannend</span>,{" "}
            <span className="text-yellow-400">🙂 Ruhig</span> oder <span className="text-sky-400">😴 Fad</span>. Ist das heißeste Spiel mindestens „Spannend“, bekommt es „Lohnt sich jetzt“: dort einschalten. Antippen zeigt das Spiel oben.
          </p>
          <p className="mt-1.5">
            Gerechnet wird aus den Live-Zahlen: Schüsse (aufs Tor und aus dem Strafraum zählen mehr), Paraden, Ecken, Karten und
            erwartete Tore (xG). Dazu kommen Tore, Rote Karten und Videobeweise der letzten 15 Minuten, ein knapper Spielstand
            (in der Schlussphase doppelt) und ob beide Teams angreifen. ▲ heißt, es wird gerade heißer, ▼ flacht ab.
          </p>
          <p className="mt-1.5">Unten in jeder Kachel: Schüsse, Ecken und Karten beider Teams zusammen, xG = erwartete Tore. Neu alle 2 Minuten.</p>
        </div>
      )}
      <div className={`grid grid-cols-2 gap-2 ${recommend ? "pt-2" : ""}`}>
        {tiles.map((t, i) => {
          const tip = recommend && i === 0;
          const sum = (k: "shots" | "corners" | "cards") => t.s.home[k] + t.s.away[k];
          const xg = t.s.home.xg !== null && t.s.away.xg !== null ? t.s.home.xg + t.s.away.xg : null;
          const selected = t.game.id === selectedId;
          return (
            <button
              key={t.game.id}
              type="button"
              onClick={() => onSelect(t.game.id)}
              aria-pressed={selected}
              className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-colors ${
                tip
                  ? `border-red-500/70 shadow-[0_0_0_1px_rgba(239,68,68,0.25),0_0_18px_-6px_rgba(239,68,68,0.6)] ${selected ? "bg-surface-hover" : "bg-surface hover:bg-surface-hover"}`
                  : selected
                    ? "border-muted/50 bg-surface-hover"
                    : "border-edge bg-surface hover:bg-surface-hover"
              }`}
            >
              {tip && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                  <Emoji e="🔥" /> Lohnt sich jetzt
                </span>
              )}
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
              <Gauge heat={t.heat} trend={t.trend} />
              {tip && (
                <span className="text-[11px] font-bold leading-tight text-red-300">
                  <Emoji e="📺" /> Jetzt auf {t.tv} einschalten
                </span>
              )}
              {/* Klar beschriftet statt nur Symbole (Rene, 27.10.2026). */}
              <span className="text-[10px] leading-snug text-muted">
                <span className="block">
                  {sum("shots")} Schüsse · {sum("corners")} Ecken
                </span>
                <span className="block">
                  {sum("cards")} {sum("cards") === 1 ? "Karte" : "Karten"}
                  {xg !== null && ` · ${xg.toFixed(1).replace(".", ",")} xG`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
