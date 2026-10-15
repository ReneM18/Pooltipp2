"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Sport } from "@/lib/types";
import type { TipResultTier } from "@/lib/poolScore";
import { eventMinuteText, isGoalEvent, shortPlayerName, type LiveEvent, type LiveStatus } from "@/lib/liveScores";
import { useLiveClock } from "@/lib/useLiveMinute";
import type { LiveForecast } from "@/lib/liveForecast";

// Gemeinsame Live-Bausteine für Tippkarte (components/MatchCard.tsx) und
// Matchcenter (app/matchcenter/page.tsx) (Rene, 15.10.2026: Spieltag-Umbau):
// Anzeigetafel, Live-Pill, Zeile "Dein Tipp", "Wenn es so bleibt" und der
// Spielverlauf. Ruhig: Rot nur als kleiner pulsierender Punkt (bei
// "Bewegung reduzieren" ohne Puls, siehe .animate-live-dot), Gold nur für
// den eigenen Tipp bzw. Positives, keine roten Rahmen.

export type BoardState = "live" | "pause" | "finished";

export interface BoardClock {
  state: BoardState;
  text: string; // unter dem Spielstand: "67. Minute", "Halbzeit", "Beendet"
  progress: number | null; // 0..1 für den dünnen Balken, null = keiner
}

// Zustand + Text unter dem Spielstand, Minute zählt im Browser mit.
export function useBoardClock(
  sport: Sport,
  live: { status: LiveStatus; statusText: string; statusShort: string; elapsed: number | null; dataAt: number } | null,
): BoardClock {
  const clock = useLiveClock(sport, live?.statusShort ?? "", live?.elapsed ?? null, live?.dataAt ?? 0);
  if (!live) return { state: "finished", text: "Beendet", progress: null };
  const { status } = live;
  if (status === "FT") return { state: "finished", text: "Beendet", progress: null };
  if (status === "AET") return { state: "finished", text: live.statusText || "n. V.", progress: null };
  if (status === "PEN") return { state: "finished", text: sport === "Fußball" ? "i. E." : live.statusText, progress: null };
  if (status === "HT") return { state: "pause", text: "Halbzeit", progress: 0.5 };
  if (status === "BREAK") return { state: "pause", text: live.statusText || "Pause", progress: null };
  if (clock && clock.text !== "Halbzeit") {
    const text = clock.text.endsWith("'") ? `${clock.text.slice(0, -1)}. Minute` : clock.text;
    return { state: "live", text, progress: clock.progress };
  }
  const minute = live.statusText.match(/^(\d+(?:\+\d+)?)'(.*)$/);
  return {
    state: "live",
    text: minute ? `${minute[1]}. Minute${minute[2]}` : live.statusText || "Live",
    progress: sport === "Fußball" && live.elapsed !== null ? Math.min(1, live.elapsed / 90) : null,
  };
}

// Kleiner Punkt: rot pulsierend (läuft), gelb ruhig (Pause).
export function StateDot({ state }: { state: BoardState }) {
  if (state === "finished") return null;
  return (
    <span
      aria-hidden
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${state === "live" ? "bg-red-500 animate-live-dot" : "bg-yellow-400"}`}
    />
  );
}

// Pill oben rechts: "● LIVE", "● Halbzeit" (gelb, ohne Puls), grau "Beendet".
export function LivePill({ state, pauseText = "Halbzeit" }: { state: BoardState; pauseText?: string }) {
  if (state === "finished") {
    return <span className="rounded-full border border-edge bg-pitch px-2 py-0.5 font-semibold text-muted">Beendet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-pitch px-2 py-0.5 font-semibold text-ink">
      <StateDot state={state} />
      {state === "live" ? "LIVE" : pauseText}
    </span>
  );
}

// Dünner Fortschrittsbalken (3 px), Minute/90, Halbzeit 50 %.
export function ProgressBar({ progress, className = "" }: { progress: number; className?: string }) {
  return (
    <span aria-hidden className={`block h-[3px] overflow-hidden bg-edge/40 ${className}`}>
      <span
        className="block h-full rounded-full bg-red-500/80 transition-[width] duration-700"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
      />
    </span>
  );
}

export interface BoardSide {
  name: string;
  badge?: ReactNode;
}

// Ereignisse für den Spielverlauf (ohne Wechsel), z. B. für "Spielverlauf (3)".
export function timelineCount(events: LiveEvent[] | null | undefined): number {
  return events ? events.filter((e) => e.type !== "subst").length : 0;
}

// Letztes Tor (nach Minute), null ohne Tor.
function lastGoal(events: LiveEvent[] | null | undefined): LiveEvent | null {
  let last: LiveEvent | null = null;
  for (const e of events ?? []) {
    if (!isGoalEvent(e)) continue;
    if (!last || e.minute > last.minute || (e.minute === last.minute && (e.extra ?? 0) >= (last.extra ?? 0))) last = e;
  }
  return last;
}

// Anzeigetafel: links Verein, Mitte großer Spielstand mit Minute, rechts der
// zweite Verein (Reihenfolge wie orderFor, US-Ligen Gast links). Namen
// brechen auf 2 Zeilen um, nie abgeschnitten; die Höhe für 2 Zeilen ist
// immer reserviert. flash: Spielstand leuchtet nach einem Tor kurz golden.
// (Rene, 15.10.2026) Nur EIN Tor (das letzte), z. B. "⚽ Tolisso 45+2'",
// direkt unter dem Namen des Teams, das getroffen hat (nicht mittig); die
// andere Spalte bleibt dort leer, Höhe in beiden reserviert (nichts springt).
// Neues Tor: Zeile kurz golden. Alle Tore/Vorlagen/Karten stehen nur im
// Spielverlauf.
export function Scoreboard({
  left,
  right,
  leftScore,
  rightScore,
  clock,
  events,
  flash = false,
  stage = false,
  leftSide = "home",
}: {
  left: BoardSide;
  right: BoardSide;
  leftScore: number;
  rightScore: number;
  clock: BoardClock;
  events?: LiveEvent[] | null;
  flash?: boolean;
  stage?: boolean;
  leftSide?: "home" | "away";
}) {
  const goal = lastGoal(events);
  const goalKey = goal ? `${goal.side}-${goal.minute}-${goal.extra ?? 0}-${goal.player ?? ""}` : null;
  // Neues letztes Tor (nicht beim ersten Laden): Zeile ~2,5 s golden.
  const [goalGlow, setGoalGlow] = useState(false);
  const seenGoalRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = seenGoalRef.current;
    seenGoalRef.current = goalKey;
    if (prev === undefined || !goalKey || prev === goalKey) return;
    setGoalGlow(true);
    const t = window.setTimeout(() => setGoalGlow(false), 2500);
    return () => window.clearTimeout(t);
  }, [goalKey]);
  const glow = !!goal && (goalGlow || flash);
  // Spalte des Teams, für das das letzte Tor zählt (side, bei Eigentor das
  // begünstigte Team), gespiegelt nach leftSide (Rene, 15.10.2026).
  const goalColumn: "left" | "right" | null = goal ? (goal.side === leftSide ? "left" : "right") : null;
  const goalLine = (show: boolean) => (
    <span className="flex h-6 w-full min-w-0 items-center justify-center">
      {show && goal && (
        <span
          className={`flex min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 text-[13px] leading-6 transition-colors duration-700 ${
            glow ? "bg-gold/15 text-gold" : "bg-transparent text-ink"
          }`}
        >
          <span aria-label="Letztes Tor" className="shrink-0">
            ⚽
          </span>
          <span className="min-w-0 truncate">
            {shortPlayerName(goal.player) || "Tor"}
            {goal.type === "owngoal" ? " (ET)" : goal.type === "penalty" ? " (E)" : ""}
          </span>
          <span className={`shrink-0 tabular-nums ${glow ? "text-gold/80" : "text-muted"}`}>{eventMinuteText(goal)}</span>
        </span>
      )}
    </span>
  );
  const side = (s: BoardSide, column: "left" | "right") => (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      {s.badge && <span className={stage ? "drop-shadow-[0_4px_8px_rgb(0_0_0/0.5)]" : ""}>{s.badge}</span>}
      <span
        className={`min-h-[2.5em] w-full break-words font-display font-semibold leading-tight text-ink [hyphens:auto] ${
          stage ? "text-[15px] sm:text-base" : "text-sm"
        }`}
        lang="de"
      >
        {s.name}
      </span>
      {/* Höhe in beiden Spalten reserviert, die Tafel springt nicht. */}
      {goalLine(goalColumn === column)}
    </div>
  );
  return (
    <div className="overflow-hidden rounded-lg border border-edge bg-pitch/60">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 px-2 py-3">
        {side(left, "left")}
        <div className={`flex flex-col items-center ${stage ? "pt-1.5" : "pt-1"}`}>
          <span
            className={`whitespace-nowrap rounded-md px-1.5 font-display font-bold leading-none tabular-nums transition-colors duration-700 ${
              stage ? "text-[36px]" : "text-[32px]"
            } ${flash ? "bg-gold/15 text-gold" : "bg-transparent text-white"}`}
          >
            {leftScore}:{rightScore}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-muted">
            <StateDot state={clock.state} />
            {clock.text}
          </span>
        </div>
        {side(right, "right")}
      </div>
      {clock.state !== "finished" && clock.progress !== null && <ProgressBar progress={clock.progress} />}
    </div>
  );
}

const TIER_WORD: Record<TipResultTier, string> = {
  exakt: "exakt richtig",
  differenz: "Tordifferenz richtig",
  tendenz: "richtig",
  falsch: "daneben",
};

export function tierWord(tier: TipResultTier, isOneXTwo: boolean): string {
  if (isOneXTwo) return tier === "falsch" ? "daneben" : "richtig";
  return TIER_WORD[tier];
}

export function signedPoints(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0";
}

// "wenn es so bleibt: ▲ Platz 2 in der Rangliste" – Pfeil grün bei
// Verbesserung, rot bei Verschlechterung, sonst ohne Pfeil.
export function ForecastText({ forecast, prefix = "wenn es so bleibt: " }: { forecast: LiveForecast; prefix?: string }) {
  const better = forecast.rankThen < forecast.rankNow;
  const worse = forecast.rankThen > forecast.rankNow;
  return (
    <>
      {prefix}
      {better && <span className="text-[#4FC181]">▲ </span>}
      {worse && <span className="text-red-400">▼ </span>}
      Platz {forecast.rankThen} in der Rangliste
    </>
  );
}

export function forecastPlain(forecast: LiveForecast): string {
  const arrow = forecast.rankThen < forecast.rankNow ? "▲ " : forecast.rankThen > forecast.rankNow ? "▼ " : "";
  return `${arrow}Platz ${forecast.rankThen}`;
}

// EINE Zeile "Dein Tipp: Milan · richtig" mit rechts "+5 vorläufig" (nach
// Abpfiff ohne offiziellen Endstand: "Wertung folgt"), darunter klein der
// vorläufige Platz. Gold nur, wenn der Tipp gerade Punkte bringt. Nur feste
// Punkte (ohne Bonus und Joker), mit Anfänger-Schutz ein Minus als 0.
export function LiveTipLine({
  tipText,
  tier,
  points,
  isOneXTwo,
  finished,
  forecast,
}: {
  tipText: string;
  tier: TipResultTier;
  points: number;
  isOneXTwo: boolean;
  finished: boolean;
  forecast: LiveForecast | null;
}) {
  const good = points > 0;
  return (
    <div className="mt-2.5">
      <div
        className={`flex min-h-[40px] items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${
          good ? "border-gold/70 bg-gold/10" : "border-edge bg-pitch"
        }`}
      >
        <span className="min-w-0 text-muted">
          Dein Tipp: <span className={`font-semibold ${good ? "text-gold" : "text-ink"}`}>{tipText}</span>
          <span className="whitespace-nowrap"> · {tierWord(tier, isOneXTwo)}</span>
        </span>
        <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
          {finished ? (
            <span className="text-xs text-muted">Wertung folgt</span>
          ) : (
            <>
              <span className={`font-display text-sm font-bold ${good ? "text-gold" : "text-ink"}`}>
                {signedPoints(points)}
              </span>
              <span className="text-[10px] text-muted/80">vorläufig</span>
            </>
          )}
        </span>
      </div>
      {forecast && !finished && (
        <p className="mt-1 px-1 text-[11px] text-muted">
          <ForecastText forecast={forecast} />
        </p>
      )}
    </div>
  );
}

// Spielverlauf: neueste Ereignisse zuerst. Heim links-, Gast rechtsbündig
// (leftSide = Team, das links steht; US-Ligen gespiegelt). Wechsel nicht.
export function EventTimeline({ events, leftSide }: { events: LiveEvent[]; leftSide: "home" | "away" }) {
  const shown = events
    .filter((e) => e.type !== "subst")
    .slice()
    .sort((a, b) => b.minute - a.minute || (b.extra ?? 0) - (a.extra ?? 0));
  if (shown.length === 0) return <p className="py-1 text-xs text-muted">Noch keine Tore oder Karten.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {shown.map((e, i) => {
        const isLeft = e.side === leftSide;
        const name = shortPlayerName(e.player) || (e.type === "yellow" || e.type === "red" ? "Karte" : "Tor");
        const mark =
          e.type === "owngoal" ? " (ET)" : e.type === "penalty" ? " (E)" : e.type === "missed_penalty" ? " (E verschossen)" : "";
        return (
          <li
            key={`${e.minute}-${e.extra ?? 0}-${e.type}-${i}`}
            className={`flex items-start gap-2 text-[13px] ${isLeft ? "flex-row text-left" : "flex-row-reverse text-right"}`}
          >
            <span className="w-10 shrink-0 tabular-nums text-muted" style={{ textAlign: isLeft ? "left" : "right" }}>
              {eventMinuteText(e)}
            </span>
            <span className="flex h-5 w-4 shrink-0 items-center justify-center">
              <EventIcon type={e.type} />
            </span>
            <span className="min-w-0">
              <span className={e.type === "missed_penalty" ? "text-muted" : "text-ink"}>
                {name}
                {mark}
              </span>
              {e.assist && (e.type === "goal" || e.type === "penalty") && (
                <span className="block text-[11px] leading-tight text-muted">Vorlage {shortPlayerName(e.assist)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function EventIcon({ type }: { type: LiveEvent["type"] }) {
  if (type === "yellow") return <span aria-label="Gelbe Karte" className="block h-3.5 w-2.5 rounded-[2px] bg-yellow-400" />;
  if (type === "red") return <span aria-label="Rote Karte" className="block h-3.5 w-2.5 rounded-[2px] bg-red-500" />;
  return (
    <span aria-label={type === "missed_penalty" ? "Elfmeter verschossen" : "Tor"} className={type === "missed_penalty" ? "opacity-40" : ""}>
      ⚽
    </span>
  );
}
