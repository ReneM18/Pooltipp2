"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { SEASON_THEME } from "@/lib/seasonTheme";
import { applySeasonDesign, readSwitchedOff, rememberUnlocked, useSeasonDesignUnlock } from "@/lib/seasonDesign";

// Schaltet das Saison-Design ein, sobald der Spieler das Level aus der
// Saison-Datei (design.unlockLevel) erreicht hat, und zeigt dann EINMAL einen
// Hinweis, dass man es im Profil ausschalten kann. Gäste und Spieler unter
// dem Level sehen das normale Grün. "Hinweis gesehen" merkt sich der Browser
// pro Spieler und Saison (wie beim Willkommens-Banner) – kein SQL nötig.
const noticeKey = (userId: string) => `pooltipp-saison-design-hinweis:${SEASON_THEME.id}:${userId}`;

export default function SeasonDesignGate({ showNotice = true }: { showNotice?: boolean }) {
  const { authUserId } = useUser();
  const unlock = useSeasonDesignUnlock();
  const [noticeVisible, setNoticeVisible] = useState(false);

  useEffect(() => {
    if (unlock === "unknown") return;
    const unlocked = unlock === "unlocked";
    rememberUnlocked(unlocked);
    applySeasonDesign(unlocked && !readSwitchedOff());
    if (!unlocked || !authUserId) {
      setNoticeVisible(false);
      return;
    }
    let seen = false;
    try {
      seen = localStorage.getItem(noticeKey(authUserId)) === "1";
    } catch {
      // localStorage gesperrt: Hinweis zeigen.
    }
    setNoticeVisible(!seen);
  }, [unlock, authUserId]);

  function dismiss() {
    setNoticeVisible(false);
    if (!authUserId) return;
    try {
      localStorage.setItem(noticeKey(authUserId), "1");
    } catch {
      // nicht speicherbar: dann kommt der Hinweis beim nächsten Besuch wieder.
    }
  }

  if (!showNotice || !noticeVisible) return null;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 lg:max-w-6xl">
      <section
        className="relative rounded-card p-4 pr-11 sm:p-5 sm:pr-12"
        style={{
          background: `linear-gradient(135deg, ${SEASON_THEME.colorFrom}33, ${SEASON_THEME.colorTo}33)`,
          border: `1px solid ${SEASON_THEME.colorFrom}66`,
        }}
        aria-label="Saison-Design freigeschaltet"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hinweis ausblenden"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted transition-colors hover:bg-pitch/60 hover:text-ink"
        >
          ×
        </button>
        <div className="flex items-start gap-3 sm:gap-4">
          <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
            {SEASON_THEME.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold leading-snug text-ink sm:text-xl">
              Saison-Design freigeschaltet!
            </h2>
            <p className="mt-1 text-sm text-muted">
              Du hast im Saison-Pass genug Punkte gesammelt: Die App zeigt jetzt das Design „
              {SEASON_THEME.name}“. Gefällt es dir nicht, kannst du es im Profil unter Einstellungen
              ausschalten.
            </p>
            <Link
              href="/profil#einstellungen"
              onClick={dismiss}
              className="mt-3 inline-block text-sm font-semibold text-gold hover:underline"
            >
              Zu den Einstellungen →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
