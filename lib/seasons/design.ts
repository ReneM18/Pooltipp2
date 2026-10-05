import { SEASON_FILES } from "./index";
import { playableSeasons } from "./schedule";
import type { SeasonDesign } from "./types";

// ============================================================================
// Saison-Design: die ganze App bekommt die Farben der laufenden Saison.
// ============================================================================
// Die Farben stehen in der Saison-Datei (z. B. herbst2026.ts → design). Die
// App-Farben (tailwind.config.ts) sind CSS-Variablen; hier werden sie mit den
// Saison-Farben überschrieben. Ein Spieler bekommt das Design automatisch,
// sobald er im Saison-Pass das Level design.unlockLevel erreicht; Gäste und
// Spieler darunter sehen das normale Grün. Abschalten kann man es im Profil.
// Den Schalter speichert das Konto (profile_extras.season_design_off), er gilt
// also auf jedem Gerät; der Browser merkt ihn sich zusätzlich, damit das
// Skript unten schon vor dem ersten Zeichnen weiß, ob das Design an ist.
// Freischalten + Schalter: lib/seasonDesign.ts, components/SeasonDesignGate.tsx.

export const SEASON_DESIGN_STORAGE_KEY = "pooltipp_saison_design";
/** Saison-id, deren Design auf diesem Gerät freigeschaltet ist (Level
 *  erreicht). Setzt components/SeasonDesignGate.tsx nach dem Laden des
 *  Profils; das Skript unten liest es, damit das Design ab dem zweiten
 *  Seitenaufruf ohne grünes Aufblitzen erscheint. */
export const SEASON_DESIGN_UNLOCK_KEY = "pooltipp_saison_design_frei";
/** Wird ausgelöst, wenn sich der Schalter an/aus ändert (auch von einem
 *  anderen Gerät, siehe lib/UserContext.tsx). */
export const SEASON_DESIGN_OFF_EVENT = "pooltipp-saison-design-geaendert";

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
 * der heute in Österreich schon erreicht ist) und setzt deren Farben – aber
 * nur, wenn das Design dieser Saison auf diesem Gerät freigeschaltet ist.
 */
export function seasonDesignBootScript(): string {
  const seasons = playableSeasons(SEASON_FILES).map((s) => ({
    id: s.theme.id,
    s: s.startsOn,
    v: s.design ? seasonDesignVars(s.design) : null,
  }));
  return `(function(){try{var S=${JSON.stringify(seasons)};var t=new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Vienna"});var c=S[0];for(var i=0;i<S.length;i++){if(S[i].s<=t)c=S[i];}if(!c||!c.v)return;var off=true;try{off=localStorage.getItem(${JSON.stringify(
    SEASON_DESIGN_STORAGE_KEY
  )})==="aus"||localStorage.getItem(${JSON.stringify(SEASON_DESIGN_UNLOCK_KEY)})!==c.id;}catch(e){}if(off)return;var h=document.documentElement;for(var k in c.v)h.style.setProperty(k,c.v[k]);h.setAttribute("data-season-design",c.id);}catch(e){}})();`;
}
