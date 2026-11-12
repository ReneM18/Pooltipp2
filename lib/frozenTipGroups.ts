// Tipps-Seite: Jede Karte bleibt in der Gruppe ("Noch offen" bzw.
// "✓ Schon getippt"), in der sie beim Öffnen stand – bis die Seite neu
// geladen wird (Browser neu laden, App neu öffnen oder Runterwischen).
//
// Rene, 12.11.2026: "zumindest bis zum nächsten laden – die springen gleich
// irgendwo anders hin und dann kennt sich keiner aus". Vorher hielt die Seite
// eine gerade getippte Karte nur fest, bis man den Reiter wechselte, kurz ins
// Matchcenter ging oder ein Tipp von einem anderen Gerät hereinkam. Danach
// wurde neu sortiert und die Karten standen woanders.
//
// Die Einteilung liegt hier außerhalb der Seite, damit sie auch beim Wechsel
// zu einer anderen Seite und zurück erhalten bleibt. Ein echtes Neuladen
// leert sie von selbst.

export type TipGroup = "offen" | "getippt";

const groups = new Map<string, TipGroup>();
let owner: string | null = null;

/** Neu einsortieren beim nächsten Anzeigen (Runterwischen, anderer Spieler). */
export function resetTipGroups() {
  groups.clear();
}

/**
 * Gruppe einer Karte: beim ersten Mal nach dem echten Stand (`actual`)
 * festgelegt, danach immer dieselbe. Mit `record = false` (Tipps noch nicht
 * geladen) wird nichts festgelegt, sonst landeten alle Karten dauerhaft
 * unter "Noch offen".
 */
export function tipGroupOf(userId: string | null, matchId: string, actual: TipGroup, record: boolean): TipGroup {
  if (owner !== userId) {
    groups.clear();
    owner = userId;
  }
  const fixed = groups.get(matchId);
  if (fixed) return fixed;
  if (record) groups.set(matchId, actual);
  return actual;
}
