"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { applySeasonDesign, readSwitchedOff, rememberUnlocked, useDesignSource } from "@/lib/seasonDesign";
import { SEASON_DESIGN_OFF_EVENT } from "@/lib/seasons/design";
import { CURRENT_SEASON } from "@/lib/seasons";

// Schaltet das Saison-Design ein, sobald der Spieler das Level aus der
// Saison-Datei (design.unlockLevel) erreicht hat, und zeigt dann EINMAL einen
// Hinweis, dass man es im Profil ausschalten kann. Gäste und Spieler unter
// dem Level sehen das normale Grün. "Hinweis gesehen" merkt sich der Browser
// pro Spieler und Saison (wie beim Willkommens-Banner) – kein SQL nötig.
const noticeKey = (designId: string, userId: string) => `pooltipp-saison-design-hinweis:${designId}:${userId}`;

export default function SeasonDesignGate({ showNotice = true }: { showNotice?: boolean }) {
  const { authUserId } = useUser();
  const { state: unlock, source } = useDesignSource();
  const sourceId = source?.id ?? null;
  const [noticeVisible, setNoticeVisible] = useState(false);

  // Schalter an/aus auf einem anderen Gerät geändert: gleich übernehmen.
  useEffect(() => {
    if (unlock === "unknown") return;
    const onChange = () => applySeasonDesign(unlock === "unlocked" && !readSwitchedOff() ? source : null);
    window.addEventListener(SEASON_DESIGN_OFF_EVENT, onChange);
    return () => window.removeEventListener(SEASON_DESIGN_OFF_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock, sourceId]);

  useEffect(() => {
    if (unlock === "unknown") return;
    const unlocked = unlock === "unlocked";
    rememberUnlocked(unlocked ? sourceId : null);
    applySeasonDesign(unlocked && !readSwitchedOff() ? source : null);
    if (!unlocked || !authUserId || !sourceId) {
      setNoticeVisible(false);
      return;
    }
    let seen = false;
    try {
      seen = localStorage.getItem(noticeKey(sourceId, authUserId)) === "1";
    } catch {
      // localStorage gesperrt: Hinweis zeigen.
    }
    setNoticeVisible(!seen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlock, sourceId, authUserId]);

  function dismiss() {
    setNoticeVisible(false);
    if (!authUserId || !sourceId) return;
    try {
      localStorage.setItem(noticeKey(sourceId, authUserId), "1");
    } catch {
      // nicht speicherbar: dann kommt der Hinweis beim nächsten Besuch wieder.
    }
  }

  if (!showNotice || !noticeVisible || !source) return null;
  const isEvent = source.id !== CURRENT_SEASON.theme.id;

  return (
    <div className="mx-auto max-w-3xl px-5 pt-6 lg:max-w-6xl">
      <section
        className="relative rounded-card p-4 pr-11 sm:p-5 sm:pr-12"
        style={{
          background: `linear-gradient(135deg, ${source.colorFrom}33, ${source.colorTo}33)`,
          border: `1px solid ${source.colorFrom}66`,
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
            {source.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold leading-snug text-ink sm:text-xl">
              {isEvent ? `${source.name}-Design freigeschaltet!` : "Saison-Design freigeschaltet!"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isEvent
                ? `Du hast genug gesammelt: Die App zeigt jetzt das Design „${source.name}“, solange das Event läuft.`
                : `Du hast im Saison-Pass genug Punkte gesammelt: Die App zeigt jetzt das Design „${source.name}“.`}{" "}
              Gefällt es dir nicht, kannst du es im Profil im Reiter Einstellungen ausschalten.
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
