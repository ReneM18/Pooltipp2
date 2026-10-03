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
