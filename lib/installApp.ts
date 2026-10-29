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

// Das Ereignis kann kommen, bevor dieses Modul geladen ist. Darum fängt ein
// kleines Skript im <head> es schon vorher auf (INSTALL_PROMPT_BOOT, in
// app/layout.tsx) und legt es auf window ab.
export const INSTALL_PROMPT_BOOT = `window.addEventListener("beforeinstallprompt",function(e){window.__pooltippInstallPrompt=e;});`;

if (typeof window !== "undefined") {
  const w = window as Window & { __pooltippInstallPrompt?: InstallPromptEvent };
  if (w.__pooltippInstallPrompt) deferredPrompt = w.__pooltippInstallPrompt;
  // Kein preventDefault: Chromes eigene Mini-Leiste darf weiter kommen,
  // wenn unser Hinweis gerade nicht zu sehen ist (erster Besuch, weggeklickt).
  window.addEventListener("beforeinstallprompt", (e) => {
    deferredPrompt = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
  // Am PC wandert der Tab beim Installieren direkt ins App-Fenster.
  window.matchMedia("(display-mode: standalone)").addEventListener?.("change", notify);
}

/** Läuft PoolTipp gerade als installierte App (ohne Browserleiste)? */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS meldet sich als Mac, hat aber einen Touchscreen.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

function detectPlatform(): InstallPlatform {
  if (isIOS()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "android";
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
    /** Gerade eben installiert, man ist aber noch im Browser. */
    installed: boolean;
    canPrompt: boolean;
    inAppBrowser: boolean;
  }>({ ready: false, platform: "desktop", standalone: false, installed: false, canPrompt: false, inAppBrowser: false });

  useEffect(() => {
    const update = () =>
      setState({
        ready: true,
        platform: detectPlatform(),
        standalone: isStandalone(),
        installed: installedNow,
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
    try {
      await p.prompt();
      const { outcome } = await p.userChoice;
      return outcome === "accepted";
    } catch {
      return false; // Browser lehnt ab: dann zeigen wir die Schritte.
    } finally {
      notify();
    }
  }

  return { ...state, promptInstall };
}
