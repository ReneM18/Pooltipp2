// Simuliertes "Live-Ticker-Gefühl" für Spiele im Live-Status: statt nur
// eines statischen "LIVE"-Badges mit Spielstand zeigt die App ein paar
// Ereignis-Zeilen (Tor/Karte), die zum aktuellen Stand passen. Es gibt
// (noch) keinen echten Event-Feed – die Minuten werden deterministisch aus
// der Match-ID berechnet (gleiches mulberry32-Muster wie simulateOpponents
// in lib/poolScore.ts), damit dieselbe Kombination aus Spiel + Spielstand
// immer dieselben Ereignisse liefert statt bei jedem Re-Render zu wechseln.

export type TickerEventType = "tor" | "gelb" | "rot";

export interface TickerEvent {
  minute: number;
  type: TickerEventType;
  team: "home" | "away";
}

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

/**
 * Genau `homeScore` Tor-Events für Heim und `awayScore` für Auswärts, an
 * deterministischen Minuten (1–90) verteilt, plus 0–2 Karten-Events ohne
 * Einfluss auf den Spielstand. Liste ist neueste-zuerst sortiert, wie bei
 * einem echten Live-Ticker.
 */
export function generateTickerEvents(
  matchId: string,
  homeScore: number,
  awayScore: number
): TickerEvent[] {
  const rng = mulberry32(hashString(`ticker:${matchId}`));
  const events: TickerEvent[] = [];
  const usedMinutes = new Set<number>();

  function pickMinute(): number {
    let minute = 1 + Math.floor(rng() * 90);
    let guard = 0;
    while (usedMinutes.has(minute) && guard < 200) {
      minute = 1 + Math.floor(rng() * 90);
      guard++;
    }
    usedMinutes.add(minute);
    return minute;
  }

  for (let i = 0; i < homeScore; i++) events.push({ minute: pickMinute(), type: "tor", team: "home" });
  for (let i = 0; i < awayScore; i++) events.push({ minute: pickMinute(), type: "tor", team: "away" });

  const cardCount = Math.floor(rng() * 3); // 0–2 Karten
  for (let i = 0; i < cardCount; i++) {
    events.push({
      minute: pickMinute(),
      type: rng() < 0.85 ? "gelb" : "rot",
      team: rng() < 0.5 ? "home" : "away",
    });
  }

  return events.sort((a, b) => b.minute - a.minute);
}
