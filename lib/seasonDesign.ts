"use client";

import { useEffect, useState } from "react";
import { CURRENT_SEASON } from "@/lib/seasons";
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

/** Setzt oder entfernt die Saison-Farben an <html>. */
export function applySeasonDesign(on: boolean) {
  const design = CURRENT_SEASON.design;
  if (!design) return;
  const html = document.documentElement;
  for (const [key, value] of Object.entries(seasonDesignVars(design))) {
    if (on) html.style.setProperty(key, value);
    else html.style.removeProperty(key);
  }
  if (on) html.setAttribute("data-season-design", CURRENT_SEASON.theme.id);
  else html.removeAttribute("data-season-design");
}

export function readSwitchedOff(): boolean {
  try {
    return localStorage.getItem(SEASON_DESIGN_STORAGE_KEY) === "aus";
  } catch {
    return false;
  }
}

/** Merkt sich auf diesem Gerät, ob das Design der laufenden Saison
 *  freigeschaltet ist (fürs Skript im <head>, siehe lib/seasons/design.ts). */
export function rememberUnlocked(unlocked: boolean) {
  try {
    if (unlocked) localStorage.setItem(SEASON_DESIGN_UNLOCK_KEY, CURRENT_SEASON.theme.id);
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
  const { adminChecked, authUserId, profileLoaded, passXP } = useUser();
  const design = CURRENT_SEASON.design;
  if (!design) return "locked";
  if (!adminChecked) return "unknown";
  if (!authUserId) return "locked";
  if (!profileLoaded) return "unknown";
  return passXP >= xpForLevel(design.unlockLevel) ? "unlocked" : "locked";
}

/** Für den Schalter im Profil. */
export function useSeasonDesign() {
  const design = CURRENT_SEASON.design;
  const { setSeasonDesignOff } = useUser();
  const unlock = useSeasonDesignUnlock();
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
    applySeasonDesign(on && unlock === "unlocked");
    window.dispatchEvent(new Event(OFF_EVENT));
    // Fürs Konto speichern: gilt dann auch auf den anderen Geräten.
    setSeasonDesignOff(!on);
  }

  return {
    available: !!design,
    unlocked: unlock === "unlocked",
    unlockLevel: design?.unlockLevel ?? 0,
    seasonName: CURRENT_SEASON.theme.name,
    enabled: !off,
    setEnabled,
  };
}
