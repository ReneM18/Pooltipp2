"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useTeams } from "@/lib/TeamsContext";
import { ensureScoredCounts, fixedLivePoints, peekScoredCount, subscribeForecastStore } from "@/lib/liveForecast";
import { BEGINNER_SHIELD_TIPS } from "@/lib/poolScore";
import { eventMinuteText, isGoalEvent, isLiveFinished, isLiveRunning, viennaDate } from "@/lib/liveScores";
import { isLiveLeagueEnabled, LIVE_SPORTS } from "@/lib/liveConfig";
import { peekLiveScore, useLivePolling, useLiveStoreVersion } from "@/lib/useLiveScores";
import { scoreText } from "@/lib/teamOrder";
import type { Match, Sport } from "@/lib/types";

// Freunde-Live (Rene, 16.10.2026: Freunde-Live): Live-Duell mit allen
// Freunden am Spieltag. Baut auf "Wenn es so bleibt" (lib/liveForecast.ts)
// auf: gleiche feste Punkte (classifyRankingTip + RANKING_POINTS, ohne Bonus
// und Joker), gleicher Anfänger-Schutz, gleiche Live-Stände aus dem
// gemeinsamen Speicher (lib/useLiveScores.ts, keine eigene API-Abfrage).
//
// Gezählt werden alle HEUTE laufenden bzw. laut Live-Daten abgepfiffenen,
// in der App noch nicht gewerteten Spiele aller eingeschalteten Ligen, für
// die der Browser Live-Daten hat (ohne Live-Daten ist der Stand unbekannt).
// Wer auf ein Spiel nicht getippt hat, bekommt dafür 0.
//
// Nur Mittipper (Rene, 16.10.2026): In eine Tabelle kommen außer dir nur
// Spieler mit mindestens einem Tipp auf ein gezähltes Spiel. Tippt außer dir
// niemand mit, gibt es die Tabelle nicht (Tippkarte ohne Zeile, Reiter
// "Freunde" mit Leerzustand) – vorher zählten Freunde ohne Tipp mit 0 mit.
//
// Tabellen: "Spieltag" = du + deine Freunde, dazu je Tipprunde du + ihre
// Mitglieder. Datenschutz ohne neues SQL: fremde Tipps gibt die Datenbank
// erst ab Tippschluss heraus (supabase/tipps-schutz.sql) – laufende Spiele
// sind immer nach Tippschluss. Mitglieder einer Runde darf jedes Mitglied
// lesen (supabase/tipprunden.sql), Anzeigenamen stehen in profiles. Geladen
// werden nur die Tipps dieser Spieler auf die laufenden Spiele, einmal und
// dann höchstens alle 10 Minuten neu; neue Live-Stände rechnet der Browser.
//
// Bewegung (▲/▼) und Ticker entstehen nur aus Änderungen der Live-Stände
// zwischen zwei Abrufen, nie beim ersten Laden. Den Verlauf hält ein
// gemeinsamer Speicher, damit Tippkarte, Tabelle und Tor-Hinweis dasselbe
// zeigen.

const REFRESH_MS = 10 * 60 * 1000;
const RETRY_MS = 20 * 1000;
const MAX_LIVE_MS = 4 * 60 * 60 * 1000;
const TICKER_MAX = 4;

export interface FriendsLiveGame {
  match: Match;
  home: number;
  away: number;
  running: boolean; // läuft bzw. Pause (false = laut Live-Daten abgepfiffen)
}

export interface FriendsLivePlayer {
  id: string;
  name: string;
  isMe: boolean;
  points: number; // vorläufige feste Punkte am Spieltag
  correct: number; // richtige Tipps (mind. Tendenz)
  tipped: number; // getippte laufende Spiele
  rank: number; // gleiche Punkte = gleicher Platz
  tied: boolean; // mindestens ein anderer mit gleich vielen Punkten
  move: number; // > 0 aufgestiegen, < 0 abgestiegen (seit dem letzten Abruf mit neuem Stand)
}

export interface FriendsLiveTicker {
  id: number;
  minute: string | null; // "64'"
  goal: string; // "Tor für Frankfurt (2:1)"
  change: string | null; // "Du überholst Herbert"
  good: boolean; // für dich positiv (Gold)
}

export interface FriendsLiveTable {
  key: string; // "friends" oder "league:<id>"
  label: string; // "Spieltag" bzw. Name der Tipprunde
  isLeague: boolean;
  gameCount: number; // gezählte Spiele (für "x von y richtig")
  players: FriendsLivePlayer[]; // du + Mittipper, sortiert nach Platz (mind. 2)
  me: FriendsLivePlayer;
  ticker: FriendsLiveTicker[]; // neueste zuerst
}

export interface FriendsLiveState {
  // Spieler hat mindestens einen Freund (Bedingung für die Zeile auf der Tippkarte).
  hasFriends: boolean;
  // Mindestens eine Tipprunde mit Mitspielern (für den Leerzustand).
  hasLeagues: boolean;
  // Alle Tipps geladen, Tabellen gerechnet.
  ready: boolean;
  games: FriendsLiveGame[];
  liveCount: number; // davon laufend (für "● n Spiele live")
  tables: FriendsLiveTable[]; // [0] = Spieltag (Freunde), danach Tipprunden – nur mit Mittippern
}

// Tabelle "Spieltag" für die Zeile auf der Tippkarte bzw. im Matchcenter:
// nur fertig gerechnet und mit mindestens einem mittippenden Freund
// (Rene, 16.10.2026: sonst keine Zeile, auch nicht "lädt").
export function friendsRowTable(state: FriendsLiveState | null): FriendsLiveTable | null {
  if (!state?.ready) return null;
  return state.tables.find((t) => t.key === "friends") ?? null;
}

// ---------------------------------------------------------------------------
// Gemeinsamer Speicher: Tipps der Mitspieler, Mitglieder der Tipprunden,
// Anzeigenamen.

interface TipRow {
  user_id: string;
  match_id: string;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
}

interface Store {
  tips: Map<string, TipRow[]> | null; // je Spiel
  tipsKey: string;
  tipsAt: number;
  members: Map<string, string[]> | null; // je Tipprunde
  membersKey: string;
  membersAt: number;
  names: Map<string, string>;
  loading: boolean;
  attemptAt: number;
  version: number;
  listeners: Set<() => void>;
}

const store: Store = {
  tips: null,
  tipsKey: "",
  tipsAt: 0,
  members: null,
  membersKey: "",
  membersAt: 0,
  names: new Map(),
  loading: false,
  attemptAt: 0,
  version: 0,
  listeners: new Set(),
};

function changed() {
  store.version++;
  store.listeners.forEach((l) => l());
}

async function loadMembers(leagueIds: string[]): Promise<Map<string, string[]> | null> {
  const map = new Map<string, string[]>(leagueIds.map((id) => [id, []]));
  if (leagueIds.length === 0) return map;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("league_members")
      .select("league_id, user_id")
      .in("league_id", leagueIds)
      .order("league_id")
      .order("user_id")
      .range(from, from + 999);
    if (error || !data) return null;
    for (const row of data as { league_id: string; user_id: string }[]) map.get(row.league_id)?.push(row.user_id);
    if (data.length < 1000) break;
  }
  return map;
}

async function loadNames(userIds: string[]) {
  for (let i = 0; i < userIds.length; i += 80) {
    const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", userIds.slice(i, i + 80));
    if (error || !data) return;
    for (const row of data as { id: string; display_name: string | null }[]) {
      store.names.set(row.id, row.display_name || "Spieler");
    }
  }
}

async function loadTips(matchIds: string[], userIds: string[]): Promise<Map<string, TipRow[]> | null> {
  const byMatch = new Map<string, TipRow[]>(matchIds.map((id) => [id, []]));
  for (let i = 0; i < userIds.length; i += 80) {
    const chunk = userIds.slice(i, i + 80);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("tips")
        .select("id, user_id, match_id, predicted_home_score, predicted_away_score")
        .in("match_id", matchIds)
        .in("user_id", chunk)
        .is("refunded_at", null)
        .order("id")
        .range(from, from + 999);
      if (error || !data) return null;
      for (const row of data as TipRow[]) byMatch.get(row.match_id)?.push(row);
      if (data.length < 1000) break;
    }
  }
  return byMatch;
}

// Mitglieder der Tipprunden laden (höchstens alle 10 Min.), dann Tipps aller
// beteiligten Spieler auf die laufenden Spiele, Anzeigenamen fehlender
// Spieler und die gewerteten Tipps (Anfänger-Schutz).
async function ensureLoaded(matchIds: string[], baseUsers: string[], leagueIds: string[], knownNames: Map<string, string>) {
  const now = Date.now();
  if (store.loading || now - store.attemptAt < RETRY_MS) return;
  const membersKey = leagueIds.slice().sort().join(",");
  const needMembers = !store.members || store.membersKey !== membersKey || now - store.membersAt > REFRESH_MS;
  const usersFor = (members: Map<string, string[]> | null) => {
    const set = new Set(baseUsers);
    members?.forEach((ids) => ids.forEach((id) => set.add(id)));
    return Array.from(set).sort();
  };
  const tipsKeyFor = (users: string[]) => `${matchIds.slice().sort().join(",")}|${users.join(",")}`;
  if (!needMembers) {
    const users = usersFor(store.members);
    const needTips = !store.tips || store.tipsKey !== tipsKeyFor(users) || now - store.tipsAt > REFRESH_MS;
    const missingScored = users.some((u) => peekScoredCount(u) === undefined);
    if (!needTips && !missingScored) return;
  }
  store.loading = true;
  store.attemptAt = now;
  try {
    if (needMembers) {
      const members = await loadMembers(leagueIds);
      if (members) {
        store.members = members;
        store.membersKey = membersKey;
        store.membersAt = Date.now();
      }
    }
    const users = usersFor(store.members);
    const tipsKey = tipsKeyFor(users);
    if (!store.tips || store.tipsKey !== tipsKey || Date.now() - store.tipsAt > REFRESH_MS) {
      const tips = await loadTips(matchIds, users);
      if (tips) {
        store.tips = tips;
        store.tipsKey = tipsKey;
        store.tipsAt = Date.now();
      }
    }
    const unnamed = users.filter((u) => !knownNames.has(u) && !store.names.has(u));
    if (unnamed.length > 0) await loadNames(unnamed);
    await ensureScoredCounts(users);
  } finally {
    store.loading = false;
    changed();
  }
}

// ---------------------------------------------------------------------------
// Verlauf je Tabelle: letzter Stand der Spiele und Plätze, Plätze davor und
// Ticker. Wird beim Rechnen fortgeschrieben (gleicher Stand = keine Änderung,
// daher egal, wie viele Karten gleichzeitig rechnen).

interface Track {
  sig: string;
  scores: Map<string, { home: number; away: number }>;
  ranks: Map<string, number>;
  prevRanks: Map<string, number> | null;
  ticker: FriendsLiveTicker[];
}

const tracks = new Map<string, Track>();
let tickerId = 1;

function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(" und ");
  return `${names.slice(0, 2).join(", ")} und ${names.length - 2} weitere`;
}

// "Du überholst Herbert" / "Doris zieht an dir vorbei" / "Doris springt auf Platz 1".
function rankChange(
  players: FriendsLivePlayer[],
  meId: string,
  prev: Map<string, number>,
  now: Map<string, number>,
): { text: string; good: boolean } | null {
  const mePrev = prev.get(meId);
  const meNow = now.get(meId);
  if (mePrev === undefined || meNow === undefined) return null;
  const overtaken: string[] = [];
  const passedBy: string[] = [];
  for (const p of players) {
    if (p.isMe) continue;
    const before = prev.get(p.id);
    if (before === undefined) continue;
    if (before <= mePrev && p.rank > meNow) overtaken.push(p.name);
    else if (before >= mePrev && p.rank < meNow) passedBy.push(p.name);
  }
  if (overtaken.length > 0) return { text: `Du überholst ${joinNames(overtaken)}`, good: true };
  if (passedBy.length > 0) {
    return { text: `${joinNames(passedBy)} ${passedBy.length === 1 ? "zieht" : "ziehen"} an dir vorbei`, good: false };
  }
  const leader = players.find((p) => p.rank === 1 && prev.get(p.id) !== undefined && prev.get(p.id) !== 1);
  if (leader) return leader.isMe ? { text: "Du springst auf Platz 1", good: true } : { text: `${leader.name} springt auf Platz 1`, good: false };
  return null;
}

function trackTable(
  key: string,
  games: FriendsLiveGame[],
  players: FriendsLivePlayer[],
  meId: string,
  describeGoal: (g: FriendsLiveGame, side: "home" | "away") => { minute: string | null; goal: string },
) {
  const sig = games.map((g) => `${g.match.id}=${g.home}:${g.away}`).join(",");
  const ranks = new Map(players.map((p) => [p.id, p.rank]));
  const scores = new Map(games.map((g) => [g.match.id, { home: g.home, away: g.away }]));
  let track = tracks.get(key);
  if (!track) {
    // Erster Stand: keine Bewegung, kein Ticker.
    tracks.set(key, { sig, scores, ranks, prevRanks: null, ticker: [] });
    return;
  }
  if (track.sig !== sig) {
    const goals: { minute: string | null; goal: string }[] = [];
    for (const g of games) {
      const before = track.scores.get(g.match.id);
      if (!before) continue;
      if (g.home > before.home) goals.push(describeGoal(g, "home"));
      if (g.away > before.away) goals.push(describeGoal(g, "away"));
    }
    // Fällt ein Spiel weg (gewertet) oder kommt eins ohne Tor dazu, ändern
    // sich die Plätze ohne Tor: dann keine Pfeile (neue Ausgangslage).
    const sameGames = games.length === track.scores.size && games.every((g) => track!.scores.has(g.match.id));
    const change = goals.length > 0 ? rankChange(players, meId, track.ranks, ranks) : null;
    const entries = goals.map((goal, i) => ({
      id: tickerId++,
      ...goal,
      // Die Platz-Änderung hängt am letzten Tor des Abrufs.
      change: i === goals.length - 1 ? change?.text ?? null : null,
      good: i === goals.length - 1 ? !!change?.good : false,
    }));
    track = {
      sig,
      scores,
      ranks,
      prevRanks: goals.length > 0 || sameGames ? track.ranks : null,
      ticker: [...entries.reverse(), ...track.ticker].slice(0, TICKER_MAX),
    };
    tracks.set(key, track);
  } else {
    // Gleicher Stand, neue Daten (z. B. Tipps neu geladen): Plätze ohne Ticker übernehmen.
    track.ranks = ranks;
  }
}

// "du bist 2. von 12 ▲1" (Text ohne Pfeil-Farbe), für Tor-Hinweis und Tippkarte.
// Ohne Bewegung leer statt "–" (wirkte wie ein Fehler, Rene, 16.10.2026).
export function moveText(move: number): string {
  return move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : "";
}

// ---------------------------------------------------------------------------

// Freunde-Live für den eingeloggten Spieler oder null (Gast, aus, keine
// Spiele mit Live-Stand). poll = true (offene Tabelle): eingeschaltete
// Sportarten mit laufenden Spielen im gemeinsamen Takt mitabfragen (gleiche
// Route und gleicher Server-Cache wie die Tippkarten, keine Extra-Quote).
export function useFriendsLive(enabled = true, poll = false): FriendsLiveState | null {
  const { matches, getTeam, myTips, orderFor } = useAppData();
  const { authUserId, displayName, friendEntries } = useUser();
  const { leagues } = useTeams();
  const active = enabled && !!authUserId;
  const liveVersion = useLiveStoreVersion(active);
  const [dataVersion, setDataVersion] = useState(store.version);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const listener = () => setDataVersion((v) => v + 1);
    store.listeners.add(listener);
    const unsubscribe = subscribeForecastStore(listener);
    return () => {
      store.listeners.delete(listener);
      unsubscribe();
    };
  }, [active]);

  // Uhr erst im Browser (Hydration), "heute" je Minute.
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, [active]);
  const today = now !== null ? viennaDate(now) : null;

  // Offene Tabelle: auch Sportarten abfragen, deren Karten gerade nicht zu
  // sehen sind (feste Liste, damit die Hook-Reihenfolge gleich bleibt).
  const pollSports = useMemo(() => {
    const set = new Set<Sport>();
    if (!active || !poll || now === null) return set;
    for (const m of matches) {
      if (m.draft || m.status === "cancelled") continue;
      if (m.status === "finished" && m.liveHomeScore !== null && m.liveAwayScore !== null) continue;
      const kickoff = Date.parse(m.kickoff);
      if (kickoff > now || now - kickoff > MAX_LIVE_MS || viennaDate(m.kickoff) !== today) continue;
      if (isLiveLeagueEnabled(m.sport, m.competition)) set.add(m.sport);
    }
    return set;
  }, [active, poll, matches, now, today]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  for (const sport of LIVE_SPORTS) useLivePolling(sport, today, pollSports.has(sport));

  const friends = useMemo(() => friendEntries.filter((f) => f.relation === "friend"), [friendEntries]);
  const knownNames = useMemo(() => {
    const map = new Map<string, string>(friends.map((f) => [f.id, f.name]));
    if (authUserId) map.set(authUserId, displayName || "Du");
    return map;
  }, [friends, authUserId, displayName]);

  // Heute laufende bzw. abgepfiffene, noch nicht gewertete Spiele mit Live-Stand.
  const games = useMemo(() => {
    const list: FriendsLiveGame[] = [];
    if (!active || today === null) return list;
    for (const m of matches) {
      if (m.draft || m.status === "cancelled") continue;
      if (m.status === "finished" && m.liveHomeScore !== null && m.liveAwayScore !== null) continue;
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) continue;
      const live = peekLiveScore(m, home.name, away.name);
      if (!live) continue;
      const running = isLiveRunning(live.status);
      if (!running && !isLiveFinished(live.status)) continue;
      // Spieltag = heute; über Mitternacht laufende Spiele zählen weiter.
      if (viennaDate(m.kickoff) !== today && !running) continue;
      list.push({ match: m, home: live.homeScore, away: live.awayScore, running });
    }
    return list.sort((a, b) => Date.parse(a.match.kickoff) - Date.parse(b.match.kickoff) || a.match.id.localeCompare(b.match.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, matches, liveVersion, today]);

  const leagueIds = useMemo(() => leagues.filter((l) => l.memberCount > 1).map((l) => l.id), [leagues]);
  const baseUsers = useMemo(() => (authUserId ? [authUserId, ...friends.map((f) => f.id)] : []), [authUserId, friends]);
  const idsKey = games.map((g) => g.match.id).join(",");
  const usersKey = baseUsers.join(",");
  const leaguesKey = leagueIds.join(",");
  useEffect(() => {
    if (!active || !idsKey) return;
    if (friends.length === 0 && leagueIds.length === 0) return;
    void ensureLoaded(idsKey.split(","), baseUsers, leagueIds, knownNames);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idsKey, usersKey, leaguesKey, liveVersion, dataVersion]);

  return useMemo<FriendsLiveState | null>(() => {
    if (!active || !authUserId || games.length === 0) return null;
    const hasFriends = friends.length > 0;
    const hasLeagues = leagueIds.length > 0;
    const liveCount = games.filter((g) => g.running).length;
    if (!store.tips || (leagueIds.length > 0 && !store.members)) return { hasFriends, hasLeagues, ready: false, games, liveCount, tables: [] };
    // Gerade angepfiffene Spiele zählen, sobald ihre Tipps geladen sind
    // (höchstens ~20 s später) – so springt die Anzeige nicht auf "lädt".
    const counted = games.filter((g) => store.tips!.has(g.match.id));
    if (counted.length === 0) return { hasFriends, hasLeagues, ready: false, games, liveCount, tables: [] };

    const myScored = myTips.filter((t) => t.evaluated && t.resultTier && !t.refunded).length;
    const myOpen = new Map(myTips.filter((t) => !t.refunded).map((t) => [t.matchId, t]));

    // Punkte je Spieler über alle Spiele (einmal gerechnet, für alle Tabellen).
    const totals = new Map<string, { points: number; correct: number; tipped: number }>();
    const slots = new Map<string, number>();
    const add = (userId: string, tipHome: number, tipAway: number, g: FriendsLiveGame) => {
      const scoredBefore = (userId === authUserId ? myScored : peekScoredCount(userId) ?? BEGINNER_SHIELD_TIPS) + (slots.get(userId) ?? 0);
      slots.set(userId, (slots.get(userId) ?? 0) + 1);
      const { tier, points } = fixedLivePoints(tipHome, tipAway, g.home, g.away, g.match.tipMode === "1x2", scoredBefore);
      const t = totals.get(userId) ?? { points: 0, correct: 0, tipped: 0 };
      t.points += points;
      t.tipped += 1;
      if (tier !== "falsch") t.correct += 1;
      totals.set(userId, t);
    };
    for (const g of counted) {
      // Eigener Tipp aus dem Browser (sofort aktuell, auch ohne Ladeergebnis).
      const mine = myOpen.get(g.match.id);
      if (mine && !mine.evaluated) add(authUserId, mine.predictedHomeScore, mine.predictedAwayScore, g);
      for (const tip of store.tips!.get(g.match.id) ?? []) {
        if (tip.user_id === authUserId) continue;
        if (tip.predicted_home_score === null || tip.predicted_away_score === null) continue;
        add(tip.user_id, tip.predicted_home_score, tip.predicted_away_score, g);
      }
    }

    const nameOf = (id: string) => knownNames.get(id) ?? store.names.get(id) ?? "Spieler";
    const describeGoal = (g: FriendsLiveGame, side: "home" | "away") => {
      const team = getTeam(side === "home" ? g.match.homeTeamId : g.match.awayTeamId);
      const live = (() => {
        const home = getTeam(g.match.homeTeamId);
        const away = getTeam(g.match.awayTeamId);
        return home && away ? peekLiveScore(g.match, home.name, away.name) : null;
      })();
      const goals = (live?.events ?? [])
        .filter((e) => isGoalEvent(e) && e.side === side)
        .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));
      const scorerKnown = goals.length === (side === "home" ? g.home : g.away);
      const minute = scorerKnown && goals.length > 0 ? eventMinuteText(goals[goals.length - 1]) : live?.elapsed ? `${live.elapsed}'` : null;
      return { minute, goal: `Tor für ${team?.name ?? "?"} (${scoreText(orderFor(g.match), g.home, g.away)})` };
    };

    const buildTable = (key: string, label: string, isLeague: boolean, ids: string[]): FriendsLiveTable | null => {
      // Nur Mittipper (Rene, 16.10.2026): außer dir nur, wer mind. ein
      // gezähltes Spiel getippt hat; tippt niemand mit, keine Tabelle.
      const others = Array.from(new Set(ids)).filter((id) => id !== authUserId && (totals.get(id)?.tipped ?? 0) > 0);
      if (others.length === 0) return null;
      const unique = [authUserId, ...others];
      const rows = unique.map((id) => {
        const t = totals.get(id) ?? { points: 0, correct: 0, tipped: 0 };
        return { id, name: id === authUserId ? displayName || "Du" : nameOf(id), isMe: id === authUserId, ...t, rank: 0, tied: false, move: 0 };
      });
      rows.sort((a, b) => b.points - a.points || (a.isMe ? -1 : b.isMe ? 1 : a.name.localeCompare(b.name, "de")));
      for (const r of rows) {
        r.rank = 1 + rows.filter((o) => o.points > r.points).length;
        r.tied = rows.some((o) => o !== r && o.points === r.points);
      }
      trackTable(key, counted, rows, authUserId, describeGoal);
      const track = tracks.get(key);
      if (track?.prevRanks) {
        for (const r of rows) {
          const before = track.prevRanks.get(r.id);
          r.move = before === undefined ? 0 : before - r.rank;
        }
      }
      return { key, label, isLeague, gameCount: counted.length, players: rows, me: rows.find((r) => r.isMe)!, ticker: track?.ticker ?? [] };
    };

    const tables: FriendsLiveTable[] = [];
    const push = (t: FriendsLiveTable | null) => {
      if (t) tables.push(t);
    };
    if (hasFriends) push(buildTable("friends", "Spieltag", false, friends.map((f) => f.id)));
    for (const league of leagues) {
      const members = store.members?.get(league.id);
      if (!members || members.length < 2) continue;
      push(buildTable(`league:${league.id}`, league.name, true, members));
    }
    return { hasFriends, hasLeagues, ready: true, games, liveCount, tables };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, authUserId, games, dataVersion, myTips, friends, leagues, leagueIds, knownNames, displayName]);
}
