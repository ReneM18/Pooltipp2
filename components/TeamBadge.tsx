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
  const clipId = useId();
  const sleeveColor = style === "aermel" ? secondary : primary;

  return (
    <svg width={size} height={size} viewBox={VIEWBOX} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="12" y="9" width="20" height="29" rx="4" />
        </clipPath>
      </defs>

      {/* Ärmel */}
      <path
        d="M12,9 C6,9 2,13 2,19 L2,23 C2,25.2 4.2,26.4 6.2,25.4 L12,21.5 Z"
        fill={sleeveColor}
      />
      <path
        d="M32,9 C38,9 42,13 42,19 L42,23 C42,25.2 39.8,26.4 37.8,25.4 L32,21.5 Z"
        fill={sleeveColor}
      />

      {/* Torso */}
      <rect x="12" y="9" width="20" height="29" rx="4" fill={primary} />

      {/* Streifen-Variante */}
      {style === "streifen" && (
        <g clipPath={`url(#${clipId})`}>
          <rect x="15.5" y="9" width="3.6" height="29" fill={secondary} />
          <rect x="24.9" y="9" width="3.6" height="29" fill={secondary} />
        </g>
      )}

      {/* Kragen (Ring, unabhängig vom Hintergrund) */}
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
  return (
    <svg width={size} height={size} viewBox={VIEWBOX} aria-hidden="true">
      {/* Helmschale, Seitenprofil */}
      <path
        d="M4,24 C3,12 14,4 26,4 C34,4 40,9 41,17 C42,23 40,28 35,31 L34,37 C33,41 30,43 26,43 L15,43 C10,43 7,39 7,34 L7,28 C7,26 5,26 4,24 Z"
        fill={primary}
      />

      {/* Mittelstreifen */}
      <path
        d="M7,11 C14,5 22,3 31,6"
        stroke={secondary}
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Ohr-Öffnung */}
      <circle cx="14" cy="27" r="3.2" fill="none" stroke={secondary} strokeWidth="1.6" />

      {/* Gittermaske */}
      <g stroke={secondary} strokeWidth="2.1" fill="none" strokeLinecap="round">
        <path d="M38,16 C44,18 44,29 38,33" />
        <line x1="37" y1="20" x2="44" y2="19" />
        <line x1="37" y1="25" x2="44" y2="26" />
        <line x1="36" y1="30" x2="42" y2="31" />
      </g>
    </svg>
  );
}
