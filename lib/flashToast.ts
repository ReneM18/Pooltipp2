// Meldung, die erst nach dem Neuladen der Seite erscheinen soll (z. B.
// "Du bist ausgeloggt" – das Ausloggen lädt die Seite komplett neu).
// Angezeigt wird sie von lib/FeedbackContext.tsx.
export const FLASH_KEY = "pooltipp_flash_toast";

export type FlashVariant = "success" | "info" | "gold";

export function setFlashToast(message: string, variant: FlashVariant = "info") {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, variant }));
  } catch {
    // Ohne Speicher gibt es eben keine Meldung.
  }
}

export function takeFlashToast(): { message: string; variant: FlashVariant } | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
