"use client";

import { useMemo } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { BEGINNER_SHIELD_TIPS } from "@/lib/poolScore";

// Anfänger-Schutz sichtbar machen: wie viele der ersten 10 gewerteten Tipps
// insgesamt (alle Sportarten zusammen) noch ohne Punktabzug sind
// (Rene, 15.10.2026). Gezählt wird wie in supabase/anfaenger-schutz.sql:
// alle gewerteten Tipps des Spielers (mit Ergebnis, nicht abgesagt), auch
// die von vor dem Anfänger-Schutz. Wer schon 10 oder mehr hat, sieht nichts.
export function useBeginnerShieldLeft(): number {
  const { myTips } = useAppData();
  return useMemo(() => {
    const scored = myTips.filter((tip) => tip.evaluated && tip.resultTier && !tip.refunded).length;
    return Math.max(0, BEGINNER_SHIELD_TIPS - scored);
  }, [myTips]);
}

// Kleiner Hinweis, verschwindet nach dem 10. gewerteten Tipp insgesamt
// (Rene, 15.10.2026).
// Nur für eingeloggte Spieler und erst, wenn ihre Tipps fertig geladen sind –
// sonst sahen Gäste "noch 10 von 10" und bei erfahrenen Spielern blitzte der
// Hinweis kurz auf, solange myTips noch leer war (Rene, 15.10.2026).
export default function BeginnerShieldHint({ className = "" }: { className?: string }) {
  const { authUserId } = useUser();
  const { myTipsLoaded } = useAppData();
  const left = useBeginnerShieldLeft();
  if (!authUserId || !myTipsLoaded || left === 0) return null;
  return (
    <div className={`text-xs text-muted ${className}`}>
      <p>
        🐣 Anfänger-Schutz aktiv: noch <span className="font-semibold text-ink">{left}</span> von{" "}
        {BEGINNER_SHIELD_TIPS} Tipps ohne Punktabzug
      </p>
    </div>
  );
}
