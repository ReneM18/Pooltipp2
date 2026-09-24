"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "pooltipp_onboarding_v1";

const SLIDES = [
  {
    icon: "⚽",
    title: "Willkommen bei PoolTipp!",
    text: "Tippe kostenlos auf echte Spiele aus Fußball, NFL und NBA – mit Gratis-Sternen, kein Echtgeld nötig.",
  },
  {
    icon: "⭐",
    title: "Das Pool-Prinzip",
    text: "Alle verlorenen Sterne eines Spiels wandern in einen gemeinsamen Topf. Der wird dann an die besten Tipper verteilt – exakte Tipps bekommen am meisten.",
  },
  {
    icon: "👑",
    title: "Ränge & Saison-Pass",
    text: "Sammle Punkte, steig in den Sport-Rängen auf und schalte im Saison-Pass exklusive Belohnungen frei – sichtbar bei deinem Namen überall in der App.",
  },
  {
    icon: "🔵",
    title: "Private Tipprunden",
    text: "Gründe mit \"Private Tipprunden\" eine eigene Runde mit Freunden oder Kollegen und tretet gegeneinander an – mit Einladungs-Code zum Teilen.",
  },
];

export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch {
      // localStorage evtl. nicht verfügbar -> Tour einfach nicht anzeigen
    }
  }, []);

  function close() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignorieren
    }
  }

  if (!visible) return null;

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-pitch/85 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-6 text-center shadow-2xl">
        <div className="mb-4 flex justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-gold" : "w-1.5 bg-edge"
              }`}
            />
          ))}
        </div>

        <div className="mb-4 text-5xl">{slide.icon}</div>
        <h2 className="font-display text-xl font-bold text-ink">{slide.title}</h2>
        <p className="mt-2 text-sm text-muted">{slide.text}</p>

        <div className="mt-6 flex items-center gap-2">
          {!isLast && (
            <button
              onClick={close}
              className="flex-1 rounded-full border border-edge py-2.5 font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Überspringen
            </button>
          )}
          <button
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="flex-1 rounded-full bg-gold py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
          >
            {isLast ? "Los geht's!" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
