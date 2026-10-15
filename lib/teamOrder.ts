import type { Competition } from "./competitions";
import { normalizeTeamName } from "./teamName";

// US-Ligen (NFL, NBA, NHL) schreiben Spiele als "Gast @ Heim": das
// Heimteam steht rechts. Nur die Anzeige tauscht die Seiten – gespeichert
// werden Teams, Tipps und Endstand weiter als Heim/Gast.
const US_SPORTS = ["NFL", "NBA", "NHL"];

// Gast zuerst nur, wenn US-Sportart UND der Wettbewerb eine US-Liga ist:
// Land "US" oder kein Land gesetzt (so bleiben alle bestehenden
// NFL/NBA/NHL-Wettbewerbe wie bisher). Ein Wettbewerb mit anderem Land,
// z. B. die österreichische Eishockey-Liga in der Sportart "NHL", zeigt
// wieder Heim zuerst. (Rene, 15.10.2026)
export function isAwayFirst(sport: string, competition?: { countryCode?: string | null } | null): boolean {
  if (!US_SPORTS.includes(sport)) return false;
  const country = (competition?.countryCode ?? "").trim().toUpperCase();
  return !country || country === "US";
}

// Anzeige-Reihenfolge eines Spiels: Sportart (für Unentschieden) und ob der
// Gast links steht. Alle Anzeige-Hilfen unten nehmen diesen Wert, damit
// Karte, Ergebnis-Eingabe, Endstand, 1/2-Knöpfe, Admin und Feed überall
// gleich sortieren. (Rene, 15.10.2026)
export interface TeamOrder {
  sport: string;
  awayFirst: boolean;
}

// Wettbewerb eines Spiels finden: Das Spiel speichert nur den Namen als
// Text, gesucht wird in der gleichen Sportart (Schreibweise egal).
export function findMatchCompetition(
  match: { sport: string; competition?: string | null },
  competitions: Competition[]
): Competition | undefined {
  const key = normalizeTeamName(match.competition ?? "");
  if (!key) return undefined;
  return competitions.find((c) => c.sport === match.sport && normalizeTeamName(c.name) === key);
}

// Reihenfolge für ein Spiel bzw. für Sportart + Wettbewerbsname (z. B. beim
// Anlegen im Admin, wenn es das Spiel noch nicht gibt). (Rene, 15.10.2026)
export function matchOrder(
  match: { sport: string; competition?: string | null },
  competitions: Competition[]
): TeamOrder {
  return { sport: match.sport, awayFirst: isAwayFirst(match.sport, findMatchCompetition(match, competitions)) };
}

// Zwei Werte (Heim, Gast) in Anzeige-Reihenfolge (links, rechts).
export function displayOrder<T>(order: TeamOrder, home: T, away: T): [T, T] {
  return order.awayFirst ? [away, home] : [home, away];
}

// Spieltitel in einer Zeile: "Bayern vs Dortmund" bzw. in US-Ligen
// "Bills vs Chiefs" (Gast zuerst).
export function matchTitle(order: TeamOrder, homeName: string, awayName: string): string {
  return displayOrder(order, homeName, awayName).join(" vs ");
}

// Ergebnis in Anzeige-Reihenfolge, z. B. "24:17".
export function scoreText(order: TeamOrder, home: number | null, away: number | null, sep = ":"): string {
  return displayOrder(order, home ?? 0, away ?? 0).join(sep);
}

// 1X2 nach Position: links = 1, rechts = 2. Normal ist das wie gewohnt
// 1 = Heim; in US-Ligen (Gast links) ist 1 der Gast. Nur Anzeige – der Tipp
// bleibt als Heim/Gast gespeichert.
export function pickNumber(order: TeamOrder, side: "home" | "away"): "1" | "2" {
  const homeIsLeft = !order.awayFirst;
  return (side === "home") === homeIsLeft ? "1" : "2";
}

// Basketball (NBA) und Eishockey (NHL) kennen kein Unentschieden
// (Verlängerung bzw. Penaltyschießen bis zur Entscheidung). Dort gibt es
// keinen X-Knopf, und statt "1"/"2" steht "Sieg" unter dem jeweiligen Team.
export function allowsDraw(sport: string): boolean {
  return sport !== "NBA" && sport !== "NHL";
}

// "1 (Bayern München)", "X (Unentschieden)", "2 (Borussia Dortmund)";
// ohne Unentschieden "Sieg Boston Bruins".
export function oneXTwoText(order: TeamOrder, home: number, away: number, homeName: string, awayName: string): string {
  if (!allowsDraw(order.sport) && home !== away) return `Sieg ${home > away ? homeName : awayName}`;
  if (home > away) return `${pickNumber(order, "home")} (${homeName})`;
  if (away > home) return `${pickNumber(order, "away")} (${awayName})`;
  return "X (Unentschieden)";
}
