import { useId } from "react";
import GoatEmblem from "@/components/GoatEmblem";
import { RANK_COLORS, RankName, SPORT_EMOJI, SubTier } from "@/lib/rankTiers";
import { Sport } from "@/lib/types";

// Rang-Abzeichen: jeder Hauptrang hat eine eigene Form (nicht nur eine
// Farbe), damit man ihn auch klein auf einen Blick erkennt. Die Unterstufe
// zeigen 1–3 Winkel (III = 1, II = 2, I = 3 – mehr Winkel = höher), die
// Sportart steht als kleiner Punkt unten rechts.

const STAR =
  "M20 1 L24.2 9.9 L33.4 6.6 L30.1 15.8 L39 20 L30.1 24.2 L33.4 33.4 L24.2 30.1 L20 39 L15.8 30.1 L6.6 33.4 L9.9 24.2 L1 20 L9.9 15.8 L6.6 6.6 L15.8 9.9 Z";

const SHAPES: Record<Exclude<RankName, "GOAT">, string> = {
  // Bronze: runde Münze
  Bronze: "M20 3 A17 17 0 1 1 19.99 3 Z",
  // Silber: klassisches Wappen
  Silber: "M20 2 L35 7 V19 C35 28 28.5 34.5 20 38 C11.5 34.5 5 28 5 19 V7 Z",
  // Gold: Wappen mit drei Zacken oben
  Gold: "M5 4 L12.5 8 L20 2 L27.5 8 L35 4 V19 C35 28 28.5 34.5 20 38 C11.5 34.5 5 28 5 19 Z",
  // Platin: Sechseck
  Platin: "M20 2 L36 11 V29 L20 38 L4 29 V11 Z",
  // Diamant: geschliffener Edelstein
  Diamant: "M11 4 H29 L37 14 L20 38 L3 14 Z",
  // Meister: Stern mit acht Spitzen
  Meister: STAR,
};

const SUB_COUNT: Record<SubTier, number> = { III: 1, II: 2, I: 3 };

// Winkel mittig im Abzeichen, untereinander.
function chevrons(count: number) {
  const gap = 6;
  const start = 20 - ((count - 1) * gap) / 2 + 2;
  return Array.from({ length: count }, (_, i) => {
    const y = start + i * gap - 3;
    return `M13 ${y} L20 ${y - 5} L27 ${y}`;
  });
}

export default function RankEmblem({
  rank,
  sub,
  sport,
  elite,
  eliteIcon,
  colors,
  size,
}: {
  rank?: RankName;
  sub?: SubTier;
  sport?: Sport;
  /** Legende-Abzeichen (alle Sportarten mind. Gold): goldener Stern mit Symbol. */
  elite?: boolean;
  eliteIcon?: string;
  colors: { from: string; to: string; text: string };
  size: number;
}) {
  const gradientId = useId();
  const isGoat = !elite && rank === "GOAT";
  const shape = elite || !rank || rank === "GOAT" ? STAR : SHAPES[rank];
  const c = !elite && rank ? RANK_COLORS[rank] : colors;
  // Sportart-Punkt erst ab mittlerer Größe – am Profilbild in der Kopfzeile
  // wäre er nur ein unlesbarer Fleck.
  const showSport = !elite && sport && size >= 24;
  const sportSize = Math.max(11, Math.round(size * 0.42));

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {isGoat ? (
        <GoatEmblem size={size} />
      ) : (
        <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={c.to} />
              <stop offset="1" stopColor={c.from} />
            </linearGradient>
          </defs>
          <path d={shape} fill={`url(#${gradientId})`} stroke={c.from} strokeWidth="1.5" strokeLinejoin="round" />
          {/* Innenlinie für etwas Tiefe */}
          <path
            d={shape}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
            strokeLinejoin="round"
            transform="translate(20 20) scale(0.8) translate(-20 -20)"
          />
          {elite ? (
            <text x="20" y="25.5" textAnchor="middle" fontSize="15">
              {eliteIcon}
            </text>
          ) : (
            sub &&
            chevrons(SUB_COUNT[sub]).map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={c.text}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          )}
        </svg>
      )}
      {showSport && (
        <span
          className="absolute flex items-center justify-center rounded-full border border-edge bg-pitch leading-none"
          style={{
            width: sportSize,
            height: sportSize,
            fontSize: sportSize * 0.62,
            right: -sportSize * 0.25,
            bottom: -sportSize * 0.2,
          }}
        >
          {SPORT_EMOJI[sport]}
        </span>
      )}
    </span>
  );
}
