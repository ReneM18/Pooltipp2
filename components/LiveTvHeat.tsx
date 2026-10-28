"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveGame } from "@/lib/live/types";
import { HEAT_LEVELS, heatActions, heatLevel, liveHeat, type HeatLevel, type HeatSnapshot, type HeatStats, type HeatTrend, type LiveHeatResponse } from "@/lib/liveHeat";
import Emoji from "@/components/Emoji";

// Abschnitt "Was läuft gerade im TV?" unter dem Spiel-Detail im Matchcenter
// (Rene, 27.10.2026; seit 28.10.2026 Variante A): je laufendem TV-Spiel eine
// Zeile mit Sender, Stand, Minute und Stufe (🔥 Heiß … 😴 Fad, ▲/▼ = Trend
// der letzten ~10 Min.), oben "Lohnt sich jetzt", Info-Knopf. Nur Spiele mit
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

// Wort-Abzeichen je Stufe (Rene, 28.10.2026: keine Zahlen, nur das Wort).
const LEVEL_CLASS: Record<HeatLevel, string> = {
  heiss: "bg-red-500/20 text-red-300",
  spannend: "bg-amber-500/15 text-amber-300",
  ruhig: "bg-yellow-500/10 text-yellow-200/80",
  fad: "bg-sky-400/15 text-sky-300",
};

function LevelPill({ heat, trend }: { heat: number; trend: HeatTrend }) {
  const level = heatLevel(heat);
  const { emoji, label } = HEAT_LEVELS[level];
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-extrabold ${LEVEL_CLASS[level]}`}>
      <Emoji e={emoji} /> {label}
      {trend === "up" && <span aria-label="wird heißer"> ▲</span>}
      {trend === "down" && <span aria-label="flacht ab"> ▼</span>}
    </span>
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
  // Empfehlung zum Einschalten am heißesten Spiel, aber nur, wenn dort
  // wirklich etwas los ist.
  const top = tiles[0].heat >= 45 ? tiles[0] : null;
  // Eigener Abschnitt mit Abstand, Überschrift und Linie, damit die Karte
  // nicht mit dem Spiel darüber verschwimmt; je Spiel nur eine Zeile
  // (Rene, 28.10.2026, Variante A: "es erschlägt dich mit Zahlen").
  return (
    <section className="mt-8" aria-label="Was läuft gerade im TV?">
      <div className="mb-2.5 flex items-center gap-2.5">
        <h3 className="whitespace-nowrap font-display text-[15px] font-bold text-ink">
          <Emoji e="📺" /> Was läuft gerade im TV?
        </h3>
        <span aria-hidden className="h-px flex-1 bg-edge" />
        <button
          type="button"
          onClick={() => setInfo((v) => !v)}
          aria-expanded={info}
          aria-label="Was ist das?"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
            info ? "border-gold bg-gold text-pitch" : "border-muted/50 text-muted hover:text-ink"
          }`}
        >
          i
        </button>
      </div>
      {info && (
        <div className="mb-3 rounded-lg border border-edge bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          <p className="mb-1.5 font-semibold text-ink">Welches Spiel lohnt sich gerade im TV?</p>
          <p>
            Hier stehen alle laufenden Tippspiele, die im TV kommen, das spannendste zuerst:{" "}
            <span className="text-red-300">🔥 Heiß</span>, <span className="text-amber-300">⚡ Spannend</span>,{" "}
            <span className="text-yellow-200/80">🙂 Ruhig</span> oder <span className="text-sky-300">😴 Fad</span>. ▲ heißt, es wird
            gerade heißer, ▼ flacht ab. Antippen zeigt das Spiel oben.
          </p>
          <p className="mt-1.5">
            Gerechnet wird aus den Live-Zahlen: Schüsse (aufs Tor und aus dem Strafraum zählen mehr), Paraden, Ecken, Karten und
            erwartete Tore (xG). Dazu kommen Tore, Rote Karten und Videobeweise der letzten 15 Minuten, ein knapper Spielstand
            (in der Schlussphase doppelt) und ob beide Teams angreifen. Nach einem Tor ist ein Spiel mindestens „Spannend“. Neu alle
            2 Minuten.
          </p>
        </div>
      )}
      <div className="overflow-hidden rounded-card border border-red-500/35 bg-gradient-to-b from-red-500/[0.07] to-surface/60">
        {top && (
          <button
            type="button"
            onClick={() => onSelect(top.game.id)}
            className="flex w-full items-center gap-2.5 border-b border-red-500/30 bg-red-500/[0.14] px-3 py-2.5 text-left"
          >
            <span aria-hidden className="text-lg">
              <Emoji e="🔥" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold text-ink">
                Lohnt sich jetzt: {top.home} – {top.away}
              </span>
              <span className="block text-[12px] text-muted">jetzt auf {top.tv} einschalten</span>
            </span>
          </button>
        )}
        {tiles.map((t, i) => {
          const selected = t.game.id === selectedId;
          return (
            <button
              key={t.game.id}
              type="button"
              onClick={() => onSelect(t.game.id)}
              aria-pressed={selected}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors ${
                i > 0 ? "border-t border-edge" : ""
              } ${selected ? "bg-surface-hover" : "hover:bg-surface-hover/60"}`}
            >
              <span className="w-12 shrink-0 truncate rounded-md border border-edge bg-surface-hover px-1 py-0.5 text-center text-[10px] font-extrabold text-ink">
                {t.tv}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                {t.home} – {t.away}
              </span>
              <span className="shrink-0 font-display font-bold tabular-nums text-ink">
                {t.homeScore} : {t.awayScore}
              </span>
              <span className="w-9 shrink-0 text-right text-[11px] font-bold text-red-400">{t.game.statusText}</span>
              <LevelPill heat={t.heat} trend={t.trend} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
