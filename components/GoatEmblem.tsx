import { useId } from "react";
import { SPORT_EMOJI } from "@/lib/rankTiers";
import { Sport, SPORTS } from "@/lib/types";

// GOAT-Abzeichen (einzige Stufe über Meister): goldener Ziegenkopf in
// Seitenansicht auf einem goldenen Medaillon, unten rechts eine goldene
// Plakette mit dem Sportsymbol. Ein Glanz-Streifen wandert alle paar Sekunden
// darüber, ab mittlerer Größe funkeln kleine Sterne drumherum.
// "Unsterblich" (GOAT in allen Sportarten): dieselbe Ziege, um die die
// Sportsymbole langsam kreisen.
// Bei "Bewegung reduzieren" bleibt alles still (siehe .goat-fx in globals.css).

const CLIP = "M20 1.5 A18.5 18.5 0 1 1 19.99 1.5 Z";

// 4-zackiger Funkel-Stern um (cx, cy) mit Radius r.
function sparklePath(cx: number, cy: number, r: number) {
  const k = r * 0.28;
  return `M${cx} ${cy - r} L${cx + k} ${cy - k} L${cx + r} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + r} L${cx - k} ${cy + k} L${cx - r} ${cy} L${cx - k} ${cy - k} Z`;
}

const SPARKLES = [
  { x: 34.5, y: 6, r: 3.4, delay: "0s" },
  { x: 5, y: 31, r: 2.6, delay: "0.9s" },
  { x: 36, y: 30, r: 2, delay: "1.6s" },
];

function Sparkles() {
  return (
    <>
      {SPARKLES.map((s, i) => (
        <path
          key={i}
          className="goat-fx-sparkle"
          d={sparklePath(s.x, s.y, s.r)}
          fill="#FFFBEA"
          style={{ animationDelay: s.delay, transformOrigin: `${s.x}px ${s.y}px` }}
        />
      ))}
    </>
  );
}

// Medaillon mit Ziegenkopf und Glanz-Streifen im 40er-Raster.
function Medallion({ id, small, goatShift = 0 }: { id: string; small: boolean; goatShift?: number }) {
  const gold = `url(#${id}g)`;
  const stroke = "#5a3d05";
  const eye = "#1a1204";
  return (
    <>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF3B0" />
          <stop offset="0.45" stopColor="#FFD24A" />
          <stop offset="1" stopColor="#B07A12" />
        </linearGradient>
        <radialGradient id={`${id}bg`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#2a2410" />
          <stop offset="1" stopColor="#0b0a06" />
        </radialGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}clip`}>
          <path d={CLIP} />
        </clipPath>
      </defs>

      <circle cx="20" cy="20" r="18.5" fill={`url(#${id}bg)`} stroke={gold} strokeWidth="2.4" />
      {!small && (
        <circle cx="20" cy="20" r="15.6" fill="none" stroke="#FFD24A" strokeOpacity="0.35" strokeWidth="0.6" />
      )}

      <g clipPath={`url(#${id}clip)`}>
        <g
          transform={`translate(${21.5 + goatShift} 20.5) scale(0.9) translate(-20 -20)`}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* Horn: setzt oben am Kopf an und schwingt weit nach hinten über den Nacken */}
          <path
            d="M21.6 13 C20.4 8.4 16.6 5.2 12 5.6 C8.6 6 6.4 9 7 12.8 C7.6 16 9.6 18.6 11.4 20.2 C10.4 17.2 10.2 13.6 11.6 11.4 C13.2 9.2 16.4 9.6 17.8 14.4 Z"
            fill={gold}
            stroke={stroke}
            strokeWidth="1"
          />
          <path
            d="M10 8.2 L11.6 9.8 M13.4 6.6 L13.8 9.2 M16.6 7.4 L15.8 10 M8.2 12 L10.4 12.2"
            stroke={stroke}
            strokeWidth="0.7"
            fill="none"
          />
          {/* Kopf mit Schnauze und Bart */}
          <path
            d="M12 33 C12 26 12.5 20 15 16 C16.5 13.5 18.5 12 20.5 12 C23 12.5 26 16 29 19.5 C30.5 21 31.5 22.5 30.6 23.8 C29.6 25 27.5 25.2 25.5 25.4 L24.6 31.4 L22.4 26.2 C21 27.2 19.6 29.4 18.8 33 Z"
            fill={gold}
            stroke={stroke}
            strokeWidth="1"
          />
          {/* Ohr */}
          <path d="M15.6 17.2 L8.6 19.6 C9.8 21.2 12.8 21.2 15.6 19.8 Z" fill={gold} stroke={stroke} strokeWidth="1" />
          <path d="M21 16.4 L23.4 16.9" stroke={eye} strokeWidth="1.4" />
          <path d="M29.2 21.6 L29.8 22.2" stroke={eye} strokeWidth="0.9" />
          <path d="M26.6 24.4 C27.6 24.2 28.6 24 29.4 23.6" stroke={eye} strokeWidth="0.6" fill="none" />
        </g>
        {/* Glanz-Streifen */}
        <rect
          className="goat-fx-shine"
          x="-14"
          y="-10"
          width="9"
          height="60"
          fill={`url(#${id}s)`}
          transform="rotate(20 20 20)"
        />
      </g>
    </>
  );
}

// Goldene Plakette mit Sportsymbol.
function SportPlate({ sport, cx, cy, r }: { sport: Sport; cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#14110a" stroke="#FFD24A" strokeWidth={Math.min(1.8, r * 0.25)} />
      <text x={cx} y={cy + r * 0.38} textAnchor="middle" fontSize={r * 1.15}>
        {SPORT_EMOJI[sport]}
      </text>
    </g>
  );
}

export default function GoatEmblem({ size, sport }: { size: number; sport?: Sport }) {
  const id = useId();
  // Am Profilbild (klein) ohne Funkeln und ohne feine Innenlinie – wäre nur Unruhe.
  const small = size < 24;

  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="goat-fx shrink-0 overflow-visible">
      <Medallion id={id} small={small} goatShift={sport ? -1.5 : 0} />
      {!small && <Sparkles />}
      {sport && <SportPlate sport={sport} cx={31.5} cy={31.5} r={9} />}
    </svg>
  );
}

export function UnsterblichEmblem({ size }: { size: number }) {
  const id = useId();
  // Klein am Profilbild ohne kreisende Plaketten – dort wären sie nur Flecken.
  // Die Plaketten sitzen auf dem Ring, damit das Abzeichen nicht größer wird
  // als die anderen Rang-Icons.
  const small = size < 24;
  // Gleichmäßig auf dem Ring verteilt, eine Plakette pro Sportart (oben beginnend).
  const plates = SPORTS.map((_, i) => {
    const a = (i / SPORTS.length) * 2 * Math.PI - Math.PI / 2;
    return { x: 20 + 16.4 * Math.cos(a), y: 20 + 16.4 * Math.sin(a) };
  });

  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="goat-fx shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE680" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#B07A12" />
        </linearGradient>
      </defs>
      <circle
        className="goat-fx-spin"
        cx="20"
        cy="20"
        r="19.4"
        fill="none"
        stroke={`url(#${id}r)`}
        strokeWidth="1.6"
        strokeDasharray="3 2"
      />
      <g transform={`translate(20 20) scale(${small ? 0.9 : 0.74}) translate(-20 -20)`}>
        <Medallion id={id} small={small} />
      </g>
      {!small && (
        <g className="goat-fx-spin">
          {plates.map((p, i) => (
            // Gegenläufig gedreht, damit die Sportsymbole aufrecht bleiben.
            <g key={SPORTS[i]} className="goat-fx-spin-rev" style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
              <SportPlate sport={SPORTS[i]} cx={p.x} cy={p.y} r={4.6} />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
