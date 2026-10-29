"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import InstallAppSteps from "./InstallAppSteps";
import { useInstallApp } from "@/lib/installApp";

// Hinweis "PoolTipp als App" am Handy (Rene, 29.10.2026): eine schmale Karte
// über der Leiste unten. Android mit Chrome bekommt "Installieren" (der
// Dialog des Browsers), das iPhone und andere Browser "So geht's" mit den
// Schritten. Nur am Handy, nie in der App selbst und erst ab dem zweiten
// Besuch, damit Neue zuerst in Ruhe ankommen. Das X blendet ihn für 30 Tage
// aus; dauerhaft zu finden ist er unter Profil → Einstellungen → App.
// Gemerkt wird nur im Browser (localStorage), ohne Datenbank.
// Zum Ausprobieren: ?app-hinweis=1 an die Adresse hängen.

const VISITS_KEY = "pooltipp-visits";
const HIDDEN_KEY = "pooltipp-install-hint-hidden-until";
const HIDE_DAYS = 30;
const MIN_VISITS = 2;
// Hier stört der Hinweis: Anmelden, Start-Erlebnis, neues Passwort, Admin.
const SKIP_PATHS = ["/registrieren", "/start", "/passwort-neu", "/admin"];

function countVisit() {
  try {
    if (!sessionStorage.getItem(VISITS_KEY)) {
      sessionStorage.setItem(VISITS_KEY, "1");
      localStorage.setItem(VISITS_KEY, String(Number(localStorage.getItem(VISITS_KEY) ?? 0) + 1));
    }
    return Number(localStorage.getItem(VISITS_KEY) ?? 0);
  } catch {
    return 0; // Speicher gesperrt: lieber nicht nerven.
  }
}

function hiddenNow() {
  try {
    return Number(localStorage.getItem(HIDDEN_KEY) ?? 0) > Date.now();
  } catch {
    return true;
  }
}

export default function InstallHint() {
  const pathname = usePathname() ?? "";
  const { ready, platform, standalone, canPrompt, inAppBrowser, promptInstall } = useInstallApp();
  const [eligible, setEligible] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    const visits = countVisit();
    const forced = new URLSearchParams(window.location.search).get("app-hinweis") === "1";
    setEligible(forced || (visits >= MIN_VISITS && !hiddenNow()));
  }, []);

  function hide() {
    setEligible(false);
    setStepsOpen(false);
    try {
      localStorage.setItem(HIDDEN_KEY, String(Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // nicht speicherbar: dann kommt er beim nächsten Besuch eben wieder.
    }
  }

  async function install() {
    if (canPrompt) {
      if (await promptInstall()) setEligible(false);
      return;
    }
    setStepsOpen(true);
  }

  const show =
    ready &&
    eligible &&
    !standalone &&
    !inAppBrowser &&
    (platform === "ios" || platform === "android") &&
    !SKIP_PATHS.some((p) => pathname.startsWith(p));
  if (!show) return null;

  return (
    <>
      <div
        role="region"
        aria-label="PoolTipp als App"
        className="fixed inset-x-3 bottom-[calc(4.5rem+var(--safe-bottom))] z-[44] mx-auto max-w-md animate-[sheetUp_0.25s_ease-out] rounded-card border border-gold/50 bg-surface p-3 shadow-[0_12px_32px_rgb(0_0_0/0.55)] lg:hidden"
      >
        <div className="flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-ink">PoolTipp als App</p>
            <p className="text-xs leading-snug text-muted">Öffnet ohne Browserleiste.</p>
          </div>
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-gold px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
          >
            {canPrompt ? "Installieren" : "So geht's"}
          </button>
          <button
            type="button"
            onClick={hide}
            aria-label="Hinweis ausblenden"
            className="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-muted transition-colors hover:bg-pitch/60 hover:text-ink"
          >
            ×
          </button>
        </div>
      </div>

      {stepsOpen && (
        <div
          className="fixed inset-0 z-[50] flex items-end bg-pitch/70 backdrop-blur-[2px] lg:hidden"
          onClick={() => setStepsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="PoolTipp auf den Home-Bildschirm"
            onClick={(e) => e.stopPropagation()}
            className="w-full animate-[sheetUp_0.2s_ease-out] rounded-t-2xl border-t border-edge bg-surface px-5 pb-[calc(1.25rem+var(--safe-bottom))] pt-3"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge" />
            <div className="mb-4 flex items-center gap-3">
              <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
              <p className="font-display text-base font-semibold text-ink">PoolTipp auf den Home-Bildschirm</p>
            </div>
            <InstallAppSteps platform={platform} />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={hide}
                className="flex-1 rounded-full border border-edge px-4 py-3 font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Nicht jetzt
              </button>
              <button
                type="button"
                onClick={() => setStepsOpen(false)}
                className="flex-1 rounded-full bg-gold px-4 py-3 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
