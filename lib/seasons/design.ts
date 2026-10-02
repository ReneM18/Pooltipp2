import { SEASON_FILES } from "./index";
import { playableSeasons } from "./schedule";
import type { SeasonDesign } from "./types";

// ============================================================================
// Saison-Design: die ganze App bekommt die Farben der laufenden Saison.
// ============================================================================
// Die Farben stehen in der Saison-Datei (z. B. herbst2026.ts → design). Die
// App-Farben (tailwind.config.ts) sind CSS-Variablen; hier werden sie mit den
// Saison-Farben überschrieben. Jeder Spieler bekommt das Design automatisch
// (alle sind mindestens auf Level 1). Abschalten kann man es im Profil – das
// merkt sich der Browser (pro Gerät), deshalb ist kein SQL nötig.
// Schalter: lib/seasonDesign.ts (useSeasonDesign).

export const SEASON_DESIGN_STORAGE_KEY = "pooltipp_saison_design";

function rgbTriplet(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** CSS-Variablen, die das Saison-Design setzt. */
export function seasonDesignVars(design: SeasonDesign): Record<string, string> {
  const c = design.colors;
  return {
    "--c-pitch": rgbTriplet(c.pitch),
    "--c-surface": rgbTriplet(c.surface),
    "--c-surface-hover": rgbTriplet(c.surfaceHover),
    "--c-edge": rgbTriplet(c.edge),
    "--c-gold": rgbTriplet(c.gold),
    "--c-gold-dim": rgbTriplet(c.goldDim),
    "--c-action": rgbTriplet(c.action),
    "--c-action-hover": rgbTriplet(c.actionHover),
    "--c-ink": rgbTriplet(c.ink),
    "--c-muted": rgbTriplet(c.muted),
    "--c-ticker": rgbTriplet(c.ticker),
    "--bg-glow-a": design.glow[0],
    "--bg-glow-b": design.glow[1],
    "--season-hero-from": design.heroFrom,
    "--season-hero-to": design.heroTo,
  };
}

/**
 * Kleines Skript, das im <head> läuft, BEVOR die Seite gezeichnet wird – so
 * blitzt beim Laden nicht kurz das grüne Design auf. Es sucht die laufende
 * Saison nach derselben Regel wie lib/seasons/schedule.ts (spätester Start,
 * der heute in Österreich schon erreicht ist) und setzt deren Farben.
 */
export function seasonDesignBootScript(): string {
  const seasons = playableSeasons(SEASON_FILES).map((s) => ({
    id: s.theme.id,
    s: s.startsOn,
    v: s.design ? seasonDesignVars(s.design) : null,
  }));
  return `(function(){try{var S=${JSON.stringify(seasons)};var t=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Vienna"});var c=S[0];for(var i=0;i<S.length;i++){if(S[i].s<=t)c=S[i];}if(!c||!c.v)return;var off=false;try{off=localStorage.getItem(${JSON.stringify(
    SEASON_DESIGN_STORAGE_KEY
  )})==="aus";}catch(e){}if(off)return;var h=document.documentElement;for(var k in c.v)h.style.setProperty(k,c.v[k]);h.setAttribute("data-season-design",c.id);}catch(e){}})();`;
}
