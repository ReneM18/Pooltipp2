"use client";

import { useEffect, useState } from "react";
import type { Sport } from "./types";
import { liveClock, type LiveClock } from "./liveScores";

// Uhr, die genau zu jeder vollen Minute seit `since` neu rendert
// (Rene, 15.10.2026: Live-Gefühl). null = noch nicht im Browser oder kein
// Zeitpunkt (dann tickt nichts).
export function useMinuteTick(since: number | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!since) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const intoMinute = (n - since) % 60000;
      t = setTimeout(tick, 60000 - (intoMinute < 0 ? intoMinute + 60000 : intoMinute) + 50);
    };
    tick();
    return () => clearTimeout(t);
  }, [since]);
  return since ? now : null;
}

// Aktuelle Spielminute, clientseitig mitzählend (siehe liveClock).
export function useLiveClock(
  sport: Sport,
  statusShort: string,
  elapsed: number | null,
  dataAt: number,
): LiveClock | null {
  const now = useMinuteTick(dataAt || null);
  if (now === null) return null;
  return liveClock(sport, statusShort, elapsed, dataAt, now);
}
