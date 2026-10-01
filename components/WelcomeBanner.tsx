"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FitText from "@/components/FitText";
import { SEASON_THEME } from "@/lib/seasonTheme";

// Saison-Pass Level 1 (kostenlose Spur, siehe lib/passLevels.ts): der
// "Willkommens-Banner". Level 1 braucht 0 XP, also hat ihn jeder angemeldete
// Spieler sofort. Er steht oben im Profil, bis man Level 2 erreicht (siehe
// app/profil/page.tsx) oder ihn vorher mit dem X wegklickt.
// Das Wegklicken merkt sich nur der Browser (localStorage pro Nutzer-ID) –
// bewusst ohne Datenbank-Spalte, damit kein SQL nötig ist. Auf einem neuen
// Gerät erscheint er also einmal wieder, was für einen Gruß unkritisch ist.
const storageKey = (userId: string) => `pooltipp-welcome-banner-dismissed:${userId}`;

export default function WelcomeBanner({ userId, name }: { userId: string; name: string }) {
  // Erst nach dem Laden im Browser anzeigen (localStorage gibt's beim
  // Server-Rendern nicht) – sonst blitzt ein schon weggeklickter Banner kurz auf.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(storageKey(userId)) === "1";
    } catch {
      // localStorage gesperrt (z. B. privater Modus): Banner einfach zeigen.
    }
    setVisible(!dismissed);
  }, [userId]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      // nicht speicherbar: dann kommt er beim nächsten Besuch eben wieder.
    }
  }

  if (!visible) return null;

  return (
    <section
      className="relative mb-6 rounded-card p-4 pr-11 sm:p-5 sm:pr-12"
      style={{
        background: `linear-gradient(135deg, ${SEASON_THEME.colorFrom}33, ${SEASON_THEME.colorTo}33)`,
        border: `1px solid ${SEASON_THEME.colorFrom}66`,
      }}
      aria-label="Willkommens-Banner"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Willkommens-Banner ausblenden"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted transition-colors hover:bg-pitch/60 hover:text-ink"
      >
        ×
      </button>
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
          🎉
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gold">
            Saison-Pass · Level 1
          </p>
          <h2 className="font-display text-lg font-bold leading-snug text-ink sm:text-xl">
            Willkommen bei PoolTipp,
            <FitText text={`${name}!`} className="text-gold" minPx={12} />
          </h2>
          <p className="mt-1 text-sm text-muted">
            Schön, dass du dabei bist! Tipp deine ersten Spiele, sammle Punkte und schalte im{" "}
            <span className="whitespace-nowrap">Saison-Pass</span> Level für Level neue Belohnungen frei.
          </p>
          <Link
            href="/fortschritt"
            className="mt-3 inline-block text-sm font-semibold text-gold hover:underline"
          >
            Zum Saison-Pass →
          </Link>
        </div>
      </div>
    </section>
  );
}
