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

// Der Browser merkt sich die Wahl zusammen mit dem Konto ("<user-id>|<seite>"),
// damit ein anderes Konto oder ein neuer Spieler auf demselben Gerät nie die
// Wahl eines anderen bekommt. Ohne Wahl gilt immer Tipps.
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

/** Läuft im <head> vor allem anderen (siehe app/layout.tsx). Springt nur,
 *  wenn die gemerkte Wahl zum gerade eingeloggten Konto gehört (Supabase
 *  speichert die Sitzung unter "sb-…-auth-token"); Gäste und neue Spieler
 *  bleiben bei den Tipps. */
export function startPageBootScript(): string {
  const allowed = START_PAGES.map((p) => p.href).filter((h) => h !== DEFAULT_START_PAGE);
  return `(function(){try{var l=location;if(l.pathname!=="/"||l.search||l.hash)return;var s=(localStorage.getItem(${JSON.stringify(
    START_PAGE_STORAGE_KEY
  )})||"").split("|");if(s.length!==2||${JSON.stringify(allowed)}.indexOf(s[1])<0)return;var u=null;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){var t=JSON.parse(localStorage.getItem(k)||"null");u=t&&t.user&&t.user.id;break;}}if(u&&u===s[0])l.replace(s[1]);}catch(e){}})();`;
}
