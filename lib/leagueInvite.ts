// Einladungscode aus einem Tipprunden-Link (/teams?code=ABC123) kurz im
// Browser merken. So geht er nicht verloren, wenn man sich nach dem Klick
// auf den Link erst noch einloggen oder registrieren muss.
const KEY = "pooltipp_invite_code";

export function inviteLink(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/teams?code=${encodeURIComponent(code)}`;
}

export function readPendingInvite(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function savePendingInvite(code: string) {
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Speicher blockiert (z. B. privates Fenster) – dann eben ohne Merken.
  }
}

export function clearPendingInvite() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignorieren
  }
}
