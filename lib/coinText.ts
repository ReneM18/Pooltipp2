// Die Währung heißt jetzt "Coins" (PoolTipp Coin). Texte, die die Datenbank
// selbst schreibt (Feed-Meldungen, Auswertungs-Sätze), sagen teils noch
// "Sterne" – auch alte, schon gespeicherte. Statt jede SQL-Funktion neu
// einzuspielen, werden sie hier beim Anzeigen umbenannt.
export function coinText(text: string): string {
  return text
    .replace(/Sterne-/g, "Coin-")
    .replace(/Sternen\b/g, "Coins")
    .replace(/Sterne\b/g, "Coins");
}
