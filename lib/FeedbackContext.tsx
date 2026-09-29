"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, CSSProperties } from "react";
import { useUser } from "@/lib/UserContext";
import { PASS_LEVELS } from "@/lib/passLevels";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "info" | "gold";
}

interface FeedbackContextValue {
  showToast: (message: string, variant?: Toast["variant"]) => void;
  celebrate: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

let idCounter = 0;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { passXP } = useUser();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bursts, setBursts] = useState<number[]>([]);
  const [levelUpInfo, setLevelUpInfo] = useState<(typeof PASS_LEVELS)[number] | null>(null);
  const lastLevelRef = useRef<number | null>(null);

  function showToast(message: string, variant: Toast["variant"] = "success") {
    const id = ++idCounter;
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 2800);
  }

  function celebrate() {
    const id = ++idCounter;
    setBursts((current) => [...current, id]);
    setTimeout(() => {
      setBursts((current) => current.filter((b) => b !== id));
    }, 1400);
  }

  // Level-Up-Erkennung: sobald "passXP" (Saison-Pass-XP, steigt nur durch den
  // täglichen Bonus) eine neue Stufe erreicht, ein Popup zeigen. Beim
  // allerersten Render wird nur der Startwert gemerkt, damit beim Laden der
  // Seite kein falsches Popup aufpoppt.
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

  return (
    <FeedbackContext.Provider value={{ showToast, celebrate }}>
      {children}

      {/* Sterne-Burst statt Konfetti — passt zur "Sterne"-Währung der App */}
      {bursts.map((id) => (
        <StarBurst key={id} />
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
            <p className="mt-1 text-sm text-muted">{levelUpInfo.reward}</p>
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

function StarBurst() {
  const stars = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {stars.map((i) => {
        const angle = (360 / stars.length) * i;
        const distance = 90 + Math.random() * 70;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        const delay = Math.random() * 0.1;
        const size = 14 + Math.random() * 12;
        return (
          <span
            key={i}
            className="absolute text-gold"
            style={
              {
                fontSize: size,
                animation: `star-burst 1.1s ease-out ${delay}s forwards`,
                "--dx": `${dx}px`,
                "--dy": `${dy}px`,
              } as CSSProperties
            }
          >
            ⭐
          </span>
        );
      })}
    </div>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback muss innerhalb von <FeedbackProvider> verwendet werden");
  }
  return context;
}
