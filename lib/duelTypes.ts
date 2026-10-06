import { TipResultTier } from "./poolScore";

// "pending" = Einladung verschickt, noch nicht alle haben geantwortet und der
//             erste Tippschluss ist noch nicht vorbei.
// "offen" = läuft mit allen, die angenommen haben, wartet auf die Spiele.
// "abgelehnt" = alle Eingeladenen haben abgelehnt, Einsatz zurück.
// "verfallen" = niemand hat rechtzeitig angenommen, Einsatz zurück.
// "ausgewertet" = alle Spiele vorbei, Coins verteilt.
// "abgesagt" = alle Spiele abgesagt (oder zu wenige Spieler), Einsätze zurück.
// "zurueckgezogen" = Ersteller hat es zurückgezogen, Einsätze zurück.
export type DuelStatus =
  | "pending"
  | "offen"
  | "abgelehnt"
  | "verfallen"
  | "ausgewertet"
  | "abgesagt"
  | "zurueckgezogen";

export type DuelPlayerStatus = "eingeladen" | "angenommen" | "abgelehnt" | "verfallen";

export interface DuelGameResult {
  matchId: string;
  tier?: TipResultTier;
  points?: number;
  tip?: string | null;
  cancelled?: boolean;
}

export interface DuelPlayer {
  userId: string;
  name: string;
  isCreator: boolean;
  status: DuelPlayerStatus;
  points?: number;
  place?: number;
  payout?: number;
  capped?: number;
  games: DuelGameResult[];
}

// Duell mit 2 bis 5 ECHTEN Konten über 1 bis 10 Spiele. Angelegt,
// angenommen, abgelehnt, zurückgezogen und ausgewertet wird alles in der
// Datenbank (supabase/duelle-gruppen.sql), weil Coins auf mehreren Konten
// gebucht werden.
export interface Duel {
  id: string;
  creatorId: string;
  creatorName: string;
  matchIds: string[];
  stake: number;
  status: DuelStatus;
  createdAt: string;
  resolvedAt?: string;
  players: DuelPlayer[];
}

// Regeln aus der Tabelle duel_settings (Standardwerte, falls nicht geladen).
export interface DuelRules {
  maxPlayers: number;
  maxGames: number;
  maxStake: number;
  dayWinCap: number;
  weekWinCap: number;
  pairPerWeek: number;
  minTips: number;
  minAccountDays: number;
}

export const DEFAULT_DUEL_RULES: DuelRules = {
  maxPlayers: 5,
  maxGames: 10,
  maxStake: 50,
  dayWinCap: 100,
  weekWinCap: 300,
  pairPerWeek: 2,
  minTips: 10,
  minAccountDays: 3,
};

// Punkte pro Spiel im Duell (wie die festen Punkte der Rangliste).
export const DUEL_POINTS: Record<TipResultTier, number> = {
  exakt: 10,
  differenz: 7,
  tendenz: 5,
  falsch: -3,
};
