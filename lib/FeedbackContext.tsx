"use client";

import { createContext, memo, useContext, useEffect, useLayoutEffect, useRef, useState, ReactNode } from "react";
import { useUser } from "@/lib/UserContext";
import { PASS_LEVELS } from "@/lib/passLevels";
import { takeFlashToast } from "@/lib/flashToast";
import { useAppData } from "@/lib/AppDataContext";
import { xpForLevel } from "@/lib/seasonPass";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "info" | "gold";
}

interface FeedbackContextValue {
  showToast: (message: string, variant?: Toast["variant"]) => void;
  // big = größerer, auffälligerer Sterne-Burst (siehe Saison-Pass Level 6
  // Premium: "Große goldene Sternenexplosion bei exaktem Tipp").
  celebrate: (big?: boolean) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

let idCounter = 0;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { passXP, profileLoaded, authUserId, hasPremiumPass } = useUser();
  const { myTips, myTipsLoaded } = useAppData();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bursts, setBursts] = useState<{ id: number; big: boolean }[]>([]);
  const [levelUpInfo, setLevelUpInfo] = useState<(typeof PASS_LEVELS)[number] | null>(null);
  const lastLevelRef = useRef<number | null>(null);

  function showToast(message: string, variant: Toast["variant"] = "success") {
    const id = ++idCounter;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2800);
  }

  // Mehrere Auslöser fast gleichzeitig (z. B. beim Öffnen mehrere frisch
  // ausgewertete Tipps): ein gemeinsamer Burst statt mehrerer übereinander –
  // das sah gleich aus, kostete aber das Mehrfache und ruckelte.
  const lastBurstRef = useRef<{ id: number; at: number } | null>(null);
  function celebrate(big = false) {
    const now = Date.now();
    const last = lastBurstRef.current;
    if (last && now - last.at < 1000) {
      if (big) setBursts((current) => current.map((b) => (b.id === last.id ? { ...b, big: true } : b)));
      return;
    }
    const id = ++idCounter;
    lastBurstRef.current = { id, at: now };
    setBursts((current) => [...current, { id, big }]);
    setTimeout(() => {
      setBursts((current) => current.filter((b) => b.id !== id));
    }, 1400);
  }

  useEffect(() => {
    const flash = takeFlashToast();
    if (flash) showToast(flash.message, flash.variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Level-Up-Erkennung: sobald "passXP" (Saison-Pass-XP, steigt nur durch den
  // täglichen Bonus) eine neue Stufe erreicht, ein Popup zeigen. Beim
  // allerersten Render wird nur der Startwert gemerkt, damit beim Laden der
  // Seite kein falsches Popup aufpoppt.
  // Beim Laden des echten Profils (oder Kontowechsel) springt passXP vom
  // Demo-Wert auf den gespeicherten Wert – das ist kein Level-Up. Daher hier
  // die Ausgangsbasis neu setzen (muss VOR dem Effekt darunter stehen).
  useEffect(() => {
    lastLevelRef.current = null;
  }, [profileLoaded, authUserId]);

  useEffect(() => {
    const currentLevel =
      [...PASS_LEVELS].reverse().find((l) => passXP >= l.xpRequired) ?? PASS_LEVELS[0];

    if (lastLevelRef.current === null) {
      lastLevelRef.current = currentLevel.level;
      return;
    }

    if (currentLevel.level > lastLevelRef.current) {
      lastLevelRef.current = currentLevel.level;
      setLevelUpInfo(currentLevel);
      celebrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passXP]);

  // Ergebnis-Jubel: Sterne + Meldung ("Exakt getroffen …") nur, wenn ein
  // eigener Tipp ausgewertet wird, WÄHREND die App offen ist – also wenn die
  // Auswertung gerade neu hereinkommt (Sofort-Abgleich, Aktualisieren). Was
  // beim Öffnen schon ausgewertet ist, ist nichts Neues mehr: kein Jubel.
  // Vorher kam er bei jedem Öffnen für jeden alten Tipp erneut.
  const tipStateRef = useRef<Map<string, boolean> | null>(null);
  useEffect(() => {
    tipStateRef.current = null;
  }, [authUserId]);
  useEffect(() => {
    if (!authUserId || !myTipsLoaded) return;
    const known = tipStateRef.current;
    const next = new Map(myTips.map((t) => [t.id, t.evaluated && !t.refunded] as [string, boolean]));
    tipStateRef.current = next;
    // Erster geladener Stand = Ausgangsbasis.
    if (!known) return;
    const fresh = myTips.filter((t) => t.evaluated && !t.refunded && known.get(t.id) === false);
    if (fresh.length === 0) return;
    // Level 6 Premium: "Große goldene Sternenexplosion bei exaktem Tipp" –
    // ansonsten der normale (kleinere) Sterne-Burst. Mehrere auf einmal
    // ergeben einen Burst (siehe celebrate).
    const big = hasPremiumPass && passXP >= xpForLevel(6) && fresh.some((t) => t.resultTier === "exakt");
    celebrate(big);
    for (const tip of fresh) {
      if (tip.narration) showToast(tip.narration, tip.resultTier === "falsch" ? "info" : "gold");
    }
    // Nur auf neue Tipp-Stände reagieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTips, myTipsLoaded, authUserId]);

  return (
    <FeedbackContext.Provider value={{ showToast, celebrate }}>
      {children}

      {/* Sterne-Burst statt Konfetti — passt zur "Sterne"-Währung der App */}
      {bursts.map((b) => (
        <StarBurst key={b.id} big={b.big} />
      ))}

      {/* Toast-Stack */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-toast-in rounded-full border px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur ${
              toast.variant === "gold"
                ? "border-gold bg-gold/15 text-gold"
                : toast.variant === "info"
                ? "border-edge bg-surface text-ink"
                : "border-action bg-action/15 text-action"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Level-Up Popup */}
      {levelUpInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-pitch/80 p-4 backdrop-blur-sm"
          onClick={() => setLevelUpInfo(null)}
        >
          <div
            className="w-full max-w-xs animate-levelup-in rounded-card border border-gold bg-gradient-to-br from-surface to-surface-hover p-6 text-center shadow-[0_0_40px_rgba(232,179,76,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Level Up!</p>
            <div className="my-3 text-5xl">{levelUpInfo.icon}</div>
            <p className="font-display text-xl font-bold text-ink">Level {levelUpInfo.level} erreicht</p>
            <p className="mt-1 text-sm font-semibold text-ink">{levelUpInfo.reward}</p>
            <p className="mt-1 text-xs text-muted">Zu sehen: {levelUpInfo.rewardWhere}</p>
            <button
              onClick={() => setLevelUpInfo(null)}
              className="mt-5 w-full rounded-full bg-gold py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
            >
              Nice!
            </button>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

// big = die "Große goldene Sternenexplosion" aus Level 6 des Premium-Passes:
// doppelt so viele Sterne, größer und mit mehr Schwung – sonst derselbe
// Effekt, kein eigener zweiter Mechanismus nötig.
//
// Flüssig auch beim Öffnen der App, während im Hintergrund noch geladen wird:
// - Flugbahnen werden einmal pro Burst ausgewürfelt (vorher bei JEDEM Neu-
//   Zeichnen der App neu, die Sterne sprangen und starteten immer wieder).
// - Die Bewegung läuft mit festen Werten über die Web Animations API, damit
//   der Browser sie auf der Grafikkarte abspielt, auch wenn er gerade
//   rechnet. Gleiche Bewegung wie der CSS-Keyframe "star-burst".
const StarBurst = memo(function StarBurst({ big = false }: { big?: boolean }) {
  const [stars] = useState(() => {
    const count = big ? 28 : 14;
    return Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i;
      const distance = (big ? 130 : 90) + Math.random() * (big ? 110 : 70);
      return {
        dx: Math.cos((angle * Math.PI) / 180) * distance,
        dy: Math.sin((angle * Math.PI) / 180) * distance,
        delay: Math.random() * 100,
        size: (big ? 18 : 14) + Math.random() * (big ? 16 : 12),
      };
    });
  });
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useLayoutEffect(() => {
    const animations = stars.map((star, i) =>
      refs.current[i]?.animate(
        [
          { transform: "translate(0px, 0px) scale(0.3) rotate(0deg)", opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.7 },
          { transform: `translate(${star.dx}px, ${star.dy}px) scale(1) rotate(180deg)`, opacity: 0, offset: 1 },
        ],
        { duration: 1100, delay: star.delay, easing: "ease-out", fill: "both" }
      )
    );
    return () => animations.forEach((a) => a?.cancel());
  }, [stars]);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {stars.map((star, i) => (
        <span
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute text-gold"
          style={{ fontSize: star.size, opacity: 0, willChange: "transform, opacity" }}
        >
          ⭐
        </span>
      ))}
    </div>
  );
});

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback muss innerhalb von <FeedbackProvider> verwendet werden");
  }
  return context;
}
