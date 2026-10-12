"use client";

import { useEffect, useState } from "react";
import { ALL_EVENTS, CURRENT_SEASON, eventPhase, passClaimKey } from "@/lib/seasons";
import type { SeasonDesign } from "@/lib/seasons";
import { useUser } from "@/lib/UserContext";
import { xpForLevel } from "@/lib/seasonPass";
import {
  SEASON_DESIGN_OFF_EVENT,
  SEASON_DESIGN_STORAGE_KEY,
  SEASON_DESIGN_UNLOCK_KEY,
  seasonDesignVars,
} from "@/lib/seasons/design";

// Saison-Design im Browser: freischalten (ab dem Level aus der Saison-Datei)
// und der Schalter "Saison-Design an/aus" im Profil. Wie das Design selbst
// funktioniert, steht in lib/seasons/design.ts.

const OFF_EVENT = SEASON_DESIGN_OFF_EVENT;
/** Wird ausgelöst, wenn das Design an <html> wechselt (Deko zeichnet neu). */
export const DESIGN_APPLIED_EVENT = "pooltipp-design-gewechselt";

/** Welches Design gerade gilt: das der Saison oder eines Events (Halloween). */
export interface DesignSource {
  id: string;
  name: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
  design: SeasonDesign;
}

function seasonSource(): DesignSource | null {
  const design = CURRENT_SEASON.design;
  if (!design) return null;
  const t = CURRENT_SEASON.theme;
  return { id: t.id, name: t.name, icon: t.icon, colorFrom: t.colorFrom, colorTo: t.colorTo, design };
}

/** Event-Design (z. B. Halloween), wenn das Event läuft und man die Stufe dafür hat. */
export function eventDesignSource(claims: string[], date = new Date()): DesignSource | null {
  for (const ev of ALL_EVENTS) {
    if (!ev.design || eventPhase(ev, date) !== "laeuft") continue;
    if (!claims.includes(passClaimKey(ev.theme.id, ev.design.unlockLevel))) continue;
    const t = ev.theme;
    return { id: t.id, name: t.name, icon: t.icon, colorFrom: t.colorFrom, colorTo: t.colorTo, design: ev.design };
  }
  return null;
}

/** Setzt (oder entfernt bei source = null) die Design-Farben an <html>. */
export function applySeasonDesign(source: DesignSource | null) {
  const html = document.documentElement;
  // Erst alles weg, was irgendein Design gesetzt haben kann.
  const all = [seasonSource(), ...ALL_EVENTS.map((e) => (e.design ? { design: e.design } : null))];
  for (const s of all) {
    if (!s) continue;
    for (const key of Object.keys(seasonDesignVars(s.design))) html.style.removeProperty(key);
  }
  if (source) {
    for (const [key, value] of Object.entries(seasonDesignVars(source.design))) html.style.setProperty(key, value);
    html.setAttribute("data-season-design", source.id);
  } else {
    html.removeAttribute("data-season-design");
  }
  window.dispatchEvent(new Event(DESIGN_APPLIED_EVENT));
}

export function readSwitchedOff(): boolean {
  try {
    return localStorage.getItem(SEASON_DESIGN_STORAGE_KEY) === "aus";
  } catch {
    return false;
  }
}

/** Merkt sich auf diesem Gerät, welches Design freigeschaltet ist (id der
 *  Saison oder des Events; fürs Skript im <head>, siehe lib/seasons/design.ts). */
export function rememberUnlocked(id: string | null) {
  try {
    if (id) localStorage.setItem(SEASON_DESIGN_UNLOCK_KEY, id);
    else localStorage.removeItem(SEASON_DESIGN_UNLOCK_KEY);
  } catch {
    // nicht speicherbar: dann blitzt beim Laden kurz das Grün auf, sonst nichts.
  }
}

/**
 * "unknown" solange Sitzung/Profil noch laden (dann nichts umschalten, sonst
 * flackert es), sonst ob der Spieler das Level für das Saison-Design hat.
 * Gäste: nie. Die Saison-XP gelten pro Saison (lib/seasons, Saisonwechsel),
 * eine neue Saison muss also wieder neu freigeschaltet werden.
 */
export function useSeasonDesignUnlock(): "unknown" | "locked" | "unlocked" {
  return useDesignSource().state;
}

/** Wie oben, plus welches Design gilt. Ein laufendes Event (Halloween) geht
 *  vor, sobald man dort die Design-Stufe hat; sonst die Saison. */
export function useDesignSource(): { state: "unknown" | "locked" | "unlocked"; source: DesignSource | null } {
  const { adminChecked, authUserId, profileLoaded, passXP, passClaims } = useUser();
  if (!adminChecked) return { state: "unknown", source: null };
  if (!authUserId) return { state: "locked", source: null };
  if (!profileLoaded) return { state: "unknown", source: null };
  const event = eventDesignSource(passClaims);
  if (event) return { state: "unlocked", source: event };
  const season = seasonSource();
  if (season && passXP >= xpForLevel(season.design.unlockLevel)) return { state: "unlocked", source: season };
  return { state: "locked", source: null };
}

/** Für den Schalter im Profil. */
export function useSeasonDesign() {
  const design = CURRENT_SEASON.design;
  const { setSeasonDesignOff } = useUser();
  const { state: unlock, source } = useDesignSource();
  const [off, setOff] = useState(false);
  useEffect(() => {
    setOff(readSwitchedOff());
    const sync = () => setOff(readSwitchedOff());
    window.addEventListener(OFF_EVENT, sync);
    return () => window.removeEventListener(OFF_EVENT, sync);
  }, []);

  function setEnabled(on: boolean) {
    setOff(!on);
    try {
      if (on) localStorage.removeItem(SEASON_DESIGN_STORAGE_KEY);
      else localStorage.setItem(SEASON_DESIGN_STORAGE_KEY, "aus");
    } catch {
      // localStorage gesperrt (privater Modus): gilt dann nur bis zum Neuladen.
    }
    applySeasonDesign(on && unlock === "unlocked" ? source : null);
    window.dispatchEvent(new Event(OFF_EVENT));
    // Fürs Konto speichern: gilt dann auch auf den anderen Geräten.
    setSeasonDesignOff(!on);
  }

  return {
    available: !!design || !!source,
    unlocked: unlock === "unlocked",
    unlockLevel: design?.unlockLevel ?? 0,
    seasonName: source?.name ?? CURRENT_SEASON.theme.name,
    enabled: !off,
    setEnabled,
  };
}
