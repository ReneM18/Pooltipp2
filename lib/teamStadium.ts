import type { Sport, Team, TeamStadium } from "./types";
import { normalizeTeamName } from "./teamName";

// Stadion je Verein (Rene, 29.10.2026: "das austria lustenau stadion heißt
// jetzt anders bitte bau mir bei jedem verein einen reiter wo ich das stadion
// ändern kann aber füll alles mit den namen von der api aus").
//
// Gespeichert im Team selbst (Feld "stadium" in teams.data, kein SQL). Der
// Admin füllt es unter Teams von der API (GET /api/team-stadium) und kann
// Name und Plätze von Hand ändern; dann gilt manual und die API überschreibt
// es beim nächsten Füllen nicht mehr. Die Tippkarte zeigt den gespeicherten
// Namen (siehe matchStadium).

// Antwort von GET /api/team-stadium.
export interface StadiumLookup {
  found: { name: string; capacity: number | null; venueId: number | null; apiTeam: string } | null;
  error?: string;
}

// Sportarten, bei denen die API ein Stadion liefern kann. Eishockey: die API
// kennt keine Hallen, dort nur von Hand.
export function canLookupStadium(sport: Sport): boolean {
  return sport === "Fußball" || sport === "NFL" || sport === "NBA";
}

// Suchwörter für die Team-Suche der API: nur Buchstaben, Ziffern und
// Leerzeichen, mindestens 3 Zeichen ("Bayern München" → "Bayern Munchen").
// Danach das längste Wort ("Lustenau"), falls der ganze Name nichts findet.
export function stadiumSearchTerms(names: string[]): string[] {
  const clean = (s: string) =>
    s
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const terms: string[] = [];
  const add = (t: string) => {
    if (t.length >= 3 && !terms.some((x) => x.toLowerCase() === t.toLowerCase())) terms.push(t);
  };
  for (const n of names) add(clean(n));
  for (const n of names) {
    const longest = clean(n)
      .split(" ")
      .sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 4) add(longest);
  }
  return terms.slice(0, 4);
}

// Ist das Stadion eines Spiels der API das gespeicherte Stadion des Vereins?
export function isTeamStadium(stadium: TeamStadium, venueName: string | null, venueId: number | null): boolean {
  if (venueId !== null && stadium.apiVenueId === venueId) return true;
  if (!venueName) return false;
  const v = normalizeTeamName(venueName);
  return v === normalizeTeamName(stadium.apiName ?? "") || v === normalizeTeamName(stadium.name);
}

export interface ShownStadium {
  name: string;
  capacity: number | null;
}

// Stadion für die Tippkarte:
//  - Spiel bei der API gefunden und es ist das Stadion eines der beiden
//    Vereine → der gespeicherte Name (z. B. "SUN MINIMEAL Arena").
//  - Heimverein der API hat ein von Hand geändertes Stadion → immer der
//    eigene Name (leer = keins zeigen), auch wenn die API es anders nennt.
//  - Heimverein der API hat ein Stadion, dessen API-Name wir nicht kennen
//    → ebenfalls der gespeicherte Name.
//  - Sonst (z. B. Finale auf neutralem Platz) → das Stadion laut API.
//  - Spiel nicht bei der API (weiter weg, Eishockey) → Stadion des
//    Heimvereins, falls gespeichert.
export function matchStadium(
  apiHome: Team | undefined,
  apiAway: Team | undefined,
  venueName: string | null,
  venueId: number | null,
  apiCapacity: number | null,
): ShownStadium | null {
  const own = (t: Team | undefined) => (t?.stadium && !t.isNationalTeam && t.stadium.name.trim() ? t.stadium : undefined);
  const shown = (s: TeamStadium, fallbackCapacity: number | null): ShownStadium => ({
    name: s.name.trim(),
    capacity: s.capacity ?? fallbackCapacity,
  });
  if (!venueName) {
    const home = own(apiHome);
    return home ? shown(home, null) : null;
  }
  for (const t of [apiHome, apiAway]) {
    const s = own(t);
    if (s && isTeamStadium(s, venueName, venueId)) return shown(s, apiCapacity);
  }
  // Von Hand geändert (Rene, 29.10.2026: Lustenau zeigte trotzdem den alten
  // Namen, weil die Spiele der API das Stadion anders nennen als die
  // Team-Suche): beim Heimspiel gilt immer der eigene Name, leer = ausblenden.
  if (apiHome?.stadium?.manual && !apiHome.isNationalTeam) {
    return apiHome.stadium.name.trim() ? shown(apiHome.stadium, apiCapacity) : null;
  }
  const home = own(apiHome);
  if (home && !home.apiName && home.apiVenueId === undefined) return shown(home, apiCapacity);
  return { name: venueName, capacity: apiCapacity };
}
