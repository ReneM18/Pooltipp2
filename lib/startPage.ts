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
// Gäste bleiben immer bei den Tipps.

/** Schalter (Rene, 27.10.2026): Matchcenter ist Startseite und erster
 *  Menüpunkt, Tipps der zweite. Auf false stellen = alles wie vorher (Tipps
 *  zuerst und Startseite). Wer im Profil selbst eine Startseite gewählt hat,
 *  behält sie so oder so. */
export const MATCHCENTER_FIRST = true;

// Reihenfolge wie im Menü (Rene, 27.10.2026: Spiele zuerst, dann Tipps).
export const START_PAGES = [
  { href: "/matchcenter", label: "Spiele", icon: "⚽" },
  { href: "/", label: "Tipps", icon: "🎯" },
  { href: "/fortschritt", label: "Saison-Pass", icon: "🎟️" },
  { href: "/rangliste", label: "Rangliste", icon: "🏆" },
] as const;

export type StartPage = (typeof START_PAGES)[number]["href"];

/** Startseite für eingeloggte Spieler, die im Profil nichts gewählt haben. */
export const DEFAULT_START_PAGE: StartPage = MATCHCENTER_FIRST ? "/matchcenter" : "/";

export const START_PAGE_STORAGE_KEY = "pooltipp_startseite";

export function isStartPage(value: unknown): value is StartPage {
  return START_PAGES.some((p) => p.href === value);
}

// Der Browser merkt sich die Wahl zusammen mit dem Konto ("<user-id>|<seite>"),
// damit ein anderes Konto oder ein neuer Spieler auf demselben Gerät nie die
// Wahl eines anderen bekommt. Ohne Wahl gilt DEFAULT_START_PAGE; nur eine
// Wahl, die davon abweicht, wird gemerkt (auch "/" = Tipps).
export function readLocalStartPage(userId: string): StartPage {
  try {
    const [owner, value] = (localStorage.getItem(START_PAGE_STORAGE_KEY) ?? "").split("|");
    return owner === userId && isStartPage(value) ? value : DEFAULT_START_PAGE;
  } catch {
    return DEFAULT_START_PAGE;
  }
}

export function writeLocalStartPage(page: StartPage | null, userId: string | null) {
  try {
    if (page && userId && page !== DEFAULT_START_PAGE) localStorage.setItem(START_PAGE_STORAGE_KEY, `${userId}|${page}`);
    else localStorage.removeItem(START_PAGE_STORAGE_KEY);
  } catch {
    // nicht speicherbar: dann entscheidet beim Öffnen das Konto (kurz später)
  }
}

/** Läuft im <head> vor allem anderen (siehe app/layout.tsx). Nur für
 *  eingeloggte Spieler (Supabase speichert die Sitzung unter
 *  "sb-…-auth-token"): die gemerkte Wahl, wenn sie zu diesem Konto gehört,
 *  sonst DEFAULT_START_PAGE. Gäste bleiben bei den Tipps. Neue Spieler
 *  schickt die Zielseite weiter zum Start-Erlebnis (useStartExperience). */
export function startPageBootScript(): string {
  const allowed = START_PAGES.map((p) => p.href);
  return `(function(){try{var l=location;if(l.pathname!=="/"||l.search||l.hash)return;var u=null;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){var t=JSON.parse(localStorage.getItem(k)||"null");u=t&&t.user&&t.user.id;break;}}if(!u)return;var s=(localStorage.getItem(${JSON.stringify(
    START_PAGE_STORAGE_KEY
  )})||"").split("|");var p=s.length===2&&s[0]===u&&${JSON.stringify(allowed)}.indexOf(s[1])>=0?s[1]:${JSON.stringify(
    DEFAULT_START_PAGE
  )};if(p!=="/")l.replace(p);}catch(e){}})();`;
}
