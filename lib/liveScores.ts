import type { Sport } from "./types";
import { normalizeTeamName } from "./teamName";

// Live-Spielstände von API-Sports (Rene, 15.10.2026). Gemeinsame Typen und
// Hilfen für die Server-Route (app/api/live/route.ts) und die Karten
// (lib/useLiveScores.ts). Reine Anzeige: an Wertung und Datenbank ändert
// sich nichts, der offizielle Endstand kommt weiter vom Admin.

// Vereinheitlichter Status über alle Sportarten:
// NS = noch nicht begonnen, LIVE = läuft, HT = Halbzeit, BREAK = Pause
// (Drittel-/Viertelpause), FT/AET/PEN = beendet (regulär, nach
// Verlängerung, nach Penalty-/Siebenmeterschießen), OTHER = verschoben,
// abgesagt, abgebrochen usw. (wird auf den Karten nicht gezeigt).
export type LiveStatus = "NS" | "LIVE" | "HT" | "BREAK" | "FT" | "AET" | "PEN" | "OTHER";

export interface LiveGame {
  id: string;
  kickoff: string; // ISO 8601
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: LiveStatus;
  statusShort: string; // Original-Kürzel der API, z. B. "2H", "P2", "Q3"
  statusText: string; // deutsch für die Karte, z. B. "67'", "Halbzeit", "2. Drittel"
  elapsed: number | null; // Spielminute (Fußball) bzw. Uhr im Abschnitt
  league: string;
}

export interface LiveResponse {
  sport: Sport;
  date: string;
  games: LiveGame[];
  error?: string;
}

// Server-Cache und Abfrage-Takt in Sekunden: Fußball 180 s, sonst 300 s
// (Gratis-Plan: 100 Abfragen pro Tag und Sport-API).
export function liveIntervalSeconds(sport: Sport): number {
  return sport === "Fußball" ? 180 : 300;
}

export function isLiveFinished(status: LiveStatus): boolean {
  return status === "FT" || status === "AET" || status === "PEN";
}

export function isLiveRunning(status: LiveStatus): boolean {
  return status === "LIVE" || status === "HT" || status === "BREAK";
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

export interface LiveMatchResult {
  game: LiveGame;
  // Spielstand schon als App-Heim/-Gast (falls die API die Seiten vertauscht).
  homeScore: number | null;
  awayScore: number | null;
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
    const straightHome = teamNameScore(homeName, game.home);
    const straightAway = teamNameScore(awayName, game.away);
    const swappedHome = teamNameScore(homeName, game.away);
    const swappedAway = teamNameScore(awayName, game.home);
    let candidate: { result: LiveMatchResult; score: number } | null = null;
    if (straightHome > 0 && straightAway > 0) {
      candidate = {
        result: { game, homeScore: game.homeScore, awayScore: game.awayScore },
        score: straightHome + straightAway + 1,
      };
    } else if (swappedHome > 0 && swappedAway > 0) {
      // Heim/Gast bei der API andersrum: Stand passend zur App drehen.
      candidate = {
        result: { game, homeScore: game.awayScore, awayScore: game.homeScore },
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
