// ============================================================================
// Startseite: welche Seite die App beim Öffnen zuerst zeigt.
// ============================================================================
// Einstellbar im Profil unter "Einstellungen". Das Konto speichert die Wahl
// (profile_extras.start_page, supabase/startseite.sql), sie gilt also auf
// jedem Gerät. Der Browser merkt sie sich zusätzlich, damit das Skript im
// <head> (startPageBootScript) schon vor dem ersten Zeichnen auf die gewählte
// Seite springt, ohne dass kurz die Tipps-Seite aufblitzt.
// Gilt beim Öffnen der App über die Hauptadresse ("/" ohne Zusatz) und beim
// Klick aufs Logo bzw. "Weiter/Zurück zu PoolTipp" (useStartHref). Der
// Menüpunkt "Tipps" und direkte Links (z. B. /?spiel=… vom Start-Erlebnis,
// "Zu den Spielen" oder Tipprunden-Einladungen) führen weiter zu den Tipps.

export const START_PAGES = [
  { href: "/", label: "Tipps", icon: "🎯" },
  { href: "/matchcenter", label: "Matchcenter", icon: "⚽" },
  { href: "/fortschritt", label: "Saison-Pass", icon: "🎟️" },
  { href: "/rangliste", label: "Rangliste", icon: "🏆" },
] as const;

export type StartPage = (typeof START_PAGES)[number]["href"];

export const DEFAULT_START_PAGE: StartPage = "/";

export const START_PAGE_STORAGE_KEY = "pooltipp_startseite";

export function isStartPage(value: unknown): value is StartPage {
  return START_PAGES.some((p) => p.href === value);
}

export function readLocalStartPage(): StartPage {
  try {
    const value = localStorage.getItem(START_PAGE_STORAGE_KEY);
    return isStartPage(value) ? value : DEFAULT_START_PAGE;
  } catch {
    return DEFAULT_START_PAGE;
  }
}

export function writeLocalStartPage(page: StartPage | null) {
  try {
    if (page && page !== DEFAULT_START_PAGE) localStorage.setItem(START_PAGE_STORAGE_KEY, page);
    else localStorage.removeItem(START_PAGE_STORAGE_KEY);
  } catch {
    // nicht speicherbar: dann entscheidet beim Öffnen das Konto (kurz später)
  }
}

/** Läuft im <head> vor allem anderen (siehe app/layout.tsx). */
export function startPageBootScript(): string {
  const allowed = START_PAGES.map((p) => p.href).filter((h) => h !== DEFAULT_START_PAGE);
  return `(function(){try{var l=location;if(l.pathname!=="/"||l.search||l.hash)return;var v=localStorage.getItem(${JSON.stringify(
    START_PAGE_STORAGE_KEY
  )});if(v&&${JSON.stringify(allowed)}.indexOf(v)>=0)l.replace(v);}catch(e){}})();`;
}
