// US-Sport (NFL, NBA, NHL) schreibt Spiele als "Gast @ Heim": das
// Heimteam steht rechts. Nur die Anzeige tauscht die Seiten – gespeichert
// werden Teams, Tipps und Endstand weiter als Heim/Gast.
export function isAwayFirst(sport: string): boolean {
  return sport === "NFL" || sport === "NBA" || sport === "NHL";
}

// Zwei Werte (Heim, Gast) in Anzeige-Reihenfolge (links, rechts).
export function displayOrder<T>(sport: string, home: T, away: T): [T, T] {
  return isAwayFirst(sport) ? [away, home] : [home, away];
}

// Spieltitel in einer Zeile: "Bayern vs Dortmund" bzw. "Bills @ Chiefs".
export function matchTitle(sport: string, homeName: string, awayName: string): string {
  return isAwayFirst(sport) ? `${awayName} @ ${homeName}` : `${homeName} vs ${awayName}`;
}

// Ergebnis in Anzeige-Reihenfolge, z. B. "24:17".
export function scoreText(sport: string, home: number | null, away: number | null, sep = ":"): string {
  return displayOrder(sport, home ?? 0, away ?? 0).join(sep);
}

// 1X2 nach Position: links = 1, rechts = 2. Bei Fußball ist das wie gewohnt
// 1 = Heim; bei US-Sport (Gast links) ist 1 der Gast. Nur Anzeige – der Tipp
// bleibt als Heim/Gast gespeichert.
export function pickNumber(sport: string, side: "home" | "away"): "1" | "2" {
  const homeIsLeft = !isAwayFirst(sport);
  return (side === "home") === homeIsLeft ? "1" : "2";
}

// "1 (Bayern München)", "X (Unentschieden)", "2 (Borussia Dortmund)".
export function oneXTwoText(sport: string, home: number, away: number, homeName: string, awayName: string): string {
  if (home > away) return `${pickNumber(sport, "home")} (${homeName})`;
  if (away > home) return `${pickNumber(sport, "away")} (${awayName})`;
  return "X (Unentschieden)";
}
