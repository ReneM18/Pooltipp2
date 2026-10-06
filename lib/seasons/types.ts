// Gemeinsame Typen für alle Saisons des Saison-Passes.
//
// Eine Saison ist eine reine DATENLISTE (siehe z. B. lib/seasons/herbst2026.ts):
// Name, Farben, Emotes und pro Level eine Zeile mit Belohnungsart und Wert.
// Wie eine Belohnung funktioniert (Rahmen zeichnen, Emotes im Chat, Titel im
// Profil), steht einmalig im Code – eine neue Saison
// braucht also nur eine neue Datei mit neuen Werten, keinen neuen Code.

export interface SeasonTheme {
  /** Eindeutige, nie wieder geänderte Kennung, z. B. "herbst-2026". Wird in
   *  der Datenbank gespeichert (welche Level man schon erreicht hat). */
  id: string;
  name: string;
  /** Kurzform, z. B. für den Champion-Titel ("Champion 2026"). */
  year: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
}

/**
 * Die festen Belohnungsarten – jede Saison benutzt nur diese.
 *
 * REGEL (Rene, 06.10.2026): Ein Pass gibt NIE Coins, weder gratis noch
 * Premium, und vervielfacht auch keine. Premium soll später Geld kosten;
 * gäbe der Pass Coins, käme man mit Geld an Coins und damit an die zufälligen
 * Trainingstaschen (Glücksspiel). Pass-Belohnungen sind nur Optik und Ehre.
 * Die Datenbank sperrt das zusätzlich (season_pass_levels.stars_reward = 0,
 * supabase/pass-ohne-coins.sql).
 */
export type RewardKind = "banner" | "emotes" | "frame" | "title" | "badge";

export interface PassLevel {
  level: number;
  xpRequired: number; // kumulierte Punkte, ab denen dieses Level erreicht ist
  kind: RewardKind;
  reward: string;
  icon: string;
  /** Kurzer, ehrlicher Hinweis, wo man die Belohnung sieht. */
  rewardWhere: string;
  /** Bei kind "title"/"badge": der Text, der im Profil/Chat erscheint. */
  label?: string;
  // Premium-Spur: zusätzliche Belohnung auf demselben Level.
  premiumReward: string;
  premiumIcon: string;
  /** true = in der Premium-Spur noch nicht echt (z. B. Beispielwerte). */
  premiumNote?: string;
}

/** Ein Saison-Emote ("Sticker"). Wird im Chat/Kommentar als :id: gespeichert. */
export interface SeasonEmote {
  id: string;
  label: string;
  emoji: string;
  /** Kleines Zusatz-Zeichen unten rechts (z. B. ⚽ + 🍂 = "Fußball im Laub"). */
  accent?: string;
}

/** Saison-Design: so sieht die ganze App während der Saison aus (Farben +
 *  Laub-/Schnee-Deko). Fehlt es, bleibt die App im normalen Grün. Alle
 *  Farben als "#RRGGBB". Die Texte müssen auf den Hintergründen mindestens so
 *  gut lesbar bleiben wie im normalen Design. */
export interface SeasonDesign {
  /** Ab diesem Saison-Pass-Level bekommt ein Spieler das Design automatisch
   *  (vorher und für Gäste: normales Grün). */
  unlockLevel: number;
  colors: {
    pitch: string; // Seitenhintergrund
    surface: string; // Karten
    surfaceHover: string;
    edge: string; // feine Ränder, gesperrte Knöpfe
    gold: string; // Sterne
    goldDim: string;
    action: string; // Knöpfe, Fortschritt, Chat-Knopf
    actionHover: string; // aktiver Tipp-Knopf
    ink: string; // Haupttext
    muted: string; // Nebentext
    ticker: string; // Nachrichtenstreifen unter der Kopfleiste
  };
  /** Zwei sanfte Lichtflecken im Seitenhintergrund (CSS-Farbe mit Deckkraft). */
  glow: [string, string];
  /** Farben der Deko-Blätter (Kopfleiste und Saison-Pass). */
  decoColors: string[];
  /** Verlauf im Kopfbereich der Saison-Pass-Seite. */
  heroFrom: string;
  heroTo: string;
}

export interface SeasonData {
  theme: SeasonTheme;
  /** Aussehen der App während dieser Saison (optional). */
  design?: SeasonDesign;
  /** Erster Tag der Saison, Format "JJJJ-MM-TT" (österreichische Zeit). */
  startsOn: string;
  /** Letzter Tag der Saison (einschließlich), Format "JJJJ-MM-TT". */
  endsOn: string;
  /** true = Entwurf: wird nie aktiv und nirgends angezeigt, bis Rene die
   *  Inhalte festgelegt und diese Zeile entfernt hat. */
  draft?: boolean;
  levels: PassLevel[];
  /** Emote-Paket, das mit dem Level der Art "emotes" freigeschaltet wird. */
  emotes: SeasonEmote[];
}
