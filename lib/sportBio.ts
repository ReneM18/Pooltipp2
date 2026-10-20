"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ALL_SPORTS, Sport } from "@/lib/types";

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
  honors?: Honor[];
  interests?: Interest[];
  nr?: string;
  since?: string;
  palette?: number;
  cardStyle?: CardStyle;
  // Eigenes Kartenfoto (quadratisches JPEG als data-URL, components/CardPhotoEditor.tsx).
  // Fehlt es, zeigt die Karte das Profilbild.
  photo?: string;
}

// Erfolg mit Verein und Jahr (Karte v5, Rene 20.10.2026: "Erfolge mit wem und das Jahr").
export interface Honor {
  t: string; // Art, z. B. "Meister" (siehe HONOR_TYPES)
  league?: string; // z. B. "Unterliga"
  club?: string; // mit wem
  year?: string;
}

// Interesse an einer anderen Sportart, optional mit Lieblingsverein/-sportler.
export interface Interest {
  k: string; // Schlüssel aus BIO_SPORTS
  fav?: string;
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

// Nur wenige Stufen (Rene, 20.10.2026: "die Landesligen weg, nur ganz wenig für Profis").
const LEVELS = ["Profi", "Halbprofi", "Amateur", "Hobby"];
export function leaguesFor(_sport?: string, _land?: string): string[] {
  return LEVELS;
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

export const HONOR_TYPES: { t: string; icon: string }[] = [
  { t: "Meister", icon: "🏆" },
  { t: "Aufstieg", icon: "⬆️" },
  { t: "Cupsieg", icon: "🥇" },
  { t: "Nationalteam", icon: "🇦🇹" },
  { t: "Landesauswahl", icon: "🎖️" },
  { t: "Torschützenkönig", icon: "👟" },
  { t: "Bester Torwart", icon: "🧤" },
  { t: "100+ Spiele", icon: "⭐" },
  { t: "Ehrenmitglied", icon: "🏅" },
  { t: "Trainerlizenz", icon: "🎓" },
  { t: "Schiri des Jahres", icon: "🎯" },
];
export const honorIcon = (t: string) => HONOR_TYPES.find((h) => h.t === t)?.icon ?? "🏅";
export const MAX_HONORS = 12;
export const MAX_INTERESTS = 8;
export const FAV_MAX = 30;

/** Erfolge nach Jahr, neueste zuerst (ohne Jahr ans Ende). */
export function sortedHonors(data: BioData): Honor[] {
  return [...(data.honors ?? [])].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
}

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

// Jahreszahlen werden nicht mehr gezeigt (Rene, 20.10.2026); alte Angaben bleiben gespeichert.
export function stationYears(_st: Station): string {
  return "";
}

/** Ort einer Station für die Anzeige: "SK Sturm Graz · Steiermark". */
export function stationPlace(st: Station): string {
  const c = st.land ? COUNTRIES[st.land] : undefined;
  return [st.club, st.bl || (c && st.land !== "XX" ? c.name : "")].filter(Boolean).join(" · ");
}

export function isBioEmpty(data: BioData | null | undefined): boolean {
  return !data || (!(data.stations?.length) && !(data.honors?.length) && !(data.interests?.length) && !data.since);
}

/** Hauptrolle für das Abzeichen unter dem Namen: [Icon, Bezeichnung]. */
export function mainRole(data: BioData | null | undefined): [string, string] | null {
  const st = data?.stations?.[0];
  if (!st) return null;
  return [roleDef(st.role).icon, stationTitle(st)];
}

// Erfolge aus #299 waren nur Texte wie "🏆 Meister" – in Einträge umwandeln.
function normalizeHonors(raw: unknown): Honor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h): Honor | null => {
      if (typeof h === "string") {
        const label = h.replace(/^\S+\s/, "");
        return { t: label };
      }
      return h && typeof h === "object" && typeof (h as Honor).t === "string" ? (h as Honor) : null;
    })
    .filter((h): h is Honor => !!h);
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
    const photo = typeof d.photo === "string" && d.photo.startsWith("data:image/jpeg;base64,") ? d.photo : undefined;
    return {
      stations: d.stations ?? [],
      honors: normalizeHonors(d.honors),
      interests: Array.isArray(d.interests) ? d.interests.filter((i) => i && typeof i.k === "string") : [],
      nr: d.nr,
      since: d.since,
      palette: d.palette,
      cardStyle: d.cardStyle,
      photo,
    };
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

/** Werte einer Sportart für die Karte (supabase/sportlerkarte-statistik.sql). */
export interface SportCardStat {
  sport: Sport;
  points: number;
  place: number | null;
  prestige: number;
  // Nur gesetzt, wenn man die Statistik sehen darf:
  tips: number | null;
  evaluated: number | null;
  exakt: number | null;
  richtig: number | null;
  firstTip: string | null;
  lastTip: string | null;
}

/**
 * Karte pro Sportart (Rene, 20.10.2026: "das brauchen wir pro Sportart"):
 * Rangpunkte, Platz und Prestige je Sportart, dazu die Tipp-Statistik mit
 * Zeitraum, falls der Betrachter sie sehen darf. null = lädt oder SQL fehlt.
 */
export function useSportCardStats(userId: string | null | undefined): SportCardStat[] | null {
  const [stats, setStats] = useState<SportCardStat[] | null>(null);
  useEffect(() => {
    let alive = true;
    setStats(null);
    if (!userId) return;
    supabase.rpc("sport_card_stats", { p_user: userId }).then(({ data, error }) => {
      if (!alive || error || !Array.isArray(data)) return;
      setStats(
        (data as Record<string, unknown>[])
          .filter((r) => ALL_SPORTS.includes(r.sport as Sport))
          .map((r) => ({
            sport: r.sport as Sport,
            points: Number(r.points ?? 0),
            place: r.place == null ? null : Number(r.place),
            prestige: Number(r.prestige ?? 0),
            tips: r.tips == null ? null : Number(r.tips),
            evaluated: r.evaluated == null ? null : Number(r.evaluated),
            exakt: r.exakt == null ? null : Number(r.exakt),
            richtig: r.richtig == null ? null : Number(r.richtig),
            firstTip: (r.first_tip as string | null) ?? null,
            lastTip: (r.last_tip as string | null) ?? null,
          }))
      );
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  return stats;
}

// Sportart der App (Rangliste) <-> Sportart im Steckbrief.
export const APP_SPORT_OF_BIO: Record<string, Sport> = { fb: "Fußball", ih: "NHL", bb: "NBA", nfl: "NFL", hb: "Handball" };
export const BIO_SPORT_OF_APP: Partial<Record<Sport, string>> = { Fußball: "fb", NHL: "ih", NBA: "bb", NFL: "nfl", Handball: "hb" };
