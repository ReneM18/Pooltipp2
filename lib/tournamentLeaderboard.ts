// Turnier-Mini-Rangliste: begrenzt auf genau die Spiele, die einem Turnier
// zugeordnet sind. Da es kein echtes Backend gibt, werden die Werte der
// anderen Mitspieler deterministisch pro Turnier simuliert (gleiches
// mulberry32-Muster wie simulateOpponents in lib/poolScore.ts bzw.
// lib/weeklyLeaderboard.ts) – bei echten Konten stünden hier reale Werte.
import { mockLeaderboard } from "./mockLeaderboard";
import { Tournament, TournamentStatus } from "./tournamentTypes";

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTournamentStatus(tournament: Tournament, now: Date = new Date()): TournamentStatus {
  const t = now.getTime();
  const start = new Date(tournament.startDate).getTime();
  const end = new Date(tournament.endDate).getTime();
  if (t < start) return "kommend";
  if (t >= end) return "beendet";
  return "aktiv";
}

export interface TournamentEntry {
  name: string;
  points: number;
}

/** Deterministisch simulierte Turnierpunkte für die bekannten Mock-Mitspieler, skaliert mit der Spielanzahl. */
export function getSimulatedTournamentEntries(tournament: Tournament): TournamentEntry[] {
  const matchCount = Math.max(1, tournament.matchIds.length);
  return mockLeaderboard
    .filter((e) => !e.isCurrentUser)
    .map((entry) => {
      const rng = mulberry32(hashString(`tournament:${tournament.id}:${entry.name}`));
      const points = Math.round(matchCount * (10 + rng() * 25)); // ~10–35 Punkte je Spiel im Turnier
      return { name: entry.name, points };
    });
}

/** Summe der Rangliste-Punkte-Änderung aus allen eigenen, ausgewerteten Tipps zu Spielen dieses Turniers. */
export function sumTournamentRangDelta(
  tips: { evaluated?: boolean; rangDelta?: number; matchId: string }[],
  matchIds: string[]
): number {
  const idSet = new Set(matchIds);
  return tips
    .filter((t) => t.evaluated && t.rangDelta !== undefined && idSet.has(t.matchId))
    .reduce((sum, t) => sum + (t.rangDelta ?? 0), 0);
}
