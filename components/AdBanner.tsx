"use client";

import { useState } from "react";
import { useUser, AD_FREE_PRICE } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";

// Demo-Werbebanner: zeigt, wie sich eine echte In-App-Werbung (z. B. Google
// AdSense/AdMob) anfühlen würde, und wirbt direkt für das fiktive
// Werbefrei-Abo. Kein echtes Werbenetzwerk angebunden – reiner Platzhalter,
// damit der Unterschied mit/ohne Abo sofort sichtbar ist. Sobald das Abo
// aktiv ist, rendert diese Komponente gar nichts mehr.
export default function AdBanner() {
  const { hasAdFreeSubscription, buyAdFreeSubscription } = useUser();
  const { showToast, celebrate } = useFeedback();
  const [purchasing, setPurchasing] = useState(false);

  if (hasAdFreeSubscription) return null;

  function handleBuy() {
    setPurchasing(true);
    // Simulierte kurze Verarbeitung, wie beim Premium-Pass-Kauf im
    // "Fortschritt"-Bereich – Platzhalter für eine echte Zahlungsanbindung.
    setTimeout(() => {
      buyAdFreeSubscription();
      setPurchasing(false);
      celebrate();
      showToast("🚫📢 Werbefrei-Abo aktiv – keine Werbebanner mehr.", "gold");
    }, 600);
  }

  return (
    <div className="mb-5 flex flex-col items-start gap-3 rounded-card border border-dashed border-edge bg-surface/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Anzeige
        </span>
        <p className="text-xs text-muted">
          Platzhalter für Werbung (z. B. Google AdSense/AdMob) – hier würde ein Werbepartner erscheinen.
        </p>
      </div>
      <button
        onClick={handleBuy}
        disabled={purchasing}
        className="shrink-0 rounded-full border border-gold/50 px-3.5 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-60"
      >
        {purchasing ? "Wird verarbeitet…" : `Werbefrei für ${AD_FREE_PRICE}`}
      </button>
    </div>
  );
}
