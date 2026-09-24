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
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(target - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  const closed = remaining <= 0;
  const soon = !closed && remaining <= 30 * 60 * 1000; // letzte 30 Minuten

  return (
    <span className={`inline-flex items-center gap-1 ${closed ? "text-muted" : soon ? "text-[#FF9B5C]" : "text-gold"}`}>
      {soon && <span aria-hidden>⏰</span>}
      {formatRemaining(remaining)}
    </span>
  );
}
