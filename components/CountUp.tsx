"use client";

import { useEffect, useRef, useState } from "react";

// Zahl, die bei Änderungen kurz hoch- bzw. runterzählt und dabei leicht
// aufhüpft (z. B. Coins oben in der Kopfzeile). Beim ersten Anzeigen und bei
// "Bewegung reduzieren" springt sie direkt auf den Wert.
export default function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState<"up" | "down" | null>(null);
  const fromRef = useRef(value);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    fromRef.current = value;
    if (from === value) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    setBump(value > from ? "up" : "down");
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const off = window.setTimeout(() => setBump(null), 900);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(off);
      setShown(value);
    };
  }, [value]);

  return (
    <span
      className={`inline-block tabular-nums ${bump === "up" ? "animate-count-up" : bump === "down" ? "animate-count-down" : ""} ${className}`}
    >
      {shown.toLocaleString("de-DE")}
    </span>
  );
}
