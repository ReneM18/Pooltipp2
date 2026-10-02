// Die häufigsten Supabase-Meldungen auf Deutsch, damit niemand mit
// englischen Fachbegriffen allein gelassen wird. Genutzt von Login,
// "Passwort vergessen", "Neues Passwort" und den Konto-Einstellungen.
export const MIN_PASSWORD_LENGTH = 6;

export function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-Mail oder Passwort stimmt nicht. Bitte nochmal versuchen.";
  if (/password should be at least/i.test(message)) return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`;
  if (/should be different from the old/i.test(message)) return "Das neue Passwort ist dasselbe wie das alte. Bitte wähle ein anderes.";
  if (/weak|pwned|known to be/i.test(message)) return "Dieses Passwort ist zu leicht zu erraten. Bitte wähle ein anderes.";
  if (/session.*missing|session.*not found|jwt.*expired|refresh token/i.test(message))
    return "Deine Anmeldung ist abgelaufen. Bitte fordere einen neuen Link an oder logge dich neu ein.";
  if (/invalid.*email|email.*invalid/i.test(message)) return "Diese E-Mail-Adresse sieht nicht richtig aus.";
  if (/rate limit|too many|security purposes/i.test(message)) return "Zu viele Versuche. Bitte warte kurz und probier es dann nochmal.";
  if (/failed to fetch|network/i.test(message)) return "Keine Verbindung. Bitte prüfe dein Internet und probier es nochmal.";
  return `Das hat nicht geklappt: ${message}`;
}
