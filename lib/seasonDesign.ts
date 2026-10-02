"use client";

import { useEffect, useState } from "react";
import { CURRENT_SEASON } from "@/lib/seasons";
import type { SeasonDesign } from "@/lib/seasons/types";
import { SEASON_DESIGN_STORAGE_KEY, seasonDesignVars } from "@/lib/seasons/design";

// Schalter "Saison-Design an/aus" im Profil. Wie das Design funktioniert,
// steht in lib/seasons/design.ts.

function applySeasonDesign(design: SeasonDesign | undefined, on: boolean) {
  const html = document.documentElement;
  if (!design) return;
  const vars = seasonDesignVars(design);
  for (const [key, value] of Object.entries(vars)) {
    if (on) html.style.setProperty(key, value);
    else html.style.removeProperty(key);
  }
  if (on) html.setAttribute("data-season-design", CURRENT_SEASON.theme.id);
  else html.removeAttribute("data-season-design");
}

/** Für den Schalter im Profil. available = die laufende Saison hat ein Design. */
export function useSeasonDesign() {
  const design = CURRENT_SEASON.design;
  const [enabled, setEnabledState] = useState(true);
  useEffect(() => {
    setEnabledState(document.documentElement.hasAttribute("data-season-design"));
  }, []);

  function setEnabled(on: boolean) {
    setEnabledState(on);
    applySeasonDesign(design, on);
    try {
      if (on) localStorage.removeItem(SEASON_DESIGN_STORAGE_KEY);
      else localStorage.setItem(SEASON_DESIGN_STORAGE_KEY, "aus");
    } catch {
      // localStorage gesperrt (privater Modus): gilt dann nur bis zum Neuladen.
    }
  }

  return { available: !!design, seasonName: CURRENT_SEASON.theme.name, enabled, setEnabled };
}
