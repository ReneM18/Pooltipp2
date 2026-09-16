import { useId } from "react";
import { JerseyStyle, Sport } from "@/lib/types";

interface TeamBadgeProps {
  sport: Sport;
  primaryColor: string;
  secondaryColor: string;
  jerseyStyle?: JerseyStyle;
  size?: number;
}

// Beide Icons nutzen dieselbe viewBox, damit sie bei gleichem "size" auch
// wirklich gleich groß wirken (gleiche Bounding-Box, gleiches Gewicht).
const VIEWBOX = "0 0 44 44";

// Hellt (percent > 0) oder verdunkelt (percent < 0) eine Hex-Farbe, für einen
// glänzenden 3D-Farbverlauf ausgehend von der frei gewählten Team-Farbe.
function shadeColor(hex: string, percent: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  let r = parseInt(clean.substring(0, 2), 16);
  let g = parseInt(clean.substring(2, 4), 16);
  let b = parseInt(clean.substring(4, 6), 16);
  r = Math.min(255, Math.max(0, Math.round((r * (100 + percent)) / 100)));
  g = Math.min(255, Math.max(0, Math.round((g * (100 + percent)) / 100)));
  b = Math.min(255, Math.max(0, Math.round((b * (100 + percent)) / 100)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
    .toString(16)
    .padStart(2, "0")}`;
}

export default function TeamBadge({
  sport,
  primaryColor,
  secondaryColor,
  jerseyStyle = "solid",
  size = 36,
}: TeamBadgeProps) {
  if (sport === "NFL") {
    return <HelmetIcon primary={primaryColor} secondary={secondaryColor} size={size} />;
  }
  return (
    <JerseyIcon
      primary={primaryColor}
      secondary={secondaryColor}
      style={jerseyStyle}
      size={size}
    />
  );
}

function JerseyIcon({
  primary,
  secondary,
  style,
  size,
}: {
  primary: string;
  secondary: string;
  style: JerseyStyle;
  size: number;
}) {
  const uid = useId();
  const clipId = `clip-${uid}`;
  const gradId = `jgrad-${uid}`;
  const sleeveColor = style === "aermel" ? secondary : primary;
  const light = shadeColor(primary, 25);
  const dark = shadeColor(primary, -20);

  return (
    <svg width={size} height={size} viewBox={VIEWBOX} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="12" y="9" width="20" height="29" rx="4" />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Ärmel */}
      <path
        d="M12,9 C6,9 2,13 2,19 L2,23 C2,25.2 4.2,26.4 6.2,25.4 L12,21.5 Z"
        fill={style === "aermel" ? secondary : `url(#${gradId})`}
      />
      <path
        d="M32,9 C38,9 42,13 42,19 L42,23 C42,25.2 39.8,26.4 37.8,25.4 L32,21.5 Z"
        fill={style === "aermel" ? secondary : `url(#${gradId})`}
      />

      {/* Torso */}
      <rect x="12" y="9" width="20" height="29" rx="4" fill={`url(#${gradId})`} />

      {/* Streifen-Variante */}
      {style === "streifen" && (
        <g clipPath={`url(#${clipId})`}>
          <rect x="15.5" y="9" width="3.6" height="29" fill={secondary} />
          <rect x="24.9" y="9" width="3.6" height="29" fill={secondary} />
        </g>
      )}

      {/* Kragen */}
      <circle cx="22" cy="9.5" r="4" fill="none" stroke={secondary} strokeWidth="2.4" />

      {/* Saum */}
      <rect x="12" y="33" width="20" height="4" rx="1.5" fill={secondary} />
    </svg>
  );
}

function HelmetIcon({
  primary,
  secondary,
  size,
}: {
  primary: string;
  secondary: string;
  size: number;
}) {
  const uid = useId();
  const gradId = `hgrad-${uid}`;
  const light = shadeColor(primary, 30);
  const dark = shadeColor(primary, -20);

  return (
    <svg width={size} height={size} viewBox={VIEWBOX} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Helmschale */}
      <path
        d="M4,24 C4,10 16,3 26,3 C36,3 42,10 42,20 C42,27 38,32 32,34 L31,38 C30,41 27,43 24,43 L14,43 C9,43 6,39 6,33 Z"
        fill={`url(#${gradId})`}
      />

      {/* Kinnpolster */}
      <path d="M30,32 L40,29 C41,33 38,38 33,39 L29,38 Z" fill={secondary} />

      {/* Gittermaske: kräftiger Rahmen mit zwei Querstreben, klar erkennbar auch klein */}
      <rect x="19" y="14" width="17" height="19" rx="8" fill="none" stroke={secondary} strokeWidth="2.8" />
      <line x1="19.5" y1="20.5" x2="35.5" y2="20.5" stroke={secondary} strokeWidth="2.6" strokeLinecap="round" />
      <line x1="19.5" y1="27" x2="35.5" y2="27" stroke={secondary} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
