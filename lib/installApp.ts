"use client";

import { useEffect, useState } from "react";

// PoolTipp als App auf dem Handy (Rene, 29.10.2026): Wer PoolTipp auf den
// Home-Bildschirm legt, bekommt ein eigenes Symbol und die App öffnet ohne
// Browserleiste (app/manifest.ts: display "standalone").
// Android/Chrome (und Edge am PC) bieten dafür einen eigenen Dialog an: das
// Ereignis "beforeinstallprompt" kommt sehr früh, darum hört dieses Modul
// schon beim Laden zu und merkt es sich, bis jemand auf "Installieren" tippt.
// Das iPhone hat keinen solchen Dialog, dort zeigen wir die Schritte im
// Teilen-Menü (components/InstallAppSteps.tsx).

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallPlatform = "ios" | "android" | "desktop";

let deferredPrompt: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Chromes eigene Mini-Leiste unterdrücken, wir zeigen unseren Hinweis.
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

/** Läuft PoolTipp gerade als installierte App (ohne Browserleiste)? */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  // iPadOS meldet sich als Mac, hat aber einen Touchscreen.
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** Browser in Instagram, Facebook & Co. können nichts auf den Home-Bildschirm legen. */
function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat/i.test(navigator.userAgent);
}

export function useInstallApp() {
  const [state, setState] = useState<{
    ready: boolean;
    platform: InstallPlatform;
    standalone: boolean;
    canPrompt: boolean;
    inAppBrowser: boolean;
  }>({ ready: false, platform: "desktop", standalone: false, canPrompt: false, inAppBrowser: false });

  useEffect(() => {
    const update = () =>
      setState({
        ready: true,
        platform: detectPlatform(),
        standalone: isStandalone() || installedNow,
        canPrompt: deferredPrompt !== null,
        inAppBrowser: isInAppBrowser(),
      });
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  /** Öffnet den Installations-Dialog des Browsers; true, wenn installiert wird. */
  async function promptInstall() {
    const p = deferredPrompt;
    if (!p) return false;
    deferredPrompt = null; // jedes Ereignis darf nur einmal benutzt werden
    await p.prompt();
    const { outcome } = await p.userChoice;
    notify();
    return outcome === "accepted";
  }

  return { ...state, promptInstall };
}
