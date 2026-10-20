"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Sport-Steckbrief als Sportlerkarte (Rene, 20.10.2026: Prototyp v4 "weltklasse").
// Laufbahn aus Stationen (Rolle, Sportart, aktiv/ehemalig, wo, von–bis,
// Position, höchste Klasse), Erfolge, Rückennummer, Fan seit. Eigene Angabe,
// bringt keine Punkte/Ränge; "✓ bestätigt" setzt nur der Admin. Eingetippte
// Vereine sehen andere erst nach Freigabe (Vereine aus der App sofort).
// Tabelle und Rechte: supabase/sport-steckbrief.sql.

export type BioVisibility = "public" | "friends" | "private";

export interface Station {
  role: string;
  ex: boolean;
  sport?: string;
  pos?: string;
  land?: string;
  bl?: string;
  club?: string;
  from?: string;
  to?: string;
  league?: string;
  clubApproved?: boolean; // nur beim eigenen Steckbrief (von sport_bio_of)
}

export interface BioData {
  stations?: Station[];
  honors?: string[];
  nr?: string;
  since?: string;
  palette?: number;
  cardStyle?: CardStyle;
}

export interface SportBio {
  data: BioData;
  verified: boolean;
  visibility: BioVisibility;
}

export interface RoleDef {
  key: string;
  icon: string;
  label: string;
}

export const FAN_CAT = "Fan";
export const ROLE_CATS: [string, RoleDef[]][] = [
  [
    "Auf dem Platz",
    [
      { key: "spieler", icon: "🎽", label: "Spieler" },
      { key: "torwart", icon: "🧤", label: "Torwart" },
      { key: "kapitaen", icon: "©️", label: "Kapitän" },
      { key: "hobby", icon: "⚽", label: "Hobbysportler" },
      { key: "nachwuchs", icon: "🌱", label: "Nachwuchsspieler" },
    ],
  ],
  [
    "An der Seitenlinie",
    [
      { key: "trainer", icon: "📋", label: "Trainer" },
      { key: "cotrainer", icon: "📋", label: "Co-Trainer" },
      { key: "jugendtrainer", icon: "🧒", label: "Jugendtrainer" },
      { key: "twtrainer", icon: "🧤", label: "Torwarttrainer" },
      { key: "athletik", icon: "💪", label: "Athletiktrainer" },
      { key: "analyst", icon: "📊", label: "Videoanalyst" },
      { key: "scout", icon: "🔭", label: "Scout" },
    ],
  ],
  [
    "Regeln",
    [
      { key: "schiri", icon: "🟨", label: "Schiedsrichter" },
      { key: "assistent", icon: "🚩", label: "Schiri-Assistent" },
      { key: "var", icon: "📺", label: "Videoschiri" },
      { key: "kampfrichter", icon: "⏱️", label: "Kampfrichter" },
    ],
  ],
  [
    "Im Verein",
    [
      { key: "obmann", icon: "🏛️", label: "Obmann / Präsident" },
      { key: "sportdirektor", icon: "🗂️", label: "Sportdirektor" },
      { key: "sektion", icon: "📁", label: "Sektionsleiter" },
      { key: "nwleiter", icon: "🌱", label: "Nachwuchsleiter" },
      { key: "zeugwart", icon: "👕", label: "Zeugwart" },
      { key: "platzwart", icon: "🌿", label: "Platzwart" },
      { key: "kassier", icon: "💶", label: "Kassier" },
      { key: "ehrenamt", icon: "🍺", label: "Kantine / Ehrenamt" },
      { key: "sprecher", icon: "🎤", label: "Stadionsprecher" },
    ],
  ],
  [
    "Gesundheit",
    [
      { key: "physio", icon: "🩹", label: "Physio" },
      { key: "masseur", icon: "💆", label: "Masseur" },
      { key: "arzt", icon: "🩺", label: "Mannschaftsarzt" },
      { key: "betreuer", icon: "🧴", label: "Betreuer" },
    ],
  ],
  [
    "Medien",
    [
      { key: "journalist", icon: "🎙️", label: "Sportjournalist" },
      { key: "fotograf", icon: "📸", label: "Sportfotograf" },
      { key: "kommentator", icon: "🎧", label: "Kommentator" },
      { key: "creator", icon: "📱", label: "Content Creator" },
    ],
  ],
  [
    "Rund um den Sport",
    [
      { key: "berater", icon: "🤝", label: "Spielerberater" },
      { key: "lehrer", icon: "🏫", label: "Sportlehrer" },
      { key: "student", icon: "🎓", label: "Sportstudent" },
      { key: "sponsor", icon: "💼", label: "Sponsor" },
    ],
  ],
  [
    FAN_CAT,
    [
      { key: "fan", icon: "📣", label: "Fan" },
      { key: "mitglied", icon: "🪪", label: "Vereinsmitglied" },
      { key: "dauerkarte", icon: "🎟️", label: "Dauerkarte" },
      { key: "fanclub", icon: "🚩", label: "Fanclub" },
      { key: "auswaerts", icon: "🚌", label: "Auswärtsfahrer" },
      { key: "groundhopper", icon: "🏟️", label: "Groundhopper" },
    ],
  ],
];

const ROLE_MAP: Record<string, RoleDef & { cat: string }> = {};
for (const [cat, list] of ROLE_CATS) for (const r of list) ROLE_MAP[r.key] = { ...r, cat };

export function roleDef(key: string): RoleDef & { cat: string } {
  return ROLE_MAP[key] ?? { key, icon: "🏅", label: "Sportler", cat: "" };
}
export const isFanRole = (key: string) => roleDef(key).cat === FAN_CAT;
// Rollen mit Position (Feldspieler).
export const PLAYING_ROLES = ["spieler", "kapitaen", "hobby", "nachwuchs"];

export const BIO_SPORTS: { key: string; icon: string; label: string }[] = [
  { key: "fb", icon: "⚽", label: "Fußball" },
  { key: "ih", icon: "🏒", label: "Eishockey" },
  { key: "bb", icon: "🏀", label: "Basketball" },
  { key: "hb", icon: "🤾", label: "Handball" },
  { key: "nfl", icon: "🏈", label: "Football" },
  { key: "vb", icon: "🏐", label: "Volleyball" },
  { key: "ten", icon: "🎾", label: "Tennis" },
  { key: "ski", icon: "⛷️", label: "Ski" },
  { key: "la", icon: "🏃", label: "Leichtathletik" },
  { key: "rad", icon: "🚴", label: "Radsport" },
  { key: "fau", icon: "🤜", label: "Faustball" },
  { key: "stock", icon: "🥌", label: "Stocksport" },
  { key: "box", icon: "🥊", label: "Kampfsport" },
  { key: "golf", icon: "⛳", label: "Golf" },
  { key: "dart", icon: "🎯", label: "Darts" },
  { key: "motor", icon: "🏁", label: "Motorsport" },
  { key: "tt", icon: "🏓", label: "Tischtennis" },
  { key: "es", icon: "🎮", label: "eSports" },
];
const SPORT_MAP = Object.fromEntries(BIO_SPORTS.map((s) => [s.key, s]));
export function bioSport(key: string | undefined) {
  return key ? SPORT_MAP[key] : undefined;
}

export const POSITIONS: Record<string, string[]> = {
  fb: ["Tor", "Abwehr", "Mittelfeld", "Sturm"],
  ih: ["Tor", "Verteidigung", "Sturm"],
  hb: ["Tor", "Rückraum", "Kreis", "Außen"],
  bb: ["Aufbau", "Flügel", "Center"],
  nfl: ["Quarterback", "Running Back", "Receiver", "Line", "Linebacker", "Defensive Back", "Kicker"],
  vb: ["Zuspiel", "Außen", "Mitte", "Diagonal", "Libero"],
};

const LEAGUES: Record<string, string[]> = {
  "fb|AT": ["Bundesliga", "2. Liga", "Regionalliga", "Landesliga", "Oberliga", "Unterliga", "1. Klasse", "2. Klasse", "Hobby"],
  "fb|DE": ["Bundesliga", "2. Bundesliga", "3. Liga", "Regionalliga", "Oberliga", "Verbandsliga", "Landesliga", "Bezirksliga", "Kreisliga", "Hobby"],
  "ih|AT": ["ICE Hockey League", "AlpsHL", "Eliteliga", "Landesliga", "Hobby"],
  "*": ["Profi", "Halbprofi", "Amateur", "Hobby"],
};
export function leaguesFor(sport?: string, land?: string): string[] {
  return LEAGUES[`${sport}|${land}`] ?? LEAGUES["*"];
}
const PRO_LEAGUES = ["Bundesliga", "2. Liga", "2. Bundesliga", "3. Liga", "ICE Hockey League", "Profi"];

export const COUNTRIES: Record<string, { flag: string; name: string; states: string[] }> = {
  AT: { flag: "🇦🇹", name: "Österreich", states: ["Wien", "Niederösterreich", "Oberösterreich", "Steiermark", "Kärnten", "Salzburg", "Tirol", "Vorarlberg", "Burgenland"] },
  DE: {
    flag: "🇩🇪",
    name: "Deutschland",
    states: [
      "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern",
      "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen",
    ],
  },
  CH: { flag: "🇨🇭", name: "Schweiz", states: ["Deutschschweiz", "Romandie", "Tessin"] },
  XX: { flag: "🌍", name: "anderes Land", states: [] },
};

export const HONORS = [
  "🏆 Meister",
  "⬆️ Aufstieg",
  "🥇 Cupsieg",
  "🇦🇹 Nationalteam",
  "🎖️ Landesauswahl",
  "👟 Torschützenkönig",
  "🧤 Bester Torwart",
  "⭐ 100+ Spiele",
  "🏅 Ehrenmitglied",
  "🎯 Schiri des Jahres",
];

// Kartenfarben, wenn der Verein nicht in der App ist.
export const PALETTES: [string, string, string][] = [
  ["Grün-Weiß", "#1f7a4a", "#ffffff"],
  ["Rot-Weiß", "#c8102e", "#ffffff"],
  ["Blau-Weiß", "#1d4ea1", "#ffffff"],
  ["Schwarz-Weiß", "#1b1b1b", "#ffffff"],
  ["Gelb-Schwarz", "#f2c200", "#111111"],
  ["Violett-Weiß", "#5b2a86", "#ffffff"],
  ["Orange-Schwarz", "#f27a1a", "#111111"],
];

// Karten-Editionen: "standard" für alle, der Rest mit dem Premium-Pass
// (Rene, 20.10.2026: "über den Premium-Pass anpassen lassen").
export type CardStyle = "standard" | "holo" | "gold" | "saison";
export const CARD_STYLES: { key: CardStyle; label: string; premium: boolean }[] = [
  { key: "standard", label: "Standard", premium: false },
  { key: "holo", label: "✨ Holo", premium: true },
  { key: "gold", label: "👑 Gold-Edition", premium: true },
  { key: "saison", label: "🎨 Saison-Edition", premium: true },
];

export const CLUB_MAX = 30;

/** Bezeichnung einer Station, z. B. "Ex-Vereinsfußballer", "Eishockey-Fan". */
export function stationTitle(st: Station): string {
  const r = roleDef(st.role);
  const sport = bioSport(st.sport);
  let base = r.label;
  if (st.role === "spieler") {
    const level = st.league === "Hobby" ? "hobby" : PRO_LEAGUES.includes(st.league ?? "") ? "profi" : "verein";
    if (st.sport === "fb") base = level === "profi" ? "Profifußballer" : level === "hobby" ? "Hobbykicker" : "Vereinsfußballer";
    else if (st.sport === "ih") base = level === "hobby" ? "Hobby-Eishockeyspieler" : level === "profi" ? "Eishockeyprofi" : "Eishockeyspieler";
    else base = level === "profi" ? "Profi" : level === "hobby" ? "Hobbyspieler" : "Vereinsspieler";
  }
  if (isFanRole(st.role)) return sport && st.role === "fan" ? `${sport.label}-Fan` : base;
  return `${st.ex ? "Ex-" : ""}${base}`;
}

export function stationYears(st: Station): string {
  if (!st.from) return "";
  return `${st.from} – ${st.to || (st.ex ? "?" : "heute")}`;
}

/** Ort einer Station für die Anzeige: "SK Sturm Graz · Steiermark". */
export function stationPlace(st: Station): string {
  const c = st.land ? COUNTRIES[st.land] : undefined;
  return [st.club, st.bl || (c && st.land !== "XX" ? c.name : "")].filter(Boolean).join(" · ");
}

export function isBioEmpty(data: BioData | null | undefined): boolean {
  return !data || (!(data.stations?.length) && !(data.honors?.length) && !data.since);
}

/** Hauptrolle für das Abzeichen unter dem Namen: [Icon, Bezeichnung]. */
export function mainRole(data: BioData | null | undefined): [string, string] | null {
  const st = data?.stations?.[0];
  if (!st) return null;
  return [roleDef(st.role).icon, stationTitle(st)];
}

// Steckbriefe aus der ersten Version (Rollen statt Stationen) umwandeln.
const LEGACY_SPORT: Record<string, string> = { Fußball: "fb", NFL: "nfl", NBA: "bb", NHL: "ih", Handball: "hb" };
const LEGACY_LAND: Record<string, string> = { "🇦🇹 Österreich": "AT", "🇩🇪 Deutschland": "DE", "🇨🇭 Schweiz": "CH", "🌍 anderes Land": "XX" };
type LegacyRole = { st?: string; niv?: string; land?: string; bl?: string; club?: string; clubApproved?: boolean };
export function normalizeBio(raw: unknown): BioData {
  const d = (raw && typeof raw === "object" ? raw : {}) as BioData & {
    roles?: Record<string, LegacyRole>;
    sports?: string[];
    level?: string;
  };
  if (Array.isArray(d.stations) || !d.roles) {
    return { stations: d.stations ?? [], honors: d.honors ?? [], nr: d.nr, since: d.since, palette: d.palette, cardStyle: d.cardStyle };
  }
  const sport = LEGACY_SPORT[d.sports?.[0] ?? ""] ?? "fb";
  const stations: Station[] = Object.entries(d.roles).map(([key, r]) => {
    let role = key;
    let league: string | undefined;
    if (key === "trainer" && r.niv === "jugend") role = "jugendtrainer";
    if (key === "funktionaer") role = "obmann";
    if (key === "spieler") league = r.niv === "hobby" ? "Hobby" : r.niv === "profi" ? "Profi" : d.level;
    return {
      role,
      ex: r.st === "ex",
      sport,
      land: r.land ? LEGACY_LAND[r.land] : undefined,
      bl: r.bl,
      club: r.club,
      clubApproved: r.clubApproved,
      league,
    };
  });
  return { stations, honors: [], since: d.since };
}

/** Steckbrief eines Spielers laden (prüft Sichtbarkeit in der Datenbank). */
export function useSportBio(userId: string | null | undefined) {
  const [bio, setBio] = useState<SportBio | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const req = ++latest.current;
    if (!userId) {
      setBio(null);
      setStatus("ready");
      return;
    }
    const { data, error } = await supabase.rpc("sport_bio_of", { p_user: userId });
    // Inzwischen ein anderer Spieler geöffnet: alte Antwort verwerfen.
    if (req !== latest.current) return;
    if (error) {
      // Funktion fehlt (SQL noch nicht ausgeführt): Steckbrief einfach weglassen.
      setBio(null);
      setStatus("missing");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setBio(row ? { data: normalizeBio(row.data), verified: !!row.verified, visibility: row.visibility as BioVisibility } : null);
    setStatus("ready");
  }, [userId]);

  useEffect(() => {
    setStatus("loading");
    reload();
  }, [reload]);

  return { bio, status, reload };
}

/** Eigenen Steckbrief speichern. Gibt einen Fehlertext zurück oder null. */
export async function saveSportBio(userId: string, data: BioData, visibility: BioVisibility): Promise<string | null> {
  // clubApproved kommt nur aus der Abfrage und wird nicht gespeichert.
  const stations = (data.stations ?? []).map((st) => {
    const { clubApproved: _ignored, ...rest } = st;
    void _ignored;
    const club = rest.club?.trim().slice(0, CLUB_MAX);
    return { ...rest, club: club || undefined };
  });
  const clean: BioData = { ...data, stations };
  const { error } = await supabase
    .from("sport_bios")
    .upsert({ user_id: userId, data: clean, visibility }, { onConflict: "user_id" });
  if (error) return "Speichern hat nicht geklappt. Fehlt noch das Datenbank-Update?";
  return null;
}
