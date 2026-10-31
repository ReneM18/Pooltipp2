import type { Sport } from "./types";
import { normalizeTeamName } from "./teamName";
import { isTeamAlias } from "./live/aliases";

// Live-Spielstände (Rene, 15.10.2026). Gemeinsame Hilfen für die
// Server-Route (app/api/live/route.ts), den Anbieter und die Karten
// (lib/useLiveScores.ts). Reine Anzeige: an Wertung und Datenbank ändert
// sich nichts, der offizielle Endstand kommt weiter vom Admin.

// Typen anbieterneutral in lib/live/types.ts (Rene, 16.10.2026: Anbieter
// austauschbar), hier weitergereicht, damit bestehende Imports bleiben.
import type { LiveEvent, LiveGame, LiveSource, LiveStatus, ShootoutKick } from "./live/types";
export type {
  LiveDiagnostics,
  LiveEvent,
  LiveEventType,
  LiveGame,
  LiveQuota,
  LiveResponse,
  LiveSnapshot,
  LiveSource,
  LiveStatus,
} from "./live/types";

// Tor im Sinne des Spielstands (verschossener Elfmeter zählt nicht).
export function isGoalEvent(e: LiveEvent): boolean {
  return e.type === "goal" || e.type === "owngoal" || e.type === "penalty";
}

// "45+2'" bzw. "17'"
export function eventMinuteText(e: LiveEvent): string {
  return e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
}

// Nachname bzw. kurzer Anzeigename: "M. Cissé" → "Cissé".
export function shortPlayerName(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1 && /^[A-ZÄÖÜ]\.$/.test(parts[0])) return parts.slice(1).join(" ");
  return name.trim();
}

// Torschützen eines Teams für die Anzeigetafel: "Cissé 15', 32' · Kane 40' (E)".
export function scorerLine(events: LiveEvent[] | undefined, side: "home" | "away"): string {
  if (!events) return "";
  const byPlayer = new Map<string, string[]>();
  for (const e of events) {
    if (!isGoalEvent(e) || e.side !== side) continue;
    const name = shortPlayerName(e.player) || "Tor";
    const mark = e.type === "owngoal" ? " (ET)" : e.type === "penalty" ? " (E)" : "";
    const list = byPlayer.get(name) ?? [];
    list.push(`${eventMinuteText(e)}${mark}`);
    byPlayer.set(name, list);
  }
  return Array.from(byPlayer, ([name, minutes]) => `${name} ${minutes.join(", ")}`).join(" · ");
}

// Abfrage-Takt in Sekunden: Fußball 60 s, sonst 300 s. So oft fragt der
// Browser nach (und so lange teilt das CDN eine Antwort). Wie oft der Server
// wirklich bei API-Sports nachfragt, entscheidet er selbst nach dem
// Tageskontingent (Rene, 27.10.2026: Pro-Plan mit 7.500 Abfragen → 60 s,
// Gratis-Plan mit 100 → weiter 180 s, siehe liveMaxIntervalSeconds).
export function liveIntervalSeconds(sport: Sport): number {
  return sport === "Fußball" ? 60 : 300;
}

// Längster Takt des Servers (Gratis-Plan: 100 Abfragen pro Tag und
// Sport-API → Fußball 180 s). Danach richten sich "verzögert" und die
// mitlaufende Minute, damit der Gratis-Plan nicht als Störung gilt.
export function liveMaxIntervalSeconds(sport: Sport): number {
  return sport === "Fußball" ? 180 : 300;
}

// Live-Daten verzögert? (Rene, 16.10.2026: ehrliche Aktualität) Ja, wenn
// Spiele laufen und die Daten älter als 2× (längster) Takt sind oder nicht aus dem
// Live-Abruf stammen (source "day"/"stale"). Ohne laufendes Spiel nie.
export function isLiveDelayed(
  sport: Sport,
  dataAt: number,
  source: LiveSource | null,
  running: boolean,
  now: number,
): boolean {
  if (!running || !dataAt) return false;
  if (source !== null && source !== "live") return true;
  return now - dataAt > 2 * liveMaxIntervalSeconds(sport) * 1000;
}

export function isLiveFinished(status: LiveStatus): boolean {
  return status === "FT" || status === "AET" || status === "PEN";
}

export function isLiveRunning(status: LiveStatus): boolean {
  return status === "LIVE" || status === "HT" || status === "BREAK";
}

// Hängengebliebene Live-Spiele (Rene, 31.10.2026: NHL Devils – Vegas stand
// morgens noch auf "3. Drittel 20'"): API-Sports stellt besonders bei
// Eishockey den Status manchmal stundenlang nicht auf "Beendet". Läuft ein
// Spiel laut Anbieter 4 Stunden nach Anpfiff noch, gilt es als beendet –
// so lange dauert kein Spiel (wie das Spielfenster des Servers und das
// Nachfragen im Browser). Der offizielle Endstand kommt weiter vom Admin.
export const LIVE_STUCK_AFTER_MS = 4 * 60 * 60 * 1000;

export function settleStuckGame(game: LiveGame, now: number): LiveGame {
  if (!isLiveRunning(game.status)) return game;
  if (now - new Date(game.kickoff).getTime() <= LIVE_STUCK_AFTER_MS) return game;
  return { ...game, status: "FT", statusShort: "FT", statusText: "Beendet", elapsed: null, progress: undefined };
}

// Kalendertag des Anpfiffs in Wien (YYYY-MM-DD), so fragt die Route ab.
export function viennaDate(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

// ---------------------------------------------------------------------------
// Teamnamen-Zuordnung

// Vorsilben/Zusätze, die bei der Zuordnung nicht zählen ("AC Milan" =
// "Milan", "1899 Hoffenheim" = "Hoffenheim", "Red Bull Salzburg" =
// "RB Salzburg" = "Salzburg").
const IGNORED_TOKENS = new Set([
  "fc", "ac", "afc", "as", "sc", "sv", "cf", "cd", "ud", "rc", "rcd", "ssc", "ss", "us",
  "fk", "sk", "nk", "bk", "if", "ik", "ks", "tsg", "vfb", "vfl", "bsc", "bv", "spvgg",
  "rb", "red", "bull", "the", "club",
]);

// Wörter eines Namens, vergleichbar gemacht (normalizeTeamName je Wort) und
// ohne Vorsilben und Gründungsjahre. Umlaute zählen gleich, ob als "ö",
// "oe" oder "o" geschrieben ("Mönchengladbach" = "Monchengladbach").
function nameTokens(name: string): string[] {
  const words = name
    .replace(/red\s*bull/gi, " ")
    .split(/[\s\-–./&']+/)
    .map((w) => normalizeTeamName(w).replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u"))
    .filter(Boolean);
  const kept = words.filter((w) => !IGNORED_TOKENS.has(w) && !/^(18|19|20)\d\d$/.test(w));
  // Bestand der Name nur aus "Zusätzen" (z. B. "Real"), lieber alle behalten.
  return kept.length > 0 ? kept : words;
}

// 0 = passt nicht, 3 = gleich, 2 = alle Wörter des kürzeren Namens stecken im
// längeren, 1 = ein Name enthält den anderen ("Gladbach" in "Monchengladbach"),
// 0.5 = ein längeres Wort gemeinsam ("Bayern München" = "Bayern Munich").
export function teamNameScore(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  const ja = ta.join("");
  const jb = tb.join("");
  if (!ja || !jb) return 0;
  if (ja === jb) return 3;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (short.every((w) => long.includes(w))) return 2;
  const [js, jl] = ja.length <= jb.length ? [ja, jb] : [jb, ja];
  if (js.length >= 4 && jl.includes(js)) return 1;
  if (ta.some((w) => w.length >= 5 && tb.includes(w))) return 0.5;
  return 0;
}

// Zuordnung eines Teamnamens (Rene, 16.10.2026): zuerst die Alias-Liste
// (lib/live/aliases.ts, z. B. "KAC" = "Klagenfurt"), dann die tolerante
// Namenslogik. Alias zählt mehr als jeder tolerante Treffer.
export function teamMatchScore(appName: string, apiName: string): number {
  if (isTeamAlias(appName, apiName)) return 4;
  return teamNameScore(appName, apiName);
}

export interface LiveMatchResult {
  game: LiveGame;
  // Spielstand schon als App-Heim/-Gast (falls die API die Seiten vertauscht).
  homeScore: number | null;
  awayScore: number | null;
  // Heim/Gast bei der API andersrum (Rene, 15.10.2026: Spieltag-Umbau, für
  // die Seiten der Ereignisse).
  swapped: boolean;
}

// Ereignisse eines zugeordneten Spiels mit Heim/Gast wie in der App.
export function appSideEvents(result: LiveMatchResult): LiveEvent[] {
  const events = result.game.events ?? [];
  if (!result.swapped) return events;
  return events.map((e) => ({ ...e, side: e.side === "home" ? "away" : "home" }));
}

// Schützen im Elfmeterschießen mit Heim/Gast wie in der App.
export function appSideShootout(result: LiveMatchResult): ShootoutKick[] {
  const kicks = result.game.shootout ?? [];
  if (!result.swapped) return kicks;
  return kicks.map((k) => ({ ...k, side: k.side === "home" ? "away" : "home" }));
}

// Elfmeterschießen mit Heim/Gast wie in der App (nur wenn es eines gab).
export function appSidePenalties(result: LiveMatchResult): { penaltyHome?: number; penaltyAway?: number } {
  const { penaltyHome, penaltyAway } = result.game;
  if (penaltyHome === undefined || penaltyAway === undefined) return {};
  return result.swapped ? { penaltyHome: penaltyAway, penaltyAway: penaltyHome } : { penaltyHome, penaltyAway };
}

// Passendes API-Spiel zu einem App-Spiel: Anpfiff innerhalb ±20 Minuten und
// beide Teamnamen passen. Keine eindeutige Zuordnung = null (lieber nichts
// zeigen als einen falschen Spielstand).
export function findLiveGame(
  games: LiveGame[],
  kickoff: string,
  homeName: string,
  awayName: string,
): LiveMatchResult | null {
  const target = new Date(kickoff).getTime();
  if (!Number.isFinite(target)) return null;
  let best: { result: LiveMatchResult; score: number } | null = null;
  let tie = false;
  for (const game of games) {
    const diff = Math.abs(new Date(game.kickoff).getTime() - target);
    if (!(diff <= 20 * 60 * 1000)) continue;
    const straightHome = teamMatchScore(homeName, game.home);
    const straightAway = teamMatchScore(awayName, game.away);
    const swappedHome = teamMatchScore(homeName, game.away);
    const swappedAway = teamMatchScore(awayName, game.home);
    let candidate: { result: LiveMatchResult; score: number } | null = null;
    if (straightHome > 0 && straightAway > 0) {
      candidate = {
        result: { game, homeScore: game.homeScore, awayScore: game.awayScore, swapped: false },
        score: straightHome + straightAway + 1,
      };
    } else if (swappedHome > 0 && swappedAway > 0) {
      // Heim/Gast bei der API andersrum: Stand passend zur App drehen.
      candidate = {
        result: { game, homeScore: game.awayScore, awayScore: game.homeScore, swapped: true },
        score: swappedHome + swappedAway,
      };
    }
    if (!candidate) continue;
    if (!best || candidate.score > best.score) {
      best = candidate;
      tie = false;
    } else if (candidate.score === best.score && candidate.result.game.id !== best.result.game.id) {
      tie = true;
    }
  }
  return best && !tie ? best.result : null;
}

// ---------------------------------------------------------------------------
// Mitlaufende Spielminute (Rene, 15.10.2026: Live-Gefühl)
//
// Die API liefert die Minute nur alle 3 Minuten. Aus "elapsed" und dem
// Zeitpunkt des Abrufs beim Anbieter (fetchedAt) rechnen wir die aktuelle
// Minute hoch – nur im Fußball und nur im 1./2. Durchgang. Höchstens bis
// fetchedAt + ein Takt (Rene, 16.10.2026): kommen keine neuen Daten, bleibt
// die Minute lieber stehen als falsch zu raten. Über 45 bzw. 90
// hinaus wird nicht geraten, dann steht "45+" bzw. "90+". In der Halbzeit
// bleibt "Halbzeit" stehen. progress = Anteil an 90 Minuten (Halbzeit 50 %).
export interface LiveClock {
  text: string; // "18'", "45+", "90+", "Halbzeit"
  progress: number; // 0..1
}

export function liveClock(
  sport: Sport,
  statusShort: string,
  elapsed: number | null,
  dataAt: number,
  now: number,
): LiveClock | null {
  if (sport !== "Fußball") return null;
  const s = statusShort.toUpperCase();
  if (s === "HT") return { text: "Halbzeit", progress: 0.5 };
  if ((s !== "1H" && s !== "2H") || elapsed === null || !dataAt) return null;
  const end = s === "1H" ? 45 : 90;
  const start = s === "1H" ? 1 : 46;
  const until = Math.min(now, dataAt + liveMaxIntervalSeconds(sport) * 1000);
  const minute = Math.max(start, elapsed + Math.max(0, Math.floor((until - dataAt) / 60000)));
  if (minute > end) return { text: `${end}+`, progress: end / 90 };
  return { text: `${minute}'`, progress: minute / 90 };
}

// "aktualisiert vor 1 Min." (Rene, 15.10.2026: Live-Gefühl)
export function updatedAgoText(dataAt: number, now: number): string {
  const min = Math.max(0, Math.floor((now - dataAt) / 60000));
  return min === 0 ? "aktualisiert gerade eben" : `aktualisiert vor ${min} Min.`;
}
