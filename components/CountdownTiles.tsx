"use client";

import { useEffect, useState } from "react";

// Große Countdown-Kacheln (Tag/Std/Min/Sek) bis zum Tippschluss, für die
// Bühne des Top-Spiels. Erst im Browser gestartet (siehe Countdown.tsx),
// damit Server und Browser beim ersten Bild dasselbe zeigen.
export default function CountdownTiles({ target }: { target: string }) {
  const end = new Date(target).getTime();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [end]);

  const total = Math.floor((left ?? 0) / 1000);
  const parts: [number, string][] = [
    [Math.floor(total / 86400), total >= 2 * 86400 ? "Tage" : "Tag"],
    [Math.floor((total % 86400) / 3600), "Std"],
    [Math.floor((total % 3600) / 60), "Min"],
    [total % 60, "Sek"],
  ];
  // Unter einem Tag fällt die Tag-Kachel weg.
  const shown = parts[0][0] > 0 ? parts : parts.slice(1);

  return (
    <div
      className={`flex items-start gap-1.5 sm:gap-2 ${left === null ? "opacity-0" : ""}`}
      role="timer"
      aria-label="Zeit bis Tippschluss"
    >
      {shown.map(([value, label]) => (
        <div key={label} className="text-center">
          <div className="min-w-[2.75rem] rounded-[10px] border border-edge bg-pitch/75 px-1 py-1.5 font-display text-2xl font-bold leading-none tabular-nums text-ink">
            {String(value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
