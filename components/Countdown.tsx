"use client";

import { useEffect, useState } from "react";
import { deadlineText } from "@/lib/dayGroups";

// Status rechts im Kartenkopf bis zum Anpfiff (Rene, 18.10.2026:
// Tippen/Live/Beendet). Statt "noch X Std." steht da, bis wann getippt
// werden kann:
// - offen: "Tippen bis 15:30" bzw. "Tippen bis Sa. 15:30" (gold)
// - unter 60 Min.: gold hervorgehoben "⏰ noch 12 Min."
// - getippt: "✓ Getippt · änderbar bis 15:30" (grünlich)
// - Tippschluss vorbei: "🔒 Tippschluss vorbei"
// Live, Beendet und Abgesagt zeigt die Karte selbst (components/MatchCard.tsx).
export default function Countdown({
  deadline,
  tipped = false,
  changeable = true,
}: {
  deadline: string;
  tipped?: boolean;
  // Getippt, aber ohne "Ändern" (Seiten ohne Speicher-Logik): nur "✓ Getippt".
  changeable?: boolean;
}) {
  const target = new Date(deadline).getTime();

  // Startet bewusst bei "null" statt sofort mit Date.now() zu rechnen: Der
  // Server (baut die Seite) und der Browser (zeigt sie an) haben nie exakt
  // dieselbe Uhrzeit, dadurch würde der allererste Text unterschiedlich
  // ausfallen -> React-Hydration-Fehler. Mit "null" ist der erste Render auf
  // Server und Client garantiert identisch (leer), der echte Status
  // startet einen Moment später, rein im Browser.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (now === null) {
    // Platzhalter mit gleicher Höhe, damit sich beim Erscheinen des echten
    // Textes kurz danach nichts im Layout verschiebt.
    return <span className="inline-flex items-center gap-1 text-gold opacity-0">&nbsp;</span>;
  }

  const remaining = target - now;
  if (remaining <= 0) {
    return <span className="inline-flex items-center gap-1 text-muted">🔒 Tippschluss vorbei</span>;
  }

  const until = deadlineText(target, now);
  if (tipped) {
    // Zweizeilig, damit am Handy (375 px) und in der 3er-Reihe am PC der
    // Wettbewerb links daneben lesbar bleibt.
    return (
      <span className="inline-flex flex-col items-end leading-tight text-action">
        <span className="font-semibold">✓ Getippt</span>
        {changeable && <span className="text-[11px] text-action/80">änderbar bis {until}</span>}
      </span>
    );
  }

  if (remaining <= 60 * 60 * 1000) {
    const minutes = Math.floor(remaining / 60_000);
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-gold/15 px-2 py-0.5 font-semibold text-gold">
        <span aria-hidden>⏰</span>
        {minutes > 0 ? `noch ${minutes} Min.` : `noch ${Math.floor(remaining / 1000)} Sek.`}
      </span>
    );
  }

  return <span className="text-gold">Tippen bis {until}</span>;
}
