import type { Sport } from "./types";
import { flagEmoji } from "./flags";

// Flagge neben dem Wettbewerb auf der Spielkarte: gehört zur LIGA, nie zu
// einer Mannschaft (Rene, 09.10.2026: die NHL ist eine US-Liga, auch wenn
// Winnipeg aus Kanada spielt). Internationale Wettbewerbe (Champions League,
// WM, Länderspiel …) und unbekannte Ligen bekommen keine Flagge.

// US-Ligen: NFL, NBA, NHL – immer USA.
const US_SPORTS: Sport[] = ["NFL", "NBA", "NHL"];

// Fußball-Ligen und -Pokale nach Name (klein geschrieben, Teil des Namens
// reicht). Reihenfolge wichtig: Spezielleres zuerst ("österreichische
// bundesliga" vor "bundesliga").
const LEAGUE_COUNTRY: [string, string][] = [
  ["österreich", "AT"],
  ["admiral bundesliga", "AT"],
  ["öfb", "AT"],
  ["2. liga", "AT"],
  ["dfb", "DE"],
  ["bundesliga", "DE"],
  ["premier league", "GB-ENG"],
  ["championship", "GB-ENG"],
  ["fa cup", "GB-ENG"],
  ["efl", "GB-ENG"],
  ["scottish", "GB-SCT"],
  ["la liga", "ES"],
  ["laliga", "ES"],
  ["copa del rey", "ES"],
  ["serie a", "IT"],
  ["serie b", "IT"],
  ["coppa italia", "IT"],
  ["ligue 1", "FR"],
  ["ligue 2", "FR"],
  ["coupe de france", "FR"],
  ["eredivisie", "NL"],
  ["primeira liga", "PT"],
  ["liga portugal", "PT"],
  ["süper lig", "TR"],
  ["super lig", "TR"],
  ["super league", "CH"],
  ["mls", "US"],
];

export function competitionFlag(sport: Sport, competition: string): string | null {
  if (US_SPORTS.includes(sport)) return flagEmoji("US");
  const name = (competition ?? "").toLowerCase();
  // International: keine Flagge
  if (/uefa|fifa|champions|europa|conference|nations|welt|wm|em-|em |europameister|länderspiel|qualifikation|club world/.test(name)) {
    return null;
  }
  const hit = LEAGUE_COUNTRY.find(([key]) => name.includes(key));
  return hit ? flagEmoji(hit[1]) : null;
}

// Name des Wettbewerbs auf der Spielkarte: Steht die Landesflagge schon davor,
// fällt das Land im Namen weg ("Österreichische Bundesliga" -> "Bundesliga"
// mit 🇦🇹, Rene 10.10.2026). Gespeichert bleibt der volle Name – sonst hielte
// competitionFlag "Bundesliga" für die deutsche Liga.
export function competitionDisplayName(sport: Sport, competition: string): string {
  const name = competition ?? "";
  if (!competitionFlag(sport, name)) return name;
  const short = name.replace(/^(österreichische|österreich)\s+/i, "");
  return short || name;
}
