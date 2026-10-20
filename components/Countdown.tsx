"use client";

import { useEffect, useState } from "react";
import { deadlineText } from "@/lib/dayGroups";

// Status rechts im Kartenkopf bis zum Anpfiff. Mischung aus Uhrzeit und
// Countdown (Rene, 20.10.2026: "der Countdown war doch cool"):
// - mehr als 3 Std.: "Tippen bis 15:30" bzw. "Tippen bis Sa. 15:30" (gold)
// - ab 3 Std.: laufender Countdown "noch 2 Std. 14 Min." (gold)
// - letzte 30 Min.: orange mit ⏰ und Sekunden "noch 4 Min. 12 Sek."
// - getippt: "✓ Getippt", darunter dasselbe (Uhrzeit oder Countdown)
// - Tippschluss vorbei: "🔒 Tippschluss vorbei"
// Live, Beendet und Abgesagt zeigt die Karte selbst (components/MatchCard.tsx).
const COUNTDOWN_FROM = 3 * 60 * 60 * 1000;
const SOON = 30 * 60 * 1000;

function remainingText(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `noch ${hours} Std. ${minutes} Min.`;
  if (minutes > 0) return `noch ${minutes} Min. ${seconds} Sek.`;
  return `noch ${seconds} Sek.`;
}

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

  const soon = remaining <= SOON;
  const counting = remaining <= COUNTDOWN_FROM;
  const color = soon ? "text-[#FF9B5C]" : "text-gold";
  const text = counting ? remainingText(remaining) : null;

  if (tipped) {
    // Zweizeilig, damit am Handy (375 px) und in der 3er-Reihe am PC der
    // Wettbewerb links daneben lesbar bleibt.
    return (
      <span className="inline-flex flex-col items-end leading-tight text-action">
        <span className="font-semibold">✓ Getippt</span>
        {changeable && (
          <span className={`whitespace-nowrap text-[11px] ${counting ? color : "text-action/80"}`}>
            {text ? `${soon ? "⏰ " : ""}änderbar, ${text}` : `änderbar bis ${deadlineText(target, now)}`}
          </span>
        )}
      </span>
    );
  }

  if (text) {
    return (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${color}`}>
        {soon && <span aria-hidden>⏰</span>}
        {text}
      </span>
    );
  }

  return <span className="text-gold">Tippen bis {deadlineText(target, now)}</span>;
}
