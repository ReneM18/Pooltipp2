"use client";

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Match, NEWS_SPORT_ICONS, NewsSport, Sport, Team, TipMode } from "./types";
import {
  Competition,
  CompetitionsRow,
  COMPETITIONS_ROW_ID,
  buildStartCompetitions,
  findDuplicateCompetition,
  newCompetitionId,
} from "./competitions";
import { TipResultTier, BOOSTER_STAKE } from "./poolScore";
import { matchTitle } from "./teamOrder";

export interface SubmittedTip {
  id: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  stake: number;
  submittedAt: string;
  // PoolScore-Auswertung – setzt die Datenbank, sobald der Admin den
  // Endstand speichert (supabase/auswertung-server.sql).
  evaluated?: boolean;
  resultTier?: TipResultTier;
  rangDelta?: number;
  starsDelta?: number;
  beatPercent?: number;
  narration?: string;
  // Endstand, mit dem dieser Tipp ausgewertet wurde – so merkt jeder
  // Spieler beim nächsten Laden selbst, wenn der Admin den Endstand später
  // korrigiert hat, und die Auswertung wird für ihn nachgezogen.
  evaluatedHomeScore?: number;
  evaluatedAwayScore?: number;
  // Spiel wurde abgesagt: Einsatz kam zurück, keine Wertung (evaluated ist
  // dann ebenfalls true, damit der Tipp nie mehr ausgewertet wird).
  refunded?: boolean;
}

// Zeile aus der Tabelle "tips" -> Tipp im Browser.
export function tipFromRow(row: Record<string, unknown>): SubmittedTip {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    predictedHomeScore: row.predicted_home_score as number,
    predictedAwayScore: row.predicted_away_score as number,
    stake: row.stake as number,
    submittedAt: row.submitted_at as string,
    evaluated: (row.evaluated as boolean | null) ?? false,
    resultTier: (row.result_tier as TipResultTier | null) ?? undefined,
    rangDelta: (row.rang_delta as number | null) ?? undefined,
    starsDelta: (row.stars_delta as number | null) ?? undefined,
    beatPercent: (row.beat_percent as number | null) ?? undefined,
    narration: (row.narration as string | null) ?? undefined,
    evaluatedHomeScore: (row.evaluated_home_score as number | null) ?? undefined,
    evaluatedAwayScore: (row.evaluated_away_score as number | null) ?? undefined,
    refunded: !!row.refunded_at,
  };
}

// Zeile aus der Tabelle "bonus_answers" -> Bonus-Antwort im Browser.
export function bonusAnswerFromRow(row: Record<string, unknown>): SubmittedBonusAnswer {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    optionIndex: row.option_index as number,
    submittedAt: row.submitted_at as string,
    evaluated: (row.evaluated as boolean | null) ?? false,
    correct: (row.correct as boolean | null) ?? undefined,
    starsDelta: (row.stars_delta as number | null) ?? undefined,
  };
}

// Feed-Eintrag, den auch ANDERE User sehen dürfen – in dritter Person
// ("Rene hat …") statt "Du hast …", das nur für einen selbst stimmt.
export interface SharedActivity {
  author: string;
  text: string;
}

export interface NewsItem {
  id: string;
  text: string; // Kurz-Headline im Laufband
  article: string | null; // ausführlicher Artikeltext, öffnet sich beim Antippen der Headline
  sport: NewsSport | null; // null = allgemeine News ohne Sportart-Icon
  createdAt: string;
}

export interface SubmittedBonusAnswer {
  id: string;
  matchId: string;
  optionIndex: number;
  submittedAt: string;
  evaluated?: boolean;
  correct?: boolean;
  starsDelta?: number;
}

export interface Comment {
  id: string;
  matchId: string;
  author: string;
  text: string;
  createdAt: string;
  likedBy: string[];
  // Echte Nutzer-ID (Supabase auth.users.id), falls der Kommentar von einem
  // registrierten Account stammt – bisher nicht für Rechte-Prüfungen
  // genutzt (die laufen weiter über den Anzeigenamen wie zuvor), aber schon
  // mitgespeichert für später.
  userId?: string | null;
}

export interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  createdAt: string;
}

// Hinweis: Diese Daten leben nur im Browser-Speicher (React-State) und
// gehen beim Neuladen der Seite verloren. Das ist bewusst so für dieses
// MVP-Stadium — sobald Firestore angebunden ist, ersetzt das hier die
// initialTeams/initialMatches durch echte Datenbank-Abfragen.

const initialTeams: Team[] = [
  { id: "team-fcb", name: "Bayern München", sport: "Fußball", countryCode: "DE", primaryColor: "#DC052D", secondaryColor: "#FFFFFF", jerseyStyle: "solid" },
  { id: "team-bvb", name: "Borussia Dortmund", sport: "Fußball", countryCode: "DE", primaryColor: "#FDE100", secondaryColor: "#000000", jerseyStyle: "streifen" },
  { id: "team-rbl", name: "RB Leipzig", sport: "Fußball", countryCode: "DE", primaryColor: "#DD0741", secondaryColor: "#FFFFFF", jerseyStyle: "solid" },
  { id: "team-b04", name: "Bayer Leverkusen", sport: "Fußball", countryCode: "DE", primaryColor: "#E32221", secondaryColor: "#000000", jerseyStyle: "aermel" },
  { id: "team-sge", name: "Eintracht Frankfurt", sport: "Fußball", countryCode: "DE", primaryColor: "#E1000F", secondaryColor: "#000000", jerseyStyle: "solid" },
  { id: "team-vfb", name: "VfB Stuttgart", sport: "Fußball", countryCode: "DE", primaryColor: "#FFFFFF", secondaryColor: "#E32219", jerseyStyle: "aermel" },
  { id: "team-bills", name: "Buffalo Bills", sport: "NFL", countryCode: "US", primaryColor: "#00338D", secondaryColor: "#C60C30" },
  { id: "team-chiefs", name: "Kansas City Chiefs", sport: "NFL", countryCode: "US", primaryColor: "#E31837", secondaryColor: "#FFB81C" },
  { id: "team-bulls", name: "Chicago Bulls", sport: "NBA", countryCode: "US", primaryColor: "#CE1141", secondaryColor: "#000000", jerseyStyle: "solid" },
  { id: "team-knicks", name: "New York Knicks", sport: "NBA", countryCode: "US", primaryColor: "#006BB6", secondaryColor: "#F58426", jerseyStyle: "aermel" },
  { id: "team-bruins", name: "Boston Bruins", sport: "NHL", countryCode: "US", primaryColor: "#FFB81C", secondaryColor: "#000000" },
  { id: "team-rangers", name: "New York Rangers", sport: "NHL", countryCode: "US", primaryColor: "#0038A8", secondaryColor: "#CE1126" },
];

const initialMatches: Match[] = [
  {
    id: "match-1",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 7,
    kickoff: "2026-09-20T15:30:00+02:00",
    tipDeadline: "2026-09-20T15:00:00+02:00",
    homeTeamId: "team-fcb",
    awayTeamId: "team-bvb",
    fixedStake: 20,
    status: "finished",
    liveHomeScore: 2,
    liveAwayScore: 1,
    summaryVideoUrl: "https://www.youtube.com/results?search_query=bayern+dortmund+highlights",
    tvChannel: "Sky Sport Bundesliga",
    tipMode: "score",
  },
  {
    id: "match-2",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 7,
    kickoff: "2026-10-01T18:30:00+02:00",
    tipDeadline: "2026-10-01T18:00:00+02:00",
    homeTeamId: "team-rbl",
    awayTeamId: "team-b04",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "score",
  },
  {
    id: "match-3",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 7,
    kickoff: "2026-10-02T17:30:00+02:00",
    tipDeadline: "2026-10-02T17:00:00+02:00",
    homeTeamId: "team-sge",
    awayTeamId: "team-vfb",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "score",
  },
  {
    id: "match-4",
    sport: "NFL",
    competition: "NFL",
    kickoff: "2026-10-02T19:00:00-04:00",
    tipDeadline: "2026-10-02T18:45:00-04:00",
    homeTeamId: "team-bills",
    awayTeamId: "team-chiefs",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "1x2",
  },
  {
    id: "match-5",
    sport: "NBA",
    competition: "NBA",
    kickoff: "2026-10-03T20:00:00-04:00",
    tipDeadline: "2026-10-03T19:45:00-04:00",
    homeTeamId: "team-bulls",
    awayTeamId: "team-knicks",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "score",
  },
  {
    id: "match-6",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 8,
    kickoff: "2026-10-08T15:30:00+02:00",
    tipDeadline: "2026-10-08T15:00:00+02:00",
    homeTeamId: "team-b04",
    awayTeamId: "team-sge",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "score",
  },
  {
    id: "match-7",
    sport: "NFL",
    competition: "NFL",
    kickoff: "2026-10-09T19:00:00-04:00",
    tipDeadline: "2026-10-09T18:45:00-04:00",
    homeTeamId: "team-chiefs",
    awayTeamId: "team-bills",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "1x2",
  },
  {
    id: "match-8",
    sport: "NHL",
    competition: "NHL",
    kickoff: "2026-10-10T19:30:00-04:00",
    tipDeadline: "2026-10-10T19:15:00-04:00",
    homeTeamId: "team-bruins",
    awayTeamId: "team-rangers",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
    tipMode: "score",
  },
];

// News, Kommentare und Feed starten leer und kommen nur aus der Datenbank.
// Vorher standen hier erfundene Beispiel-Einträge ("Sabine K. verteidigt
// Platz 1", "Über 500.000 Sterne …"), die wie echte Meldungen wirkten.

interface ActivityRow {
  id: string;
  user_id: string | null;
  author_name: string | null;
  icon: string;
  text: string;
  created_at: string;
}

// Wandelt eine Feed-Zeile aus Supabase in einen Anzeige-Eintrag für den
// aktuellen User um – oder null, wenn er ihn nicht sehen soll (private
// Meldung eines anderen Users). Eigene öffentliche Einträge stehen in der
// Datenbank in dritter Person ("Rene hat …") und werden für einen selbst
// wieder zu "Du hast …".
function activityRowToItem(row: ActivityRow, me: string | null): ActivityItem | null {
  let text = row.text;
  if (row.user_id && row.user_id === me) {
    const prefix = row.author_name ? `${row.author_name} hat ` : null;
    if (prefix && text.startsWith(prefix)) text = `Du hast ${text.slice(prefix.length)}`;
  } else if (row.user_id && !row.author_name) {
    return null;
  }
  return { id: row.id, icon: row.icon, text, createdAt: row.created_at };
}

interface AppDataContextValue {
  teams: Team[];
  matches: Match[];
  addTeam: (team: Omit<Team, "id">) => void;
  updateTeam: (id: string, changes: Omit<Team, "id">) => void;
  removeTeam: (id: string) => void;
  // Wettbewerbe pro Sportart (Auswahl beim Spiel-Anlegen im Admin).
  // add/rename geben null bzw. false zurück, wenn der Name in dieser
  // Sportart schon existiert (Schreibweise egal) oder leer ist.
  competitions: Competition[];
  addCompetition: (name: string, sport: Sport) => Competition | null;
  renameCompetition: (id: string, name: string) => boolean;
  removeCompetition: (id: string) => void;
  addMatch: (match: Omit<Match, "id">) => void;
  removeMatch: (id: string) => void;
  // Spiel absagen (nur Admin): Die Datenbank erstattet alle offenen
  // Einsätze (Tipps + Duelle) und markiert das Spiel als abgesagt.
  cancelMatch: (id: string) => Promise<{ ok: true; refundedTips: number } | { ok: false; error: string }>;
  getTeam: (id: string) => Team | undefined;
  tipCounts: Record<string, number>;
  registerTip: (matchId: string) => void;
  tipsBySport: Record<Sport, number>;
  myTips: SubmittedTip[];
  // Tipp abgeben. Eingeloggt bestimmt die Datenbank den Einsatz und zieht
  // ihn ab (stake gilt nur für Gäste ohne Konto). Gibt den gespeicherten
  // Tipp zurück, oder null, wenn die Datenbank ihn abgelehnt hat (z. B.
  // Tippschluss). authorName: eigener Anzeigename, nur für den öffentlichen
  // Feed-Eintrag ("Rene hat beim Spiel … getippt").
  submitTip: (
    matchId: string,
    predictedHomeScore: number,
    predictedAwayScore: number,
    stake: number,
    authorName?: string
  ) => Promise<SubmittedTip | null>;
  // Korrigiert den eigenen, noch offenen Tipp zu einem Spiel bis zum
  // Tippschluss. Ändert NUR das Ergebnis: der Einsatz ist schon bezahlt und
  // bleibt gleich, es werden also keine Sterne abgezogen oder gutgeschrieben
  // und der Tipp zählt nicht doppelt. Nach Anpfiff sperrt zusätzlich die
  // Datenbank (Trigger freeze_tip_after_kickoff). Gibt false zurück, wenn
  // nichts geändert werden durfte.
  changeTip: (matchId: string, predictedHomeScore: number, predictedAwayScore: number) => boolean;
  // Lädt die eigenen Tipps aus der Datenbank neu (z. B. nach einer
  // Auswertung) – die Datenbank hat immer recht.
  reloadMyTips: () => Promise<void>;
  // true, sobald die eigenen Tipps nach dem Login geladen sind.
  myTipsLoaded: boolean;
  updateMatchScore: (matchId: string, homeScore: number | null, awayScore: number | null, status: Match["status"]) => void;
  // Nachträgliches Bearbeiten der Stammdaten eines bereits angelegten Spiels
  // (Wettbewerb, Spieltag, Teams, Anpfiff, Tippschluss, Einsatz) – bisher
  // konnte ein Spiel nur beim Anlegen einmalig gesetzt und danach nur noch
  // entfernt werden, nicht mehr korrigiert.
  updateMatchDetails: (
    matchId: string,
    updates: {
      competition: string;
      matchday?: number;
      kickoff: string;
      tipDeadline: string;
      homeTeamId: string;
      awayTeamId: string;
    }
  ) => void;
  setSummaryVideo: (matchId: string, url: string) => void;
  setTvChannel: (matchId: string, channel: string) => void;
  setTipMode: (matchId: string, mode: TipMode) => void;
  // Booster-Spiel an/aus (Einsatz fest 20 Sterne, sonst gratis). Gilt nur für
  // neue Tipps – schon abgegebene behalten ihren Einsatz.
  setBooster: (matchId: string, booster: boolean) => void;
  // Bonusfrage: Admin legt Frage+Optionen an (oder entfernt sie wieder mit
  // question:null), setzt später die richtige Antwort separat vom Endstand,
  // weil beides zu unterschiedlichen Zeitpunkten feststehen kann.
  setBonusQuestion: (matchId: string, question: string | null, options: string[], bonusStars: number) => void;
  setBonusQuestionAnswer: (matchId: string, correctOptionIndex: number) => void;
  myBonusAnswers: SubmittedBonusAnswer[];
  submitBonusAnswer: (matchId: string, optionIndex: number) => void;
  // Lädt die eigenen Bonus-Antworten (Tabelle bonus_answers) neu.
  reloadMyBonusAnswers: () => Promise<void>;
  newsItems: NewsItem[];
  addNews: (text: string, sport: NewsSport | null, article: string | null) => void;
  updateNews: (id: string, text: string, sport: NewsSport | null, article: string | null) => void;
  removeNews: (id: string) => void;
  comments: Comment[];
  getCommentsForMatch: (matchId: string) => Comment[];
  addComment: (matchId: string, author: string, text: string) => void;
  removeComment: (id: string) => void;
  toggleCommentLike: (id: string, name: string) => void;
  activity: ActivityItem[];
  // text: so wie man es selbst liest ("Du hast …"). shared: optional die
  // Fassung für alle anderen ("Rene hat …"). Ohne shared bleibt der Eintrag
  // privat und taucht nur im eigenen Feed auf.
  addActivity: (icon: string, text: string, shared?: SharedActivity) => void;
  // true, sobald Spiele/Teams/News aus Supabase geladen sind (vorher stehen
  // nur die eingebauten Demo-Daten im State).
  contentLoaded: boolean;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [competitions, setCompetitions] = useState<Competition[]>(() =>
    buildStartCompetitions(initialMatches)
  );
  // "X getippt" auf jeder Spielkarte: Anzahl ALLER abgegebenen Tipps pro
  // Spiel (alle Spieler), geladen aus der Datenbank – früher feste
  // Demo-Zahlen, die nur im eigenen Browser hochgezählt wurden.
  const [tipCounts, setTipCounts] = useState<Record<string, number>>({});
  const [myTips, setMyTips] = useState<SubmittedTip[]>([]);
  const [myBonusAnswers, setMyBonusAnswers] = useState<SubmittedBonusAnswer[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Eigene, schlanke Session-Erkennung statt useUser() zu importieren – würde
  // einen Kreis ergeben, weil UserContext seinerseits useAppData() braucht
  // (AppDataProvider steht im Baum oberhalb von UserProvider). Wird nur
  // gebraucht, um Kommentare/Feed-Einträge mit der echten User-ID zu
  // speichern, nicht für Anzeige-Zwecke.
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthUserId(data.session?.user.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Tipp-Zähler aller Spieler laden: beim Start, wenn die Seite wieder in
  // den Vordergrund kommt, und jede Minute. Gelesen wird nur die Spalte
  // match_id, seitenweise (Supabase liefert höchstens 1000 Zeilen am Stück).
  useEffect(() => {
    let cancelled = false;
    async function loadTipCounts() {
      const counts: Record<string, number> = {};
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("tips")
          .select("match_id")
          .order("id")
          .range(from, from + pageSize - 1);
        if (error || !data) {
          if (error) console.warn("Tipp-Zähler konnten nicht geladen werden:", error.message);
          return;
        }
        for (const row of data as { match_id: string }[]) {
          counts[row.match_id] = (counts[row.match_id] ?? 0) + 1;
        }
        if (data.length < pageSize) break;
      }
      if (!cancelled) setTipCounts(counts);
    }
    loadTipCounts();
    const interval = window.setInterval(loadTipCounts, 60_000);
    function onVisible() {
      if (document.visibilityState === "visible") loadTipCounts();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authUserId]);

  // Admin-Inhalte (Teams/Spiele/News) laden: beim ersten Laden aus Supabase
  // übernehmen (ersetzt die lokalen Demo-Daten komplett durch den echten,
  // von allen Usern geteilten Stand – auch wenn eine Liste dort leer ist,
  // sonst kämen gelöschte Demo-Einträge immer wieder zurück). Schlägt das
  // Laden fehl, bleiben die Demo-Daten nur zur Anzeige stehen und werden
  // NICHT zurückgeschrieben – sonst würde ein einziger Ladefehler beim Admin
  // die echten Daten in der Datenbank mit dem Demo-Stand überschreiben.
  const [loadedFromDb, setLoadedFromDb] = useState({ teams: false, matches: false, news: false });
  // true erst, wenn die Spiele wirklich aus Supabase kommen (die Auswertung
  // in UserContext darf nie mit Demo-Spielen rechnen).
  const contentLoaded = loadedFromDb.matches;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [teamsRes, matchesRes, newsRes] = await Promise.all([
        supabase.from("teams").select("id, data"),
        supabase.from("matches").select("data"),
        supabase.from("news").select("data"),
      ]);
      if (cancelled) return;
      if (!teamsRes.error && teamsRes.data) {
        // Die Wettbewerbe liegen als eigene Zeile in derselben Tabelle –
        // die gehört nicht zu den Teams.
        const compRow = teamsRes.data.find((row) => row.id === COMPETITIONS_ROW_ID);
        setTeams(
          teamsRes.data.filter((row) => row.id !== COMPETITIONS_ROW_ID).map((row) => row.data as Team)
        );
        const savedList = (compRow?.data as CompetitionsRow | undefined)?.list;
        if (Array.isArray(savedList)) {
          setCompetitions(savedList);
        } else {
          const dbMatches =
            !matchesRes.error && matchesRes.data ? matchesRes.data.map((row) => row.data as Match) : [];
          setCompetitions(buildStartCompetitions(dbMatches));
        }
      } else {
        console.warn("Teams konnten nicht geladen werden:", teamsRes.error?.message);
      }
      if (!matchesRes.error && matchesRes.data) {
        setMatches(matchesRes.data.map((row) => row.data as Match));
      } else {
        console.warn("Spiele konnten nicht geladen werden:", matchesRes.error?.message);
      }
      if (!newsRes.error && newsRes.data) {
        setNewsItems(newsRes.data.map((row) => row.data as NewsItem));
      } else {
        console.warn("News konnten nicht geladen werden:", newsRes.error?.message);
      }
      setLoadedFromDb({
        teams: !teamsRes.error && !!teamsRes.data,
        matches: !matchesRes.error && !!matchesRes.data,
        news: !newsRes.error && !!newsRes.data,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Schreibt Teams/Spiele/News automatisch zurück nach Supabase, sobald sich
  // etwas ändert (Admin legt an/bearbeitet/entfernt) – ein einziger
  // Sync-Punkt pro Sammlung statt in jeder einzelnen Änderungs-Funktion
  // (addTeam, updateMatchDetails, ...) einen eigenen Datenbank-Aufruf zu
  // brauchen. Nur der Admin-Account darf laut Datenbank-Regeln wirklich
  // schreiben – bei anderen Usern schlägt das erwartungsgemäß fehl und wird
  // nur als Hinweis geloggt, ohne die Ansicht zu stören.
  useEffect(() => {
    if (!loadedFromDb.teams || teams.length === 0) return;
    supabase
      .from("teams")
      .upsert(
        teams.map((t) => ({ id: t.id, data: t, updated_at: new Date().toISOString() })),
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) console.warn("Teams konnten nicht gespeichert werden:", error.message);
      });
  }, [teams, loadedFromDb.teams]);

  useEffect(() => {
    if (!loadedFromDb.matches || matches.length === 0) return;
    supabase
      .from("matches")
      .upsert(
        matches.map((m) => ({ id: m.id, data: m, updated_at: new Date().toISOString() })),
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) console.warn("Spiele konnten nicht gespeichert werden:", error.message);
      });
  }, [matches, loadedFromDb.matches]);

  useEffect(() => {
    if (!loadedFromDb.news || newsItems.length === 0) return;
    supabase
      .from("news")
      .upsert(
        newsItems.map((n) => ({ id: n.id, data: n, updated_at: new Date().toISOString() })),
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) console.warn("News konnten nicht gespeichert werden:", error.message);
      });
  }, [newsItems, loadedFromDb.news]);

  // Kommentare & Feed laufen NICHT nach dem "ganzes Array synchronisieren"-
  // Muster wie oben, weil hier (anders als bei Teams/Spielen/News, die nur
  // der Admin ändert) viele verschiedene echte User gleichzeitig eigene
  // Zeilen hinzufügen – jede Aktion schreibt direkt ihre eigene neue/
  // geänderte Zeile (siehe addComment/toggleCommentLike/removeComment/
  // addActivity unten). Beim Laden wird einmalig der komplette, von allen
  // geteilte Stand übernommen; danach halten Supabase-Realtime-Abos beide
  // Listen live aktuell, auch wenn ANDERE User etwas hinzufügen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const commentsRes = await supabase.from("match_comments").select("*").order("created_at", { ascending: true });
      if (cancelled) return;
      if (!commentsRes.error && commentsRes.data) {
        setComments(
          commentsRes.data.map((row) => ({
            id: row.id,
            matchId: row.match_id,
            author: row.author_name,
            text: row.text,
            createdAt: row.created_at,
            likedBy: (row.liked_by as string[]) ?? [],
            userId: row.user_id,
          }))
        );
      }
    })();

    const commentsChannel = supabase
      .channel("match_comments_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_comments" }, (payload) => {
        const row = payload.new as {
          id: string;
          match_id: string;
          author_name: string;
          text: string;
          created_at: string;
          liked_by: string[];
          user_id: string | null;
        };
        setComments((current) =>
          current.some((c) => c.id === row.id)
            ? current
            : [
                ...current,
                {
                  id: row.id,
                  matchId: row.match_id,
                  author: row.author_name,
                  text: row.text,
                  createdAt: row.created_at,
                  likedBy: row.liked_by ?? [],
                  userId: row.user_id,
                },
              ]
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_comments" }, (payload) => {
        const row = payload.new as { id: string; liked_by: string[] };
        setComments((current) => current.map((c) => (c.id === row.id ? { ...c, likedBy: row.liked_by ?? [] } : c)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "match_comments" }, (payload) => {
        const row = payload.old as { id: string };
        setComments((current) => current.filter((c) => c.id !== row.id));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(commentsChannel);
    };
  }, []);

  // Feed: eigene Einträge sieht man immer, fremde nur, wenn sie für alle
  // gedacht sind (author_name gesetzt, Text in dritter Person) – private
  // Meldungen wie "Du hast …" oder "Deine Sterne …" bleiben beim Besitzer.
  // Hängt an authUserId, weil erst mit der Sitzung klar ist, was "eigen" ist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const visibleFilter = authUserId
        ? `user_id.is.null,author_name.not.is.null,user_id.eq.${authUserId}`
        : "user_id.is.null,author_name.not.is.null";
      const { data, error } = await supabase
        .from("activity_feed")
        .select("*")
        .or(visibleFilter)
        .order("created_at", { ascending: false })
        .limit(300);
      if (cancelled) return;
      if (!error && data) {
        setActivity(
          data
            .map((row) => activityRowToItem(row as ActivityRow, authUserId))
            .filter((item): item is ActivityItem => item !== null)
        );
      }
    })();

    const activityChannel = supabase
      .channel(`activity_feed_live_${authUserId ?? "gast"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, (payload) => {
        const item = activityRowToItem(payload.new as ActivityRow, authUserId);
        if (!item) return;
        setActivity((current) => (current.some((a) => a.id === item.id) ? current : [item, ...current]));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(activityChannel);
    };
  }, [authUserId]);

  function addTeam(team: Omit<Team, "id">) {
    const id = `team-${Date.now()}`;
    setTeams((current) => [...current, { ...team, id }]);
  }

  // Spiele speichern nur die Team-ID, darum erscheinen Änderungen (Name,
  // Flagge, Farben) automatisch auch bei allen bestehenden Spielen. Das
  // Speichern in Supabase übernimmt der Sync-Effekt oben (upsert).
  function updateTeam(id: string, changes: Omit<Team, "id">) {
    setTeams((current) => current.map((t) => (t.id === id ? { ...changes, id } : t)));
  }

  function removeTeam(id: string) {
    setTeams((current) => current.filter((t) => t.id !== id));
    // Der Sync-Effekt oben schreibt nur die verbleibende Liste zurück
    // (upsert) – löscht aber keine Zeilen, die lokal entfernt wurden. Ohne
    // dieses explizite delete würde das Team in Supabase (und damit bei
    // allen anderen Usern) einfach liegen bleiben.
    supabase
      .from("teams")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Team konnte nicht gelöscht werden:", error.message);
      });
  }

  // Speichert die komplette Wettbewerbs-Liste als eine Zeile (siehe
  // lib/competitions.ts). Nur nach einer echten Änderung durch den Admin –
  // nie beim bloßen Laden, und nie, wenn das Laden fehlgeschlagen ist.
  function saveCompetitions(list: Competition[]) {
    setCompetitions(list);
    if (!loadedFromDb.teams) return;
    const row: CompetitionsRow = { kind: "competitions", list };
    supabase
      .from("teams")
      .upsert({ id: COMPETITIONS_ROW_ID, data: row, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .then(({ error }) => {
        if (error) console.warn("Wettbewerbe konnten nicht gespeichert werden:", error.message);
      });
  }

  function addCompetition(name: string, sport: Sport) {
    const clean = name.trim();
    if (!clean || findDuplicateCompetition(competitions, clean, sport)) return null;
    const created: Competition = { id: newCompetitionId(), name: clean, sport };
    saveCompetitions([...competitions, created]);
    return created;
  }

  // Umbenennen ändert den Namen auch bei allen Spielen dieser Sportart, die
  // noch den alten Namen tragen (z. B. Tippfehler ausbessern).
  function renameCompetition(id: string, name: string) {
    const clean = name.trim();
    const current = competitions.find((c) => c.id === id);
    if (!current || !clean || findDuplicateCompetition(competitions, clean, current.sport, id)) return false;
    saveCompetitions(competitions.map((c) => (c.id === id ? { ...c, name: clean } : c)));
    if (clean !== current.name) {
      setMatches((ms) =>
        ms.map((m) =>
          m.sport === current.sport && m.competition.trim() === current.name ? { ...m, competition: clean } : m
        )
      );
    }
    return true;
  }

  // Bestehende Spiele behalten ihren Wettbewerb als Text – nichts geht kaputt.
  function removeCompetition(id: string) {
    saveCompetitions(competitions.filter((c) => c.id !== id));
  }

  function addMatch(match: Omit<Match, "id">) {
    const id = `match-${Date.now()}`;
    setMatches((current) => [...current, { ...match, id }]);
  }

  function removeMatch(id: string) {
    setMatches((current) => current.filter((m) => m.id !== id));
    supabase
      .from("matches")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Spiel konnte nicht gelöscht werden:", error.message);
      });
  }

  async function cancelMatch(
    id: string
  ): Promise<{ ok: true; refundedTips: number } | { ok: false; error: string }> {
    const { data, error } = await supabase.rpc("cancel_match", { p_match_id: id });
    if (error) {
      // Fehlt die Funktion noch (supabase/spiel-absagen.sql nicht
      // ausgeführt), bleibt das Spiel bewusst unverändert – sonst wäre es
      // abgesagt, ohne dass jemand seinen Einsatz zurückbekommt.
      return {
        ok: false,
        error:
          error.code === "PGRST202"
            ? "Absagen ist noch nicht eingerichtet – bitte zuerst spiel-absagen.sql in Supabase ausführen."
            : error.message,
      };
    }
    // Lokal genauso setzen wie in der Datenbank, damit der nächste
    // Spiele-Abgleich aus diesem Tab das Spiel nicht wieder öffnet.
    setMatches((current) => current.map((m) => (m.id === id ? { ...m, status: "cancelled" } : m)));
    const match = matches.find((m) => m.id === id);
    if (match) {
      const home = getTeam(match.homeTeamId);
      const away = getTeam(match.awayTeamId);
      const text = `Abgesagt: ${matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")} – alle Einsätze gehen zurück.`;
      addActivity("🚫", text, { author: "PoolTipp", text });
    }
    return { ok: true, refundedTips: typeof data === "number" ? data : 0 };
  }

  function getTeam(id: string) {
    return teams.find((t) => t.id === id);
  }

  // Sofort sichtbar +1 beim eigenen Tipp; der nächste Abgleich mit der
  // Datenbank (siehe loadTipCounts) liefert dann wieder den echten Stand.
  function registerTip(matchId: string) {
    setTipCounts((current) => ({ ...current, [matchId]: (current[matchId] ?? 0) + 1 }));
  }

  // Eigene Tipps pro Sportart (Seite "Fortschritt") – aus den eigenen
  // Tipps berechnet, damit die Zahl auch nach dem Neuladen stimmt.
  const tipsBySport = useMemo(() => {
    const counts: Record<Sport, number> = { "Fußball": 0, NFL: 0, NBA: 0, NHL: 0 };
    for (const tip of myTips) {
      const match = matches.find((m) => m.id === tip.matchId);
      if (match) counts[match.sport] = (counts[match.sport] ?? 0) + 1;
    }
    return counts;
  }, [myTips, matches]);

  async function submitTip(
    matchId: string,
    predictedHomeScore: number,
    predictedAwayScore: number,
    stake: number,
    authorName?: string
  ): Promise<SubmittedTip | null> {
    const localTip: SubmittedTip = {
      id: `tip-${Date.now()}`,
      matchId,
      predictedHomeScore,
      predictedAwayScore,
      stake,
      submittedAt: new Date().toISOString(),
    };
    registerTip(matchId);
    setMyTips((current) => [...current, localTip]);

    let saved = localTip;
    if (authUserId) {
      // Einsatz, Tageslimit und Tipp-Serie rechnet die Datenbank
      // (supabase/auswertung-server.sql); zurück kommt der gespeicherte Tipp.
      const { data, error } = await supabase
        .from("tips")
        .insert({
          id: localTip.id,
          user_id: authUserId,
          match_id: matchId,
          predicted_home_score: predictedHomeScore,
          predicted_away_score: predictedAwayScore,
          stake,
          submitted_at: localTip.submittedAt,
        })
        .select()
        .maybeSingle();
      if (error || !data) {
        if (error) console.warn("Tipp konnte nicht gespeichert werden:", error.message);
        setMyTips((current) => current.filter((t) => t.id !== localTip.id));
        setTipCounts((current) => ({ ...current, [matchId]: Math.max(0, (current[matchId] ?? 1) - 1) }));
        return null;
      }
      saved = tipFromRow(data);
      setMyTips((current) => current.map((t) => (t.id === localTip.id ? saved : t)));
    }

    const match = matches.find((m) => m.id === matchId);
    if (match) {
      const home = getTeam(match.homeTeamId);
      const away = getTeam(match.awayTeamId);
      const sportIcon: Record<Sport, string> = { "Fußball": "⚽", NFL: "🏈", NBA: "🏀", NHL: "🏒" };
      const matchLabel = `${home?.name ?? "?"} vs. ${away?.name ?? "?"}`;
      addActivity(
        sportIcon[match.sport],
        `Du hast beim Spiel ${matchLabel} getippt.`,
        authorName ? { author: authorName, text: `${authorName} hat beim Spiel ${matchLabel} getippt.` } : undefined
      );
    }
    return saved;
  }

  function changeTip(matchId: string, predictedHomeScore: number, predictedAwayScore: number) {
    const match = matches.find((m) => m.id === matchId);
    if (
      !match ||
      match.status === "finished" ||
      match.status === "cancelled" ||
      new Date(match.tipDeadline).getTime() <= Date.now()
    )
      return false;
    const tip = [...myTips].reverse().find((t) => t.matchId === matchId);
    if (!tip || tip.evaluated) return false;
    setMyTips((current) =>
      current.map((t) => (t.id === tip.id ? { ...t, predictedHomeScore, predictedAwayScore } : t))
    );
    if (authUserId) {
      // Die Datenbank lässt die Änderung nur bis Tippschluss zu; was sie
      // zurückgibt, gilt.
      supabase
        .from("tips")
        .update({ predicted_home_score: predictedHomeScore, predicted_away_score: predictedAwayScore })
        .eq("id", tip.id)
        .select()
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.warn("Tipp konnte nicht geändert werden:", error.message);
          const stored = data ? tipFromRow(data) : tip;
          setMyTips((current) => current.map((t) => (t.id === tip.id ? stored : t)));
        });
    }
    return true;
  }

  // Eigene Tipps und Bonus-Antworten aus der Datenbank: beim Login laden,
  // beim Logout leeren. Gespeichert wird nicht mehr "alles auf einmal",
  // sondern jeder Tipp einzeln beim Abgeben/Ändern (siehe oben).
  const [myTipsLoaded, setMyTipsLoaded] = useState(false);

  async function reloadMyTips() {
    if (!authUserId) return;
    const userId = authUserId;
    const { data, error } = await supabase.from("tips").select("*").eq("user_id", userId);
    if (error) {
      console.warn("Tipps konnten nicht geladen werden:", error.message);
      return;
    }
    const fromDb = (data ?? []).map((row) => tipFromRow(row));
    // Lokal gerade erst abgegebene Tipps, die noch auf die Datenbank warten,
    // bleiben stehen.
    setMyTips((current) => {
      const dbIds = new Set(fromDb.map((t) => t.id));
      const pending = current.filter((t) => !dbIds.has(t.id) && !fromDb.some((d) => d.matchId === t.matchId));
      return [...fromDb, ...pending];
    });
  }

  async function reloadMyBonusAnswers() {
    if (!authUserId) return;
    const { data, error } = await supabase.from("bonus_answers").select("*").eq("user_id", authUserId);
    if (error) {
      console.warn("Bonus-Antworten konnten nicht geladen werden:", error.message);
      return;
    }
    setMyBonusAnswers((data ?? []).map((row) => bonusAnswerFromRow(row)));
  }

  useEffect(() => {
    setMyTipsLoaded(false);
    setMyTips([]);
    setMyBonusAnswers([]);
    if (!authUserId) return;
    let cancelled = false;
    Promise.all([reloadMyTips(), reloadMyBonusAnswers()]).then(() => {
      if (!cancelled) setMyTipsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  function updateMatchScore(
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
    status: Match["status"]
  ) {
    const previous = matches.find((m) => m.id === matchId);
    setMatches((current) =>
      current.map((m) =>
        m.id === matchId ? { ...m, liveHomeScore: homeScore, liveAwayScore: awayScore, status } : m
      )
    );
    if (status === "finished" && previous && previous.status !== "finished") {
      const home = getTeam(previous.homeTeamId);
      const away = getTeam(previous.awayTeamId);
      const endText = `Endstand: ${home?.name ?? "?"} ${homeScore ?? 0}:${awayScore ?? 0} ${away?.name ?? "?"}.`;
      addActivity("🏁", endText, { author: "PoolTipp", text: endText });
    }
  }

  function updateMatchDetails(
    matchId: string,
    updates: {
      competition: string;
      matchday?: number;
      kickoff: string;
      tipDeadline: string;
      homeTeamId: string;
      awayTeamId: string;
    }
  ) {
    setMatches((current) => current.map((m) => (m.id === matchId ? { ...m, ...updates } : m)));
  }

  function setSummaryVideo(matchId: string, url: string) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, summaryVideoUrl: url } : m))
    );
  }

  function setTvChannel(matchId: string, channel: string) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, tvChannel: channel } : m))
    );
  }

  function setTipMode(matchId: string, mode: TipMode) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, tipMode: mode } : m))
    );
  }

  function setBooster(matchId: string, booster: boolean) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, booster, fixedStake: booster ? BOOSTER_STAKE : 0 } : m))
    );
  }

  // question:null entfernt eine bestehende Bonusfrage wieder komplett.
  function setBonusQuestion(matchId: string, question: string | null, options: string[], bonusStars: number) {
    setMatches((current) =>
      current.map((m) =>
        m.id === matchId
          ? {
              ...m,
              bonusQuestion: question
                ? { question, options, correctOptionIndex: null, bonusStars }
                : null,
            }
          : m
      )
    );
  }

  // Setzt die richtige Antwort separat vom Endstand (die Bonusfrage muss
  // nicht zwingend zum Abpfiff schon feststehen, z. B. "Wer schießt das
  // erste Tor?" steht oft schon vor Spielende fest).
  function setBonusQuestionAnswer(matchId: string, correctOptionIndex: number) {
    setMatches((current) =>
      current.map((m) =>
        m.id === matchId && m.bonusQuestion
          ? { ...m, bonusQuestion: { ...m.bonusQuestion, correctOptionIndex } }
          : m
      )
    );
  }

  function submitBonusAnswer(matchId: string, optionIndex: number) {
    const answer: SubmittedBonusAnswer = {
      id: `bonus-${Date.now()}`,
      matchId,
      optionIndex,
      submittedAt: new Date().toISOString(),
    };
    setMyBonusAnswers((current) => [...current, answer]);
    if (!authUserId) return;
    // Nur bis Tippschluss und solange die richtige Antwort offen ist – sonst
    // speichert die Datenbank nichts und die Antwort verschwindet wieder.
    supabase
      .from("bonus_answers")
      .insert({ id: answer.id, user_id: authUserId, match_id: matchId, option_index: optionIndex })
      .select()
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.warn("Bonus-Antwort konnte nicht gespeichert werden:", error.message);
        if (!data) setMyBonusAnswers((current) => current.filter((a) => a.id !== answer.id));
      });
  }

  function addNews(text: string, sport: NewsSport | null, article: string | null) {
    const id = `news-${Date.now()}`;
    setNewsItems((current) => [
      { id, text, sport, article, createdAt: new Date().toISOString() },
      ...current,
    ]);
    const newsText = `Neue Schlagzeile: „${text}“`;
    addActivity(sport ? NEWS_SPORT_ICONS[sport] : "📰", newsText, { author: "PoolTipp", text: newsText });
  }

  function updateNews(id: string, text: string, sport: NewsSport | null, article: string | null) {
    setNewsItems((current) =>
      current.map((n) => (n.id === id ? { ...n, text, sport, article } : n))
    );
  }

  function removeNews(id: string) {
    setNewsItems((current) => current.filter((n) => n.id !== id));
    supabase
      .from("news")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("News konnte nicht gelöscht werden:", error.message);
      });
  }

  function getCommentsForMatch(matchId: string) {
    return comments.filter((c) => c.matchId === matchId);
  }

  function addComment(matchId: string, author: string, text: string) {
    if (!text.trim()) return;
    const id = `comment-${Date.now()}`;
    const createdAt = new Date().toISOString();
    setComments((current) => [
      ...current,
      { id, matchId, author, text: text.trim(), createdAt, likedBy: [], userId: authUserId },
    ]);
    if (authUserId) {
      supabase
        .from("match_comments")
        .insert({
          id,
          match_id: matchId,
          user_id: authUserId,
          author_name: author,
          text: text.trim(),
          created_at: createdAt,
        })
        .then(({ error }) => {
          if (error) console.warn("Kommentar konnte nicht gespeichert werden:", error.message);
        });
    }
    const match = matches.find((m) => m.id === matchId);
    const home = match ? getTeam(match.homeTeamId) : undefined;
    const away = match ? getTeam(match.awayTeamId) : undefined;
    const whereText = match ? ` zu ${home?.name ?? "?"} vs. ${away?.name ?? "?"}` : "";
    addActivity("💬", `Du hast einen Kommentar${whereText} geschrieben.`, {
      author,
      text: `${author} hat einen Kommentar${whereText} geschrieben.`,
    });
  }

  function removeComment(id: string) {
    setComments((current) => current.filter((c) => c.id !== id));
    supabase
      .from("match_comments")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Kommentar konnte nicht gelöscht werden:", error.message);
      });
  }

  function toggleCommentLike(id: string, name: string) {
    const target = comments.find((c) => c.id === id);
    if (!target) return;
    const nextLikedBy = target.likedBy.includes(name)
      ? target.likedBy.filter((n) => n !== name)
      : [...target.likedBy, name];
    setComments((current) => current.map((c) => (c.id === id ? { ...c, likedBy: nextLikedBy } : c)));
    supabase
      .from("match_comments")
      .update({ liked_by: nextLikedBy })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Like konnte nicht gespeichert werden:", error.message);
      });
  }

  function addActivity(icon: string, text: string, shared?: SharedActivity) {
    const id = `activity-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    setActivity((current) => [{ id, icon, text, createdAt }, ...current]);
    if (authUserId) {
      // Gespeichert wird für öffentliche Einträge die Fassung in dritter
      // Person samt Autor, für private Einträge der Text ohne Autor (den
      // bekommen andere User dann gar nicht erst angezeigt).
      supabase
        .from("activity_feed")
        .insert({
          id,
          user_id: authUserId,
          author_name: shared?.author ?? null,
          icon,
          text: shared?.text ?? text,
          created_at: createdAt,
        })
        .then(({ error }) => {
          if (error) console.warn("Feed-Eintrag konnte nicht gespeichert werden:", error.message);
        });
    }
  }

  return (
    <AppDataContext.Provider
      value={{
        teams,
        matches,
        addTeam,
        updateTeam,
        removeTeam,
        competitions,
        addCompetition,
        renameCompetition,
        removeCompetition,
        addMatch,
        removeMatch,
        cancelMatch,
        getTeam,
        tipCounts,
        registerTip,
        tipsBySport,
        myTips,
        submitTip,
        changeTip,
        reloadMyTips,
        myTipsLoaded,
        updateMatchScore,
        updateMatchDetails,
        setSummaryVideo,
        setTvChannel,
        setTipMode,
        setBooster,
        setBonusQuestion,
        setBonusQuestionAnswer,
        myBonusAnswers,
        submitBonusAnswer,
        reloadMyBonusAnswers,
        newsItems,
        addNews,
        updateNews,
        removeNews,
        comments,
        getCommentsForMatch,
        addComment,
        removeComment,
        toggleCommentLike,
        activity,
        addActivity,
        contentLoaded,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData muss innerhalb von <AppDataProvider> verwendet werden");
  }
  return context;
}
