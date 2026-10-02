import type { PassLevel, SeasonData, SeasonEmote } from "./types";
import { HERBST_2026 } from "./herbst2026";
import { WINTER_2026 } from "./winter2026";
import { playableSeasons, seasonForDate } from "./schedule";

export type { PassLevel, SeasonData, SeasonEmote, SeasonTheme, RewardKind } from "./types";
export { seasonCountdownText, seasonPeriodText, seasonForDate } from "./schedule";

// Jede Saison, die es gibt oder geben wird – auch Entwürfe. Eine neue Saison
// = neue Datei + hier eintragen. Alte Saisons NIE entfernen, damit ihre
// Abzeichen, Titel und Emotes auch nach Saisonende richtig angezeigt werden.
export const SEASON_FILES: SeasonData[] = [HERBST_2026, WINTER_2026];

/** Alle spielbaren Saisons (ohne Entwürfe), älteste zuerst. */
export const ALL_SEASONS: SeasonData[] = playableSeasons(SEASON_FILES);

/** Die gerade laufende Saison – ergibt sich automatisch aus dem Datum
 *  (startsOn/endsOn in der jeweiligen Saison-Datei). */
export const CURRENT_SEASON: SeasonData = seasonForDate(SEASON_FILES, new Date());

/** true, wenn seit dem Laden der Seite eine neue Saison begonnen hat (Tab
 *  über Nacht offen) – dann muss die Seite neu geladen werden. */
export function seasonChangedSinceLoad(): boolean {
  return seasonForDate(SEASON_FILES, new Date()).theme.id !== CURRENT_SEASON.theme.id;
}

// ----------------------------------------------------------------------------
// "Erreichte Level" werden pro Saison dauerhaft gespeichert, als Text wie
// "herbst-2026:4" in der Liste profiles.claimed_milestones (dort stehen sonst
// nur die Streak-Meilensteine als Zahlen – Text und Zahl kommen sich nicht in
// die Quere). Eintragen und Sterne gutschreiben macht die Datenbank beim
// Tagesbonus (claim_pass_rewards in supabase/auswertung-server.sql, dort
// stehen die Level auch in der Tabelle season_pass_levels). Andere Spieler
// können Titel/Abzeichen lesen (Profile sind für alle lesbar).
// ----------------------------------------------------------------------------
export function passClaimKey(seasonId: string, level: number): string {
  return `${seasonId}:${level}`;
}

/** Trennt claimed_milestones aus der DB in Streak-Zahlen und Pass-Einträge. */
export function splitClaimedMilestones(raw: unknown): { streak: number[]; pass: string[] } {
  const list = Array.isArray(raw) ? raw : [];
  return {
    streak: list.filter((x): x is number => typeof x === "number"),
    pass: list.filter((x): x is string => typeof x === "string"),
  };
}

/** Level der laufenden Saison, die mit diesen XP erreicht sind. */
export function reachedLevels(passXP: number): PassLevel[] {
  return CURRENT_SEASON.levels.filter((l) => passXP >= l.xpRequired);
}

/** Alle erreichten Level (gespeicherte aus allen Saisons + aktuelle XP). */
function ownedLevels(passXP: number | null, passClaims: string[]): PassLevel[] {
  const claims = new Set(passClaims);
  if (passXP !== null) {
    for (const l of reachedLevels(passXP)) claims.add(passClaimKey(CURRENT_SEASON.theme.id, l.level));
  }
  const result: PassLevel[] = [];
  for (const season of ALL_SEASONS) {
    for (const l of season.levels) {
      if (claims.has(passClaimKey(season.theme.id, l.level))) result.push(l);
    }
  }
  return result;
}

export interface PassHonors {
  /** Höchster Titel (neueste Saison, höchstes Level) – oder null. */
  title: { label: string; icon: string } | null;
  /** Alle Abzeichen, die man je bekommen hat (bleiben für immer). */
  badges: { label: string; icon: string }[];
  /** Emotes, die man benutzen darf. */
  emotes: SeasonEmote[];
}

export function getPassHonors(passXP: number | null, passClaims: string[]): PassHonors {
  const owned = ownedLevels(passXP, passClaims);
  const titles = owned.filter((l) => l.kind === "title" && l.label);
  const last = titles[titles.length - 1];
  const ownedSet = new Set(owned);
  const emotes: SeasonEmote[] = [];
  for (const season of ALL_SEASONS) {
    if (season.levels.some((l) => l.kind === "emotes" && ownedSet.has(l))) emotes.push(...season.emotes);
  }
  return {
    title: last ? { label: last.label!, icon: last.icon } : null,
    badges: owned.filter((l) => l.kind === "badge" && l.label).map((l) => ({ label: l.label!, icon: l.icon })),
    emotes,
  };
}

/** Sucht ein Emote aus irgendeiner Saison (auch alten) anhand der id. */
export function findEmote(id: string): SeasonEmote | undefined {
  for (const season of ALL_SEASONS) {
    const found = season.emotes.find((e) => e.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Level, ab dem das Emote-Paket der laufenden Saison freigeschaltet ist. */
export const CURRENT_EMOTE_LEVEL = CURRENT_SEASON.levels.find((l) => l.kind === "emotes");
