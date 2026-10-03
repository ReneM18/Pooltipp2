"use client";

import { useEffect, useState } from "react";
import { HALLOWEEN_2026 as EV } from "@/lib/events/halloween2026";

// ENTWURF Halloween-Design: ab dem ersten Bonus-Tag im Event (Event-Level 1)
// bekommt die App Halloween-Hintergrund und -Akzente; nach dem Event
// (2.11.) automatisch wieder das Saison-Design. In der Vorschau kommen
// Datum und Bonus-Tage aus der Adresse (?tage=6&heute=2026-10-21).

// Farben: app/globals.css (html[data-event-design]).

function useEventDesignOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const today = q.get("heute") ?? "2026-10-21";
    const days = Number(q.get("tage") ?? 6);
    setOn(days >= 1 && today >= EV.startsOn && today <= EV.endsOn);
  }, []);
  return on;
}

export function EventDesignGate() {
  const on = useEventDesignOn();
  useEffect(() => {
    const h = document.documentElement;
    if (!on) return;
    h.setAttribute("data-event-design", EV.id);
  }, [on]);
  return null;
}

const ORANGE = "#F97316";
const PURPLE = "#8B5CF6";
const WHITE = "#E9E3F5";

export function Pumpkin({ size, color = ORANGE, rotate = 0 }: { size: number; color?: string; rotate?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M12 6c-1-2 0-3.5 1.5-4" stroke="#4D7C0F" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="7.5" cy="14" rx="5" ry="7" fill={color} />
      <ellipse cx="16.5" cy="14" rx="5" ry="7" fill={color} />
      <ellipse cx="12" cy="14" rx="5" ry="7.5" fill={color} />
      <path d="M8 12l2 2H6zM16 12l2 2h-4zM8 17c2 1.6 6 1.6 8 0l-1.3 1.8-1.4-.8-1.3 1-1.3-1-1.4.8z" fill="rgba(0,0,0,0.55)" />
    </svg>
  );
}

function Ghost({ size, color = WHITE, rotate = 0 }: { size: number; color?: string; rotate?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M12 2c-4.4 0-7 3.3-7 7.5V22l2.3-1.8L9.6 22l2.4-1.8 2.4 1.8 2.3-1.8L19 22V9.5C19 5.3 16.4 2 12 2Z" fill={color} />
      <circle cx="9.5" cy="10" r="1.3" fill="rgba(0,0,0,0.6)" />
      <circle cx="14.5" cy="10" r="1.3" fill="rgba(0,0,0,0.6)" />
      <ellipse cx="12" cy="14.2" rx="1.4" ry="1.8" fill="rgba(0,0,0,0.5)" />
    </svg>
  );
}

function Bat({ size, color = PURPLE, rotate = 0 }: { size: number; color?: string; rotate?: number }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 40 24" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path
        d="M20 8c1-2 1.2-3.5 1.2-3.5l1 2.5c2.5 0 3.5 1 3.5 1C29 4 34 3 39 6c-3 1-4 4-4 7-2-1.5-4-1.5-5.5 0-1-1.6-3-2.2-5-1.4-.8 2-2.3 3.4-4.5 4.4-2.2-1-3.7-2.4-4.5-4.4-2-.8-4-.2-5 1.4C9 11.5 7 11.5 5 13c0-3-1-6-4-7 5-3 10-2 13.3 2 0 0 1-1 3.5-1l1-2.5S18.9 6 20 8Z"
        fill={color}
      />
    </svg>
  );
}

const BACKDROP = [
  { k: "p", x: "4%", y: "16%", r: -12, s: 110 },
  { k: "g", x: "80%", y: "10%", r: 10, s: 95 },
  { k: "b", x: "58%", y: "34%", r: -8, s: 120 },
  { k: "g", x: "12%", y: "50%", r: -10, s: 80 },
  { k: "p", x: "86%", y: "58%", r: 14, s: 115 },
  { k: "b", x: "34%", y: "70%", r: 12, s: 100 },
  { k: "g", x: "5%", y: "84%", r: 8, s: 90 },
  { k: "p", x: "68%", y: "86%", r: -6, s: 90 },
];

function Shape({ k, s, r, color }: { k: string; s: number; r: number; color?: string }) {
  if (k === "p") return <Pumpkin size={s} rotate={r} color={color} />;
  if (k === "g") return <Ghost size={s} rotate={r} color={color} />;
  return <Bat size={s} rotate={r} color={color} />;
}

/** Verblasste Kürbisse, Geister und Fledermäuse hinter der ganzen Seite. */
export function EventBackdrop() {
  return (
    <div className="event-deco pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {BACKDROP.map((l, i) => (
        <span key={i} className="absolute opacity-[0.09]" style={{ left: l.x, top: l.y }}>
          <Shape k={l.k} s={l.s} r={l.r} />
        </span>
      ))}
    </div>
  );
}

const HEADER = [
  { k: "b", x: "4%", top: -6, r: -10, s: 22 },
  { k: "p", x: "14%", bottom: -9, r: 8, s: 17 },
  { k: "b", x: "24%", top: -7, r: 12, s: 18 },
  { k: "g", x: "33%", bottom: -9, r: -8, s: 17 },
  { k: "p", x: "42%", top: -8, r: -6, s: 16 },
  { k: "b", x: "51%", bottom: -6, r: 6, s: 20 },
  { k: "g", x: "60%", top: -8, r: 10, s: 15 },
  { k: "p", x: "68%", bottom: -9, r: 12, s: 18 },
  { k: "b", x: "76%", top: -6, r: -14, s: 19 },
  { k: "g", x: "85%", bottom: -9, r: -6, s: 16 },
  { k: "b", x: "95%", top: -6, r: 8, s: 17 },
];

/** Kleine Deko am oberen und unteren Rand der Kopfleiste (nie über Logo/Sternen). */
export function EventHeaderDeco() {
  return (
    <div className="event-deco pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {HEADER.map((l, i) => (
        <span key={i} className="absolute opacity-80" style={{ left: l.x, top: l.top, bottom: l.bottom }}>
          <Shape k={l.k} s={l.s} r={l.r} />
        </span>
      ))}
    </div>
  );
}

/** Verblasster Kürbis/Geist unten rechts in Tipp-Karten. */
export function EventCardWatermark({ variant = 0 }: { variant?: number }) {
  return (
    <span className="event-deco pointer-events-none absolute -bottom-5 -right-5 -z-10 opacity-[0.08]" aria-hidden>
      <Shape k={variant % 2 ? "g" : "p"} s={120} r={[-12, 10, -6, 14][variant % 4]} />
    </span>
  );
}
