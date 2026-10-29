import type { Sport } from "../types";

// Anbieter-neutrale Typen für Live-Spielstände (Rene, 16.10.2026: Anbieter
// austauschbar). Route (app/api/live/route.ts) und Browser
// (lib/useLiveScores.ts, Matchcenter, Tippkarten, Admin) hängen NUR von
// diesen Typen ab – nie von einem bestimmten Anbieter. Ein Anbieter
// (lib/live/providers/…) wandelt seine Daten in diese Form um.

// Vereinheitlichter Status über alle Sportarten:
// NS = noch nicht begonnen, LIVE = läuft, HT = Halbzeit, BREAK = Pause
// (Drittel-/Viertelpause), FT/AET/PEN = beendet (regulär, nach
// Verlängerung, nach Penalty-/Siebenmeterschießen), OTHER = verschoben,
// abgesagt, abgebrochen usw. (wird auf den Karten nicht gezeigt).
export type LiveStatus = "NS" | "LIVE" | "HT" | "BREAK" | "FT" | "AET" | "PEN" | "OTHER";

// Ereignis im Spiel (Rene, 15.10.2026: Spieltag-Umbau). side = Team, dem es
// zählt: bei Toren (auch Eigentoren) das Team, dessen Stand steigt; bei
// Karten, Wechseln und verschossenen Elfmetern das Team des Spielers.
export type LiveEventType = "goal" | "owngoal" | "penalty" | "missed_penalty" | "yellow" | "red" | "subst";

export interface LiveEvent {
  minute: number;
  extra: number | null; // Nachspielzeit, z. B. 45+2 → minute 45, extra 2
  type: LiveEventType;
  side: "home" | "away";
  player: string | null;
  assist: string | null;
}

// Ein Schuss im Elfmeterschießen (Rene, 29.10.2026: "die elferschützen"),
// in der Reihenfolge der Schüsse. side = Team des Schützen.
export interface ShootoutKick {
  side: "home" | "away";
  player: string | null;
  scored: boolean;
}

export interface LiveGame {
  id: string;
  kickoff: string; // ISO 8601
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  // Elfmeterschießen (nur Fußball, nur wenn es eines gab).
  penaltyHome?: number;
  penaltyAway?: number;
  status: LiveStatus;
  // Status-Kürzel. Für die mitlaufende Minute zählen "1H", "2H" und "HT"
  // (1./2. Halbzeit, Halbzeit) – ein neuer Anbieter bildet seine Kürzel
  // darauf ab, alles andere darf er unverändert lassen.
  statusShort: string;
  statusText: string; // deutsch für die Karte, z. B. "67'", "Halbzeit", "2. Drittel"
  elapsed: number | null; // Spielminute (Fußball) bzw. Uhr im Abschnitt
  // Fortschritt 0..1 für den dünnen Balken, wenn der Anbieter ihn ohne
  // mitlaufende Minute kennt (Eishockey: über 60 Min., Rene, 16.10.2026).
  progress?: number;
  league: string; // "Wettbewerb · Land"
  // Runde laut Anbieter, z. B. "Regular Season - 11" (nur Fußball; fürs
  // Vorausfüllen des Spieltags im Admin, Rene, 28.10.2026).
  round?: string;
  // Tore, Karten, Wechsel (nur Fußball). Fehlt das Feld, liefert der Anbieter
  // für diese Sportart keine Ereignisse (Eishockey) → Spielverlauf ausblenden.
  events?: LiveEvent[];
  // Elfmeterschießen, nur Fußball und nur wenn es eines gab.
  shootout?: ShootoutKick[];
  // Stadion bzw. Halle laut Anbieter (Rene, 29.10.2026: Stadion auf der
  // Tippkarte), fehlt, wenn der Anbieter keines liefert (Eishockey).
  venue?: string;
  // Stadion-Nummer beim Anbieter (nur Fußball), für die Kapazität.
  venueId?: number;
}

// Woher die Spieldaten stammen (Rene, 16.10.2026: ehrliche Aktualität):
//  - "live":  frischer Live-Stand (höchstens 2× Takt alt).
//  - "day":   nur die Tagesliste (Anstoßzeiten/Endstände, hinkt live hinterher)
//             – z. B. weil kein Spiel läuft oder der Live-Abruf fehlschlug.
//  - "stale": Live-Abruf fehlgeschlagen, gezeigt wird der letzte erfolgreiche
//             Live-Stand (älter als ein Takt). Wird im Browser als
//             "verzögert" angezeigt.
export type LiveSource = "live" | "day" | "stale";

// Abfragen heute laut Anbieter (z. B. aus Antwort-Headern; kostet nichts extra).
export interface LiveQuota {
  used: number;
  limit: number;
  // Zeitpunkt (ms) der Anbieter-Antwort, aus deren Headern die Werte stammen
  // (Rene, 16.10.2026: Diagnose aus den Antworten).
  at?: number;
}

export interface LiveSnapshot {
  games: LiveGame[];
  // Server-Zeitpunkt (ms) des echten Abrufs beim Anbieter, aus dem die
  // gezeigten Stände stammen. Daraus rechnet der Browser die mitlaufende
  // Minute und "aktualisiert vor …".
  fetchedAt: number;
  source: LiveSource;
  // Fehler beim Live-Abruf, obwohl Spiele da sind (z. B. Tageslimit).
  liveError?: string;
  quota?: LiveQuota;
}

// Antwort von GET /api/live.
export interface LiveResponse extends Partial<LiveSnapshot> {
  sport: Sport;
  date: string;
  games: LiveGame[];
  // Gar keine Daten (kein Schlüssel, Anbieter nicht erreichbar …).
  error?: string;
  // Anbieter, z. B. "api-sports", mit Anzeigename und Link ("Daten von …").
  provider?: string;
  providerName?: string;
  providerUrl?: string;
}

// Diagnose für den Admin-Bereich (GET /api/live?status=1), nur aus dem
// Speicher dieser Server-Instanz – keine Abfrage beim Anbieter.
export interface LiveDiagnostics {
  provider: string;
  providerName: string;
  lastFetchAt: number | null; // letzter erfolgreicher Abruf beim Anbieter
  lastSource: LiveSource | null;
  lastError: string | null;
  lastErrorAt: number | null;
  quota: LiveQuota | null;
  quotaAt: number | null;
  // Letzte Spiellisten je Sportart + Tag (Rene, 16.10.2026: Zuordnungs-Check
  // im Admin) – nur was ohnehin abgefragt wurde.
  days?: LiveDayStatus[];
}

export interface LiveDayStatus {
  sport: Sport;
  date: string;
  fetchedAt: number;
  games: LiveGame[];
}

// Ergebnis eines Anbieters für eine Sportart und einen Tag.
export type LiveProviderResult =
  | { ok: true; snapshot: LiveSnapshot; expiresAt: number }
  | { ok: false; error: string; expiresAt: number; quota?: LiveQuota };

export interface LiveProviderRequest {
  sport: Sport;
  date: string; // YYYY-MM-DD (Wiener Zeit)
  league: string | null; // optional ein Wettbewerb
}

// Schnittstelle eines Anbieters (siehe README "Neuen Live-Anbieter ergänzen").
export interface LiveProvider {
  id: string; // Wert für LIVE_PROVIDER, z. B. "api-sports"
  name: string; // Anzeigename, z. B. "API-Sports"
  url: string; // Link für "Daten von …"
  // Schlüssel/Konfiguration fehlt → Fehlertext, sonst null.
  configError(): string | null;
  getDay(req: LiveProviderRequest): Promise<LiveProviderResult>;
  diagnostics(): LiveDiagnostics;
}
