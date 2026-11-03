// Startbild am Handy (Rene, 03.11.2026: "zuerst schwarzer Schirm mit dem
// PoolTipp-P, danach die Seite"). Die erste Seite meldet hier, dass ihr
// Inhalt steht; dann blendet components/SplashScreen.tsx das Startbild aus.
// Seiten, die nichts melden, gelten gleich nach dem Laden als fertig.

export const APP_READY_EVENT = "pooltipp:bereit";

declare global {
  interface Window {
    __pooltippReady?: boolean;
  }
}

export function signalAppReady() {
  if (typeof window === "undefined" || window.__pooltippReady) return;
  window.__pooltippReady = true;
  window.dispatchEvent(new Event(APP_READY_EVENT));
}

/** Seiten, die selbst melden, wann ihr Inhalt steht. */
export function waitsForReady(pathname: string | null): boolean {
  return pathname === "/" || pathname === "/matchcenter";
}
