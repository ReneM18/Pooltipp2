// Neustart der Rangpunkte (supabase/rankingsystem-neustart.sql): Alle
// Rangpunkte stehen seitdem auf 0. Tipps von davor bleiben gespeichert
// (Tipp-Historie), zählen aber in keiner Statistik mehr mit, damit
// "Abgegebene Tipps", Trefferquote usw. zu den Punkten passen.

export interface RankingResetTip {
  rankingLegacy?: boolean;
  refundedAt?: string;
}

/**
 * true, wenn der Tipp seit dem Neustart zählt. Vor dem Neustart ausgewertete
 * Tipps markiert die Datenbank (ranking_legacy). Vor dem Neustart abgesagte
 * Spiele haben keine Wertung und werden über den Zeitpunkt erkannt. Noch
 * offene Tipps von davor zählen mit: Sie werden nach den neuen Regeln
 * ausgewertet und bringen Punkte.
 */
export function countsSinceReset(tip: RankingResetTip, resetAt: string | null): boolean {
  if (tip.rankingLegacy) return false;
  if (resetAt && tip.refundedAt && new Date(tip.refundedAt).getTime() < new Date(resetAt).getTime()) return false;
  return true;
}

/** "05.10.2026" für Hinweise wie "seit dem Neustart am …". */
export function resetDateText(resetAt: string | null): string | null {
  if (!resetAt) return null;
  return new Date(resetAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
