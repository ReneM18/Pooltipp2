"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  // Kurz gehalten, damit daneben am Handy der Wettbewerb (z. B. "Bundesliga")
  // noch ganz lesbar bleibt.
  if (ms <= 0) return "Tipps geschlossen";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Ab einem Tag in Tagen statt "172h", damit es lesbar bleibt.
  if (hours >= 24) return `noch ${Math.floor(hours / 24)} Tg. ${hours % 24} Std.`;
  if (hours > 0) return `noch ${hours} Std. ${minutes} Min.`;
  if (minutes > 0) return `noch ${minutes} Min. ${seconds} Sek.`;
  return `noch ${seconds} Sek.`;
}

// remind: noch nicht getippt. Dann leuchtet der Countdown in den letzten
// 2 Stunden vor Tippschluss, damit man das Tippen nicht vergisst.
export default function Countdown({ kickoff, remind = false }: { kickoff: string; remind?: boolean }) {
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

  const glowing = remind && !closed && remaining <= 2 * 60 * 60 * 1000;

  if (glowing) {
    return (
      <span className="animate-tip-reminder inline-flex items-center gap-1 rounded-full border border-[#FF9B5C]/70 bg-[#FF9B5C]/15 px-2 py-0.5 font-semibold text-[#FF9B5C]">
        <span aria-hidden>⏰</span>
        {formatRemaining(remaining)}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${closed ? "text-muted" : soon ? "text-[#FF9B5C]" : "text-gold"}`}>
      {soon && <span aria-hidden>⏰</span>}
      {formatRemaining(remaining)}
    </span>
  );
}
