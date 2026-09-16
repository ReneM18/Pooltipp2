import { JerseyStyle, Sport } from "@/lib/types";
import { BASKETBALL_JERSEY_MARKUP } from "@/lib/basketballJerseyMarkup";

interface TeamBadgeProps {
  sport: Sport;
  primaryColor: string;
  secondaryColor: string;
  jerseyStyle?: JerseyStyle;
  size?: number;
  /** Spiegelt das Symbol horizontal – z. B. damit der Auswärts-Helm nach links schaut. */
  flip?: boolean;
}

// Hellt (percent > 0) oder verdunkelt (percent < 0) eine Hex-Farbe.
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
  size = 36,
  flip = false,
}: TeamBadgeProps) {
  if (sport === "NFL") {
    return <HelmetIcon primary={primaryColor} secondary={secondaryColor} size={size} flip={flip} />;
  }
  if (sport === "NBA") {
    return <BasketballJerseyIcon primary={primaryColor} secondary={secondaryColor} size={size} />;
  }
  return <JerseyIcon primary={primaryColor} secondary={secondaryColor} size={size} />;
}

function BasketballJerseyIcon({
  primary,
  secondary,
  size,
}: {
  primary: string;
  secondary: string;
  size: number;
}) {
  const markup = BASKETBALL_JERSEY_MARKUP.replace(/__PRIMARY__/g, primary).replace(
    /__SECONDARY__/g,
    secondary
  );

  return (
    <svg width={size} height={size} viewBox="130 103 100 154" aria-hidden="true">
      <g dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  );
}

function HelmetIcon({
  primary,
  secondary,
  size,
  flip,
}: {
  primary: string;
  secondary: string;
  size: number;
  flip: boolean;
}) {
  const dark = shadeColor(primary, -35);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
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

function JerseyIcon({
  primary,
  secondary,
  size,
}: {
  primary: string;
  secondary: string;
  size: number;
}) {
  const bodyShade = shadeColor(primary, -18);
  const trimShade = shadeColor(secondary, -18);
  const collarDark = shadeColor(secondary, -42);

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <g clipRule="evenodd" fillRule="evenodd">
        <path d="m186.499 23.969h139.168v49.457h-139.168z" fill={collarDark} />
        <path
          d="m488.544 139.885 20.757 20.758c3.526 3.526 3.671 7.77 0 11.438l-62.187 62.187c-3.641 3.642-7.569 3.872-11.439 0l-20.757-20.758 31.021-43.924z"
          fill={secondary}
        />
        <path
          d="m23.651 139.885-20.758 20.758c-3.843 3.84-3.871 7.597 0 11.438l62.157 62.187c4.014 4.013 7.798 3.642 11.469 0l20.729-20.758-31.537-41.688z"
          fill={secondary}
        />
        <path
          d="m378.334 450.587c-7.712-85.122-7.081-178.017 3.356-260.816.516-4.043 3.956-5.533 6.879-2.607l26.35 26.347 73.625-73.625-56.997-56.969c-13.847-13.878-31.223-20.213-48.769-20.213-86.384 0-166.978 0-253.361 0-17.547 0-34.922 6.335-48.797 20.213l-56.969 56.969 73.596 73.625 26.378-26.347c2.923-3.183 6.421-1.262 6.852 2.378 10.465 82.859 11.095 175.836 3.354 261.046l128.904 8.832z"
          fill={primary}
        />
        <path
          d="m378.334 450.587c-7.282-80.306-7.138-167.551 1.663-246.709.545-4.73 1.089-9.434 1.693-14.107.314-2.494 1.749-4.014 3.498-4.127h-24.743c-.403 0-3.498-.289-4.043 4.127-10.436 82.8-11.068 175.694-3.355 260.816zm97.568-298.06 12.642-12.643-56.997-56.969c-13.847-13.878-31.223-20.213-48.769-20.213h-25.23c17.517 0 34.865 6.364 48.712 20.213 23.223 23.195 46.418 46.417 69.642 69.612z"
          fill={bodyShade}
        />
        <path
          d="m133.831 450.587v29.331c0 4.471 3.642 8.113 8.115 8.113h228.303c4.445 0 8.085-3.642 8.085-8.113v-29.331z"
          fill={secondary}
        />
        <path
          d="m344.962 488.031h25.287c4.445 0 8.085-3.642 8.085-8.113v-29.331h-25.288v29.331c0 4.471-3.64 8.113-8.084 8.113z"
          fill={trimShade}
        />
        <path
          d="m488.544 139.885 20.757 20.758c3.526 3.526 3.671 7.77 0 11.438l-62.187 62.187c-3.641 3.642-7.569 3.872-11.439 0l-6.91-6.911 55.248-55.276c3.671-3.669 3.526-7.912 0-11.438l-8.112-8.115z"
          fill={trimShade}
        />
        <path
          d="m165.971 62.703 20.528-38.734 46.218 80.737-34.577 30.993c-3.614 3.212-7.083 2.208-8.602-2.294z"
          fill={secondary}
        />
        <path
          d="m174.341 46.906 12.158-22.938 46.218 80.737-34.577 30.993c-3.614 3.212-7.083 2.208-8.602-2.294l-3.24-9.777 15.941-14.279c3.555-3.21 3.901-6.879 1.061-11.84z"
          fill={trimShade}
        />
        <path
          d="m346.195 62.703-20.528-38.734-46.189 80.737 34.576 30.993c3.756 3.354 6.939 2.608 8.573-2.294z"
          fill={secondary}
        />
        <path
          d="m346.195 62.703-20.528-38.734-13.133 22.938 3.756 7.052c4.014 7.597 2.667 14.621.861 20.069l-16.544 49.601 13.446 12.071c3.756 3.354 6.939 2.608 8.573-2.294z"
          fill={trimShade}
        />
        <path d="m254.191 104.706h-21.474l10.723 16.714 7.999-6.794z" fill="#f9f7f8" />
        <path
          d="m260.469 134.292 19.009-29.586h-25.287l-10.751 16.714 8.286 12.872c2.808 4.388 5.876 4.445 8.743 0z"
          fill="#ebe8fa"
        />
        <path
          d="m336.39 196.021v43.379c0 14.564-10.981 20.182-25.689 27.122-4.875 2.007-9.748 2.036-14.624 0-14.706-6.939-25.687-12.557-25.687-27.122v-43.379c0-4.444 3.64-8.085 8.084-8.085h49.829c4.445 0 8.087 3.641 8.087 8.085z"
          fill={secondary}
        />
        <path
          d="m336.39 196.021v43.379c0 14.564-10.981 20.182-25.689 27.122-4.875 2.007-9.748 2.036-14.624 0-1.834-.859-3.611-1.721-5.331-2.552 11.956-5.935 20.355-11.811 20.355-24.57v-43.379c0-4.444-3.64-8.085-8.085-8.085h25.287c4.445 0 8.087 3.641 8.087 8.085z"
          fill={trimShade}
        />
      </g>
    </svg>
  );
}
