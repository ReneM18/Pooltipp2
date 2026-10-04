import { useId } from "react";
import { JerseyStyle, JerseyVariant, Match, MatchJersey, Sport, Team } from "@/lib/types";
import { BASKETBALL_JERSEY_MARKUP } from "@/lib/basketballJerseyMarkup";
import { flagEmoji } from "@/lib/flags";

/** Trikot eines Teams in einem Spiel: die Wahl des Admins oder sonst Heim/Auswärts im Team-Stil. */
export function jerseyFor(team: Team, side: "home" | "away", chosen?: MatchJersey): MatchJersey {
  return chosen ?? { variant: side === "home" ? "heim" : "auswaerts", style: team.jerseyStyle ?? "solid" };
}

/** TeamBadge-Props für ein Team in einem Spiel: <TeamBadge {...matchJerseyProps(match, team)} ... />. */
export function matchJerseyProps(match: Match, team: Team): { jerseyStyle: JerseyStyle; variant: JerseyVariant } {
  const j =
    team.id === match.homeTeamId
      ? jerseyFor(team, "home", match.homeJersey)
      : jerseyFor(team, "away", match.awayJersey);
  return { jerseyStyle: j.style, variant: j.variant };
}

interface TeamBadgeProps {
  sport: Sport;
  primaryColor: string;
  secondaryColor: string;
  jerseyStyle?: JerseyStyle;
  /** Heim- oder Auswärtstrikot; ohne Angabe immer das Heimtrikot. */
  variant?: JerseyVariant;
  size?: number;
  /** Nationalmannschaft -> zeigt die Landesflagge statt Trikot. */
  isNationalTeam?: boolean;
  /** Nur nötig, wenn isNationalTeam gesetzt ist. */
  countryCode?: string;
}

function NationalFlagBadge({ countryCode, size }: { countryCode: string; size: number }) {
  return (
    <span
      role="img"
      aria-label={`Flagge ${countryCode}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.8) }}
      className="flex shrink-0 items-center justify-center leading-none"
    >
      {flagEmoji(countryCode)}
    </span>
  );
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

// Wahrgenommene Helligkeit 0 (schwarz) bis 1 (weiß).
function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const AWAY_WHITE = "#F4F3EF";
const CREAM = "#F3F1EA";

/** body = Grundfarbe, trim = Kragen/Streifen/Ärmel, accent = dritte Farbe (z. B. Eishockey-Streifen). */
interface JerseyColors {
  body: string;
  trim: string;
  accent: string;
  /** Sehr dunkles Trikot -> heller Rand, damit es auf dem dunklen Hintergrund sichtbar bleibt. */
  outline: string | null;
}

function jerseyColors(
  primary: string,
  secondary: string,
  variant: JerseyVariant,
  style: JerseyStyle
): JerseyColors {
  let body = primary;
  let trim = secondary;
  let accent = CREAM;
  if (variant === "auswaerts") {
    if (luminance(primary) > 0.68) {
      // Helle Vereinsfarbe (z. B. Gelb, Weiß): auswärts in der zweiten, dunkleren Farbe.
      body = secondary;
      trim = primary;
    } else {
      // Sonst wie im echten Sport: weißes Auswärtstrikot mit Vereinsfarben als Besatz.
      body = AWAY_WHITE;
      const primaryDarker = luminance(primary) <= luminance(secondary);
      trim = primaryDarker ? primary : secondary;
      accent = primaryDarker ? secondary : primary;
      if (luminance(accent) > 0.68) accent = shadeColor(trim, -35);
    }
  }
  const dark = luminance(body) < 0.16 || (style === "aermel" && luminance(trim) < 0.16);
  return { body, trim, accent, outline: dark ? "rgba(255,255,255,0.45)" : null };
}

export default function TeamBadge({
  sport,
  primaryColor,
  secondaryColor,
  jerseyStyle = "solid",
  variant = "heim",
  size = 36,
  isNationalTeam = false,
  countryCode,
}: TeamBadgeProps) {
  // Eindeutige IDs für die Schnittmasken (mehrere Trikots auf einer Seite).
  const uid = useId().replace(/:/g, "");
  if (isNationalTeam && countryCode) {
    return <NationalFlagBadge countryCode={countryCode} size={size} />;
  }
  const colors = jerseyColors(primaryColor, secondaryColor, variant, jerseyStyle);
  const props = { c: colors, style: jerseyStyle, size, uid };
  if (sport === "NFL") return <FootballJerseyIcon {...props} />;
  if (sport === "NBA") return <BasketballJerseyIcon {...props} />;
  if (sport === "NHL") return <HockeyJerseyIcon {...props} />;
  return <SoccerJerseyIcon {...props} />;
}

interface IconProps {
  c: JerseyColors;
  style: JerseyStyle;
  size: number;
  uid: string;
}

// Gemeinsamer heller Rand für sehr dunkle Trikots (sonst verschwinden sie auf dem dunklen Hintergrund).
function Outline({ d, c, width }: { d: string; c: JerseyColors; width: number }) {
  if (!c.outline) return null;
  return <path d={d} fill="none" stroke={c.outline} strokeWidth={width} strokeLinejoin="round" />;
}

// ---------------------------------------------------------------- Fußball
const SOCCER_BODY = "m378.334 450.587c-7.712-85.122-7.081-178.017 3.356-260.816.516-4.043 3.956-5.533 6.879-2.607l26.35 26.347 73.625-73.625-56.997-56.969c-13.847-13.878-31.223-20.213-48.769-20.213-86.384 0-166.978 0-253.361 0-17.547 0-34.922 6.335-48.797 20.213l-56.969 56.969 73.596 73.625 26.378-26.347c2.923-3.183 6.421-1.262 6.852 2.378 10.465 82.859 11.095 175.836 3.354 261.046l128.904 8.832z";
// Ärmel = Bereich außerhalb der Linie Achsel -> Schulter (wird mit dem Körper geschnitten).
const SOCCER_SLEEVES = "M0 0H118L140 205L0 330Z M512 0H394L372 205L512 330Z";

function SoccerJerseyIcon({ c, style, size, uid }: IconProps) {
  const sleeveColor = style === "aermel" ? c.trim : c.body;
  const cuff = style === "aermel" ? c.body : c.trim;
  const bodyShade = shadeColor(c.body, -18);
  const trimShade = shadeColor(c.trim, -18);
  const cuffShade = shadeColor(cuff, -18);
  const collarDark = shadeColor(c.trim, -42);
  const clip = `soc-${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={SOCCER_BODY} />
        </clipPath>
      </defs>
      <g clipRule="evenodd" fillRule="evenodd">
        <path d="m186.499 23.969h139.168v49.457h-139.168z" fill={collarDark} />
        <path d="m488.544 139.885 20.757 20.758c3.526 3.526 3.671 7.77 0 11.438l-62.187 62.187c-3.641 3.642-7.569 3.872-11.439 0l-20.757-20.758 31.021-43.924z" fill={cuff} />
        <path d="m23.651 139.885-20.758 20.758c-3.843 3.84-3.871 7.597 0 11.438l62.157 62.187c4.014 4.013 7.798 3.642 11.469 0l20.729-20.758-31.537-41.688z" fill={cuff} />
        <path d={SOCCER_BODY} fill={c.body} />
        <path d="m378.334 450.587c-7.282-80.306-7.138-167.551 1.663-246.709.545-4.73 1.089-9.434 1.693-14.107.314-2.494 1.749-4.014 3.498-4.127h-24.743c-.403 0-3.498-.289-4.043 4.127-10.436 82.8-11.068 175.694-3.355 260.816zm97.568-298.06 12.642-12.643-56.997-56.969c-13.847-13.878-31.223-20.213-48.769-20.213h-25.23c17.517 0 34.865 6.364 48.712 20.213 23.223 23.195 46.418 46.417 69.642 69.612z" fill={bodyShade} />
        <g clipPath={`url(#${clip})`}>
          {style === "streifen" &&
            [166, 226, 286, 346].map((x) => <rect key={x} x={x - 15} y="0" width="30" height="512" fill={c.trim} />)}
          {sleeveColor !== c.body && <path d={SOCCER_SLEEVES} fill={sleeveColor} />}
        </g>
        <Outline d={SOCCER_BODY} c={c} width={10} />
        <path d="m133.831 450.587v29.331c0 4.471 3.642 8.113 8.115 8.113h228.303c4.445 0 8.085-3.642 8.085-8.113v-29.331z" fill={c.trim} />
        <path d="m344.962 488.031h25.287c4.445 0 8.085-3.642 8.085-8.113v-29.331h-25.288v29.331c0 4.471-3.64 8.113-8.084 8.113z" fill={trimShade} />
        <path d="m488.544 139.885 20.757 20.758c3.526 3.526 3.671 7.77 0 11.438l-62.187 62.187c-3.641 3.642-7.569 3.872-11.439 0l-6.91-6.911 55.248-55.276c3.671-3.669 3.526-7.912 0-11.438l-8.112-8.115z" fill={cuffShade} />
        <path d="m165.971 62.703 20.528-38.734 46.218 80.737-34.577 30.993c-3.614 3.212-7.083 2.208-8.602-2.294z" fill={c.trim} />
        <path d="m174.341 46.906 12.158-22.938 46.218 80.737-34.577 30.993c-3.614 3.212-7.083 2.208-8.602-2.294l-3.24-9.777 15.941-14.279c3.555-3.21 3.901-6.879 1.061-11.84z" fill={trimShade} />
        <path d="m346.195 62.703-20.528-38.734-46.189 80.737 34.576 30.993c3.756 3.354 6.939 2.608 8.573-2.294z" fill={c.trim} />
        <path d="m346.195 62.703-20.528-38.734-13.133 22.938 3.756 7.052c4.014 7.597 2.667 14.621.861 20.069l-16.544 49.601 13.446 12.071c3.756 3.354 6.939 2.608 8.573-2.294z" fill={trimShade} />
        <path d="m254.191 104.706h-21.474l10.723 16.714 7.999-6.794z" fill="#f9f7f8" />
        <path d="m260.469 134.292 19.009-29.586h-25.287l-10.751 16.714 8.286 12.872c2.808 4.388 5.876 4.445 8.743 0z" fill="#ebe8fa" />
        <path d="m336.39 196.021v43.379c0 14.564-10.981 20.182-25.689 27.122-4.875 2.007-9.748 2.036-14.624 0-14.706-6.939-25.687-12.557-25.687-27.122v-43.379c0-4.444 3.64-8.085 8.084-8.085h49.829c4.445 0 8.087 3.641 8.087 8.085z" fill={style === "streifen" ? c.body : c.trim} />
        <path d="m336.39 196.021v43.379c0 14.564-10.981 20.182-25.689 27.122-4.875 2.007-9.748 2.036-14.624 0-1.834-.859-3.611-1.721-5.331-2.552 11.956-5.935 20.355-11.811 20.355-24.57v-43.379c0-4.444-3.64-8.085-8.085-8.085h25.287c4.445 0 8.087 3.641 8.087 8.085z" fill={style === "streifen" ? bodyShade : trimShade} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------- Eishockey
// Kontur 1:1 aus der vom User bereitgestellten Eishockey-Trikot-Vorlage
// nachgezeichnet (via Bildanalyse), damit die Form exakt passt.
const HOCKEY_BODY = "M 50.2,50.9 L 42.6,64.9 L 32.4,106.5 L 40.0,107.3 L 47.9,75.5 L 52.1,74.8 L 64.6,89.1 L 74.4,111.4 L 80.8,164.4 L 77.0,176.1 L 28.3,168.5 L 36.6,122.8 L 34.3,117.9 L 29.0,119.8 L 12.0,232.8 L 16.9,241.1 L 60.8,248.7 L 67.2,243.4 L 75.1,214.7 L 78.5,214.3 L 81.9,259.6 L 90.3,270.2 L 204.8,271.4 L 216.9,261.9 L 220.7,213.5 L 224.1,213.9 L 231.7,242.3 L 238.8,248.7 L 284.2,239.6 L 287.6,228.6 L 275.9,149.6 L 269.1,152.3 L 270.6,168.9 L 222.2,176.1 L 218.8,164.7 L 225.6,109.5 L 234.3,89.9 L 247.9,74.4 L 251.3,74.8 L 266.4,139.0 L 274.0,139.4 L 256.6,64.6 L 244.1,46.0 L 218.8,34.7 L 183.6,28.3 L 165.9,49.8 L 145.5,55.1 L 132.2,48.7 L 120.5,30.1 L 112.6,28.3 L 75.1,36.6 Z";
const HOCKEY_SLEEVES = "M0 0H98L80 172L77 177V300H0Z M300 0H202L220 172L223 177V300H300Z";

function HockeyJerseyIcon({ c, style, size, uid }: IconProps) {
  const clip = `hoc-${uid}`;
  // Bei andersfarbigen Ärmeln laufen die Ärmelstreifen in der Trikotfarbe.
  const sleeveStripe = style === "aermel" ? c.body : c.trim;

  return (
    <svg width={size} height={size} viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={HOCKEY_BODY} />
        </clipPath>
      </defs>
      <path d={HOCKEY_BODY} fill={c.body} />
      <g clipPath={`url(#${clip})`}>
        {style === "aermel" && <path d={HOCKEY_SLEEVES} fill={c.trim} />}
        {style === "streifen" && (
          <>
            {/* Brust-/Schulterband quer über Trikot und Ärmel */}
            <rect x="0" y="92" width="300" height="34" fill={c.trim} />
            <rect x="0" y="103" width="300" height="12" fill={c.accent} />
          </>
        )}
      </g>
      <Outline d={HOCKEY_BODY} c={c} width={6} />
      {/* Rippkragen */}
      <path d="M114 36 Q150 68 186 36" fill="none" stroke={c.trim} strokeWidth="7" strokeLinecap="round" />
      <path d="M120 34 Q150 58 180 34" fill="none" stroke={c.accent} strokeWidth="3.5" strokeLinecap="round" />
      {/* Bund-Streifen */}
      <rect x="86.9" y="194.6" width="126.2" height="12.9" fill={c.trim} />
      <rect x="86.9" y="215.0" width="126.2" height="12.9" fill={c.accent} />
      <rect x="86.9" y="235.4" width="126.2" height="12.9" fill={c.trim} />
      {/* Ärmel-Streifen links */}
      <rect x="24.9" y="176.5" width="49.9" height="18.1" fill={sleeveStripe} />
      <rect x="22.6" y="195.0" width="47.2" height="17.4" fill={c.accent} />
      {/* Ärmel-Streifen rechts */}
      <rect x="225.2" y="176.5" width="49.9" height="18.1" fill={sleeveStripe} />
      <rect x="230.2" y="195.0" width="47.2" height="17.4" fill={c.accent} />
    </svg>
  );
}

// ---------------------------------------------------------------- Basketball
// Der Körper des lizenzierten Icons dient als Schnittmaske für Streifen/Seitenteile.
// (Das Icon hat schon einen weißen Rand, deshalb hier kein zusätzlicher Rand.)
const BASKETBALL_BODY = BASKETBALL_JERSEY_MARKUP.match(/<path fill="__PRIMARY__"[^>]*? d="([^"]+)"/)?.[1] ?? "";
const BASKETBALL_BODY_END = (() => {
  const start = BASKETBALL_JERSEY_MARKUP.indexOf('<path fill="__PRIMARY__"');
  return start < 0 ? -1 : BASKETBALL_JERSEY_MARKUP.indexOf("/>", start) + 2;
})();

function basketballOverlay(c: JerseyColors, style: JerseyStyle, clip: string): string {
  let shapes = "";
  if (style === "streifen") {
    // Nadelstreifen
    for (let x = 145; x <= 216; x += 7) shapes += `<rect x="${x - 0.9}" y="100" width="1.8" height="160" fill="${c.trim}"/>`;
  } else if (style === "aermel") {
    // Ärmellos: dafür breite Seitenteile von der Achsel bis zum Saum
    shapes += `<rect x="130" y="150" width="22" height="110" fill="${c.trim}"/>`;
    shapes += `<rect x="208" y="150" width="22" height="110" fill="${c.trim}"/>`;
  }
  if (!shapes) return "";
  return `<defs><clipPath id="${clip}"><path d="${BASKETBALL_BODY}"/></clipPath></defs><g clip-path="url(#${clip})">${shapes}</g>`;
}

function BasketballJerseyIcon({ c, style, size, uid }: IconProps) {
  let markup = BASKETBALL_JERSEY_MARKUP;
  if (BASKETBALL_BODY && BASKETBALL_BODY_END > 0) {
    const overlay = basketballOverlay(c, style, `bb-${uid}`);
    markup = markup.slice(0, BASKETBALL_BODY_END) + overlay + markup.slice(BASKETBALL_BODY_END);
  }
  markup = markup.replace(/__PRIMARY__/g, c.body).replace(/__SECONDARY__/g, c.trim);

  return (
    <svg width={size} height={size} viewBox="130 103 100 154" aria-hidden="true">
      <g dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  );
}

// ---------------------------------------------------------------- Football (NFL)
// Kurze, breite Ärmel über den Schulterpolstern, V-Ausschnitt, Rückennummer vorne.
const FOOTBALL_BODY =
  "M112 40L66 50C46 55 32 66 26 84L14 124L64 137L74 118L80 258Q150 270 220 258L226 118L236 137L286 124L274 84C268 66 254 55 234 50L188 40L150 86Z";
const FOOTBALL_SLEEVES = "M0 0H92L75 118L72 300H0Z M300 0H208L225 118L228 300H300Z";

function FootballJerseyIcon({ c, style, size, uid }: IconProps) {
  const clip = `fb-${uid}`;
  const bodyShade = shadeColor(c.body, -18);

  return (
    <svg width={size} height={size} viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={FOOTBALL_BODY} />
        </clipPath>
      </defs>
      <path d={FOOTBALL_BODY} fill={c.body} />
      <g clipPath={`url(#${clip})`}>
        {/* leichte Schattierung rechts wie bei den anderen Trikots */}
        <path d="M196 40L240 50L300 120V300H190Q204 190 196 40Z" fill={bodyShade} opacity="0.55" />
        {style === "aermel" && <path d={FOOTBALL_SLEEVES} fill={c.trim} />}
        {style === "streifen" && (
          <g fill="none" stroke={c.trim} strokeWidth="8">
            {/* zwei Ärmelstreifen parallel zum Ärmelsaum */}
            <path d="M0 102L100 127M0 87L100 112" />
            <path d="M300 102L200 127M300 87L200 112" />
          </g>
        )}
        {/* Ärmelsaum */}
        <path d="M14 124L64 137M286 124L236 137" stroke={style === "aermel" ? c.body : c.trim} strokeWidth="10" />
      </g>
      <Outline d={FOOTBALL_BODY} c={c} width={5} />
      {/* V-Kragen */}
      <path d="M112 40L150 86L188 40" fill="none" stroke={c.trim} strokeWidth="10" strokeLinejoin="round" />
      {/* Nummer */}
      <text
        x="150"
        y="208"
        textAnchor="middle"
        fontFamily="Arial Black, Arial, Helvetica, sans-serif"
        fontWeight="900"
        fontSize="96"
        fill={c.trim}
      >
        1
      </text>
    </svg>
  );
}
