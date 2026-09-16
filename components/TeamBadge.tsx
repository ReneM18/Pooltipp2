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
  const dark = shadeColor(primary, -35);

  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true">
      {/* Helmschale */}
      <path
        d="m51.26 194.4808h32.8839l43.719 15.8978a19.0768 19.0768 0 0 0 12.4664.2378q.1352-.0444.27-.0892a19.19 19.19 0 0 0 11.29-26.154l-12.7753-28.1753-.8662-28.2195 77.5918-16.7007-6.2081-26.313-10.4544 2.1384a93.5591 93.5591 0 1 0 -147.9171 107.3777z"
        fill={primary}
      />
      {/* Gittermaske */}
      <path
        d="m233.1507 147.144-66.1789-4.9058-7.2641-29.1969 55.8042-12.24a5.636 5.636 0 0 0 -2.3619-11.0213l-91.8635 20.2889a5.6356 5.6356 0 0 0 -4.4531 5.3733l-1.1272 46.2135a5.636 5.636 0 0 0 4.1691 5.58l45.361 14.0334a39.5218 39.5218 0 0 0 13.5683 17.0329l34.33 28.81a5.6357 5.6357 0 0 0 8.6315-2.8674l13.7312-42.6912c.2236-.6959-2.3466-34.4094-2.3466-34.4094zm-10.3456 10.9171 1.2312 16.0043-49.9428-2.0976-3.4935-17.5zm-74.1215-42.0939 5.7595 22.3527-26.6381-10.446.1881-7.7146zm-21.1651 23.652 29.9892 11.4939 4.2 17.5328-34.6254-11.1433zm85.8745 73.8451-28.0556-24.3484a28.151 28.151 0 0 1 -5.9055-5.6692l43.0245 1.8394z"
        fill={secondary}
      />
      {/* Ohr-/Logo-Akzent */}
      <circle cx="79.731" cy="153.583" fill={secondary} r="25.486" />
      <circle cx="79.731" cy="153.583" fill={dark} r="11.718" />
    </svg>
  );
}
