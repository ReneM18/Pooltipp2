"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Tippannahme geschlossen";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `schließt in ${hours}h ${minutes}m`;
  if (minutes > 0) return `schließt in ${minutes}m ${seconds}s`;
  return `schließt in ${seconds}s`;
}

export default function Countdown({ kickoff }: { kickoff: string }) {
  const target = new Date(kickoff).getTime();

  // Startet bewusst bei "null" statt sofort mit Date.now() zu rechnen: Der
  // Server (baut die Seite) und der Browser (zeigt sie an) haben nie exakt
  // dieselbe Uhrzeit, dadurch würde der allererste Text unterschiedlich
  // ausfallen -> React-Hydration-Fehler. Mit "null" ist der erste Render auf
  // Server und Client garantiert identisch (leer), der echte Countdown
  // startet einen Moment später, rein im Browser.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(target - Date.now());
    const interval = setInterval(() => {
      setRemaining(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining === null) {
    // Platzhalter mit gleicher Höhe, damit sich beim Erscheinen des echten
    // Textes kurz danach nichts im Layout verschiebt.
    return <span className="inline-flex items-center gap-1 text-gold opacity-0">&nbsp;</span>;
  }

  const closed = remaining <= 0;
  const soon = !closed && remaining <= 30 * 60 * 1000; // letzte 30 Minuten

  return (
    <span className={`inline-flex items-center gap-1 ${closed ? "text-muted" : soon ? "text-[#FF9B5C]" : "text-gold"}`}>
      {soon && <span aria-hidden>⏰</span>}
      {formatRemaining(remaining)}
    </span>
  );
}
