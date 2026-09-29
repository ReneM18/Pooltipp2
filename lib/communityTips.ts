// Community-Tipps für den Feed: statt nur eigener Aktivität zeigt der Feed
// auch, wie ein paar bekannte Mitspieler bei den nächsten Spielen tippen
// würden – macht andere User als echte Inhalte sichtbar, nicht nur als
// generische "hat getippt"-Zeile. Da es keine echten fremden Tipps gibt
// (kein Backend), werden diese deterministisch pro Spiel+Name simuliert
// (gleiches mulberry32-Muster wie simulateOpponents in lib/poolScore.ts).

import { Match } from "./types";
import { mockLeaderboardBySport } from "./mockLeaderboard";

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

export interface CommunityTip {
  name: string;
  predictionLabel: string; // z. B. "2:1" oder "Heimsieg (1)"
}

/** Simulierte Tipps von `count` bekannten Mitspielern zu einem bestimmten Spiel. */
export function getCommunityTipsForMatch(match: Match, count = 2): CommunityTip[] {
  const candidates = mockLeaderboardBySport[match.sport].filter((e) => !e.isCurrentUser);
  const picked = candidates.slice(0, count);

  return picked.map((entry) => {
    const rng = mulberry32(hashString(`communitytip:${match.id}:${entry.name}`));
    if (match.tipMode === "1x2") {
      const r = rng();
      const label = r < 0.4 ? "Heimsieg (1)" : r < 0.55 ? "Unentschieden (X)" : "Auswärtssieg (2)";
      return { name: entry.name, predictionLabel: label };
    }
    const home = Math.floor(rng() * 4);
    const away = Math.floor(rng() * 4);
    return { name: entry.name, predictionLabel: `${home}:${away}` };
  });
}
