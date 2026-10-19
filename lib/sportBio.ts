"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Sport, SPORTS } from "@/lib/types";

// Sport-Steckbrief im Profil (Rene, 19.10.2026): Was hat der Spieler selbst
// mit Sport zu tun? Eigene Angabe, bringt keine Punkte/Ränge; "✓ bestätigt"
// setzt nur der Admin. Tabelle und Rechte: supabase/sport-steckbrief.sql.
// Kein Freitext außer dem Vereinsnamen – eingetippte Vereine sehen andere
// erst nach Freigabe durch den Admin (Vereine aus der App sofort).

export type RoleKey = "spieler" | "trainer" | "schiri" | "funktionaer" | "betreuer" | "journalist" | "fan";
export type RoleStatus = "aktiv" | "ex";
export type BioVisibility = "public" | "friends" | "private";

export interface BioRole {
  st: RoleStatus;
  niv?: string; // Spieler: hobby/verein/profi, Trainer: jugend/verein/profi
  land?: string;
  bl?: string;
  club?: string;
  clubApproved?: boolean; // nur beim eigenen Steckbrief (von sport_bio_of)
}

export interface BioData {
  roles?: Partial<Record<RoleKey, BioRole>>;
  sports?: Sport[];
  level?: string;
  since?: string;
}

export interface SportBio {
  data: BioData;
  verified: boolean;
  visibility: BioVisibility;
}

export const ROLES: { key: RoleKey; icon: string; label: string }[] = [
  { key: "spieler", icon: "🎽", label: "Spieler" },
  { key: "trainer", icon: "📋", label: "Trainer" },
  { key: "schiri", icon: "🟨", label: "Schiedsrichter" },
  { key: "funktionaer", icon: "🏟️", label: "Funktionär" },
  { key: "betreuer", icon: "🩹", label: "Betreuer/Physio" },
  { key: "journalist", icon: "🎙️", label: "Sportjournalist" },
  { key: "fan", icon: "📣", label: "Fan" },
];

export const PLAYER_LEVELS: [string, string][] = [
  ["hobby", "Hobby"],
  ["verein", "Verein"],
  ["profi", "Profi"],
];
export const COACH_LEVELS: [string, string][] = [
  ["jugend", "Jugend"],
  ["verein", "Verein"],
  ["profi", "Profi"],
];

/** Fan ist immer "aktiv"; Fan und Journalist brauchen kein "Wo". */
export const hasStatus = (k: RoleKey) => k !== "fan";
export const hasPlace = (k: RoleKey) => k !== "fan" && k !== "journalist";
export const hasLevel = (k: RoleKey) => k === "spieler" || k === "trainer";

export const COUNTRIES: Record<string, string[]> = {
  "🇦🇹 Österreich": ["Wien", "Niederösterreich", "Oberösterreich", "Steiermark", "Kärnten", "Salzburg", "Tirol", "Vorarlberg", "Burgenland"],
  "🇩🇪 Deutschland": [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen",
  ],
  "🇨🇭 Schweiz": ["Deutschschweiz", "Romandie", "Tessin"],
  "🌍 anderes Land": [],
};

export const PLAY_LEVELS = ["Hobby / Freizeit", "Unterhaus", "Landesliga", "Regionalliga", "2. Liga", "Profi"];

export const BIO_SPORTS: Sport[] = SPORTS;

export const CLUB_MAX = 30;

/** Bezeichnung einer Rolle, z. B. ["🎽", "Ex-Vereinsspieler"]. */
export function roleLabel(k: RoleKey, r: BioRole): [string, string] {
  const ex = hasStatus(k) && r.st === "ex" ? "Ex-" : "";
  if (k === "spieler") {
    if (r.niv === "profi") return ["🏅", `${ex}Profi`];
    if (r.niv === "hobby") return ["⚽", `${ex}Hobbyspieler`];
    return ["🎽", `${ex}Vereinsspieler`];
  }
  if (k === "trainer") {
    if (r.niv === "profi") return ["📋", `${ex}Profitrainer`];
    if (r.niv === "jugend") return ["📋", `${ex}Jugendtrainer`];
    return ["📋", `${ex}Trainer`];
  }
  const role = ROLES.find((x) => x.key === k)!;
  return [role.icon, `${ex}${role.label}`];
}

/** Ort einer Rolle für die Anzeige: "SK Sturm Graz · Steiermark". */
export function rolePlace(r: BioRole): string {
  const parts: string[] = [];
  if (r.club) parts.push(r.club);
  if (r.bl) parts.push(r.bl);
  else if (r.land && r.land !== "🌍 anderes Land") parts.push(r.land.replace(/^\S+\s/, ""));
  return parts.join(" · ");
}

/** Rollen in fester Reihenfolge (wie ROLES). */
export function orderedRoles(data: BioData): [RoleKey, BioRole][] {
  const roles = data.roles ?? {};
  return ROLES.filter((r) => roles[r.key]).map((r) => [r.key, roles[r.key]!]);
}

export function isBioEmpty(data: BioData | null | undefined): boolean {
  if (!data) return true;
  return orderedRoles(data).length === 0 && !(data.sports?.length) && !data.level && !data.since;
}

/** Hauptrolle für das Abzeichen unter dem Namen (erste aktive, sonst erste). */
export function mainRole(data: BioData | null | undefined): [string, string] | null {
  if (!data) return null;
  const list = orderedRoles(data);
  if (list.length === 0) return null;
  const nonFan = list.filter(([k]) => k !== "fan");
  const pick = nonFan.find(([, r]) => r.st === "aktiv") ?? nonFan[0] ?? list[0];
  return roleLabel(pick[0], pick[1]);
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
    setBio(row ? { data: (row.data ?? {}) as BioData, verified: !!row.verified, visibility: row.visibility as BioVisibility } : null);
    setStatus("ready");
  }, [userId]);

  useEffect(() => {
    setStatus("loading");
    reload();
  }, [reload]);

  return { bio, status, reload, setBio };
}

/** Eigenen Steckbrief speichern. Gibt einen Fehlertext zurück oder null. */
export async function saveSportBio(userId: string, data: BioData, visibility: BioVisibility): Promise<string | null> {
  // clubApproved kommt nur aus der Abfrage und wird nicht gespeichert.
  const roles: BioData["roles"] = {};
  for (const [k, r] of Object.entries(data.roles ?? {}) as [RoleKey, BioRole][]) {
    const { clubApproved: _ignored, ...rest } = r;
    void _ignored;
    const club = rest.club?.trim().slice(0, CLUB_MAX);
    roles[k] = { ...rest, club: club || undefined };
  }
  const clean: BioData = { ...data, roles };
  const { error } = await supabase
    .from("sport_bios")
    .upsert({ user_id: userId, data: clean, visibility }, { onConflict: "user_id" });
  if (error) return "Speichern hat nicht geklappt. Fehlt noch das Datenbank-Update?";
  return null;
}
