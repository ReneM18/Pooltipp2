"use client";

import { useEffect, useState } from "react";
import { CURRENT_SEASON } from "@/lib/seasons";

// Deko-Blätter des Saison-Designs (Farben aus der Saison-Datei). Reine Optik:
// klickt nicht, liest kein Screenreader vor und liegt immer HINTER dem Inhalt.
// Sichtbar nur, solange das Saison-Design an ist (CSS: .season-deco in
// app/globals.css). Erst nach dem Laden im Browser zeichnen, damit die
// Saison vom heutigen Datum kommt und nicht vom Tag, an dem gebaut wurde.

function Leaf({ size, color, rotate }: { size: number; color: string; rotate: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M12 2C7 6 5 11 7 16c1.5 3 4 4.5 5 6 1-1.5 3.5-3 5-6 2-5 0-10-5-14Z" fill={color} />
      <path
        d="M12 5v16M12 11l-3-2M12 14l3-2.5M12 17l-2.5-1.5"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function useDecoColors(): string[] | null {
  const [colors, setColors] = useState<string[] | null>(null);
  useEffect(() => {
    setColors(CURRENT_SEASON.design?.decoColors ?? null);
  }, []);
  return colors;
}

// Blätter in der Kopfleiste: nur am oberen und unteren Rand (halb
// angeschnitten), damit sie nie hinter Logo, Sternen oder Profilbild stehen.
const HEADER_LEAVES = [
  { x: "3%", top: -7, r: -30, s: 20 },
  { x: "12%", bottom: -9, r: 80, s: 17 },
  { x: "21%", top: -8, r: 40, s: 15 },
  { x: "30%", bottom: -8, r: -15, s: 21 },
  { x: "38%", top: -9, r: 120, s: 18 },
  { x: "47%", bottom: -10, r: 160, s: 16 },
  { x: "55%", top: -8, r: -70, s: 14 },
  { x: "63%", bottom: -9, r: -45, s: 20 },
  { x: "70%", top: -9, r: 15, s: 19 },
  { x: "78%", bottom: -9, r: 95, s: 17 },
  { x: "86%", top: -8, r: -110, s: 16 },
  { x: "96%", top: -7, r: 60, s: 14 },
];

export default function SeasonDeco() {
  const colors = useDecoColors();
  if (!colors || colors.length === 0) return null;
  return (
    <div className="season-deco pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {HEADER_LEAVES.map((l, i) => (
        <span key={i} className="absolute opacity-80" style={{ left: l.x, top: l.top, bottom: l.bottom }}>
          <Leaf size={l.s} color={colors[i % colors.length]} rotate={l.r} />
        </span>
      ))}
    </div>
  );
}

/** Blätter-Gruppe oben rechts im Kopfbereich der Saison-Pass-Seite. */
export function SeasonHeroLeaves() {
  const colors = useDecoColors();
  if (!colors || colors.length === 0) return null;
  return (
    <div className="season-deco pointer-events-none absolute -right-1 -top-2 sm:right-2 sm:top-1" aria-hidden>
      {/* Am Handy kleiner und halb angeschnitten, damit sie nicht in den Text ragen. */}
      <div className="flex origin-top-right scale-[0.6] gap-1 opacity-80 sm:scale-100 sm:opacity-100">
        <Leaf size={44} color={colors[0]} rotate={-25} />
        <Leaf size={34} color={colors[1 % colors.length]} rotate={35} />
        <Leaf size={40} color={colors[2 % colors.length]} rotate={-80} />
      </div>
    </div>
  );
}

// Verblasste Blätter hinter der ganzen Seite (wie ein Wasserzeichen). Liegt
// fest hinter allem Inhalt; Karten, Knöpfe und Texte decken sie ab, sichtbar
// sind sie also nur in den Lücken und am Rand.
const BACKDROP_LEAVES = [
  { x: "4%", y: "18%", r: -25, s: 110 },
  { x: "82%", y: "12%", r: 35, s: 90 },
  { x: "60%", y: "38%", r: 120, s: 130 },
  { x: "14%", y: "52%", r: -80, s: 80 },
  { x: "88%", y: "60%", r: 15, s: 120 },
  { x: "36%", y: "72%", r: 160, s: 100 },
  { x: "6%", y: "86%", r: 60, s: 95 },
  { x: "70%", y: "88%", r: -40, s: 85 },
];

export function SeasonBackdrop() {
  const colors = useDecoColors();
  if (!colors || colors.length === 0) return null;
  return (
    <div className="season-deco pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {BACKDROP_LEAVES.map((l, i) => (
        <span key={i} className="absolute opacity-[0.08]" style={{ left: l.x, top: l.y }}>
          <Leaf size={l.s} color={colors[i % colors.length]} rotate={l.r} />
        </span>
      ))}
    </div>
  );
}

/** Ein großes, verblasstes Blatt unten rechts in einer Karte (z. B. Tipp-
 *  Karte). Die Karte braucht "relative isolate", dann liegt das Blatt hinter
 *  Teamnamen, Eingaben und Knöpfen. variant verdreht es pro Karte etwas. */
export function SeasonCardWatermark({ variant = 0 }: { variant?: number }) {
  const colors = useDecoColors();
  if (!colors || colors.length === 0) return null;
  const rotate = [-35, 20, -110, 65][variant % 4];
  return (
    <span
      className="season-deco pointer-events-none absolute -bottom-6 -right-6 -z-10 opacity-[0.07]"
      aria-hidden
    >
      <Leaf size={130} color={colors[variant % colors.length]} rotate={rotate} />
    </span>
  );
}
