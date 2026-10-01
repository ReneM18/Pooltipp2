"use client";

import Link from "next/link";
import { useUser } from "@/lib/UserContext";

// Demo-Werbebanner: zeigt, wie sich eine echte In-App-Werbung (z. B. Google
// AdSense/AdMob) anfühlen würde. Kein echtes Werbenetzwerk angebunden –
// reiner Platzhalter. Werbefrei ist kein eigener Kauf mehr, sondern immer im
// Premium-Pass enthalten (siehe hasPremiumPass in lib/UserContext.tsx) –
// dieser Banner verlinkt daher nur noch dorthin, statt selbst zu verkaufen.
// Sobald hasAdFreeSubscription (= hasPremiumPass) aktiv ist, rendert diese
// Komponente gar nichts mehr.
export default function AdBanner() {
  const { hasAdFreeSubscription } = useUser();

  if (hasAdFreeSubscription) return null;

  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-edge bg-surface/60 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded bg-surface-hover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Anzeige
        </span>
        <p className="text-xs text-muted">
          Platzhalter für Werbung (z. B. Google AdSense/AdMob) – hier würde ein Werbepartner erscheinen.
        </p>
      </div>
      <Link
        href="/fortschritt"
        className="shrink-0 rounded-full border border-gold/50 px-3.5 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
      >
        Werbefrei im Premium-Pass →
      </Link>
    </div>
  );
}
