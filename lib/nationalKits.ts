import type { Team } from "@/lib/types";
import { countryName } from "@/lib/flags";

// Trikotfarben der Nationalteams (Rene, 12.11.2026: "bei den Nationalteams
// kommen nur die Flaggen, nicht die Trikots"). Nationalteams zeigen jetzt wie
// Vereine ein Trikot. Solange der Admin beim Team keine eigenen Farben
// eingestellt hat (noch die grünen Standardfarben vom Anlegen), kommen die
// Farben aus dieser Liste: [Trikot, Kragen/Streifen] daheim und auswärts.
// Nur Farben, kein Wappen und kein Muster (siehe Trikot-Regel ohne Wappen).

type Kit = [primary: string, secondary: string];

const KITS: Record<string, { home: Kit; away: Kit }> = {
  // Europa
  AT: { home: ["#ED2939", "#FFFFFF"], away: ["#FFFFFF", "#ED2939"] },
  DE: { home: ["#FFFFFF", "#000000"], away: ["#C8102E", "#000000"] },
  CH: { home: ["#D52B1E", "#FFFFFF"], away: ["#FFFFFF", "#D52B1E"] },
  IT: { home: ["#0066B3", "#FFFFFF"], away: ["#FFFFFF", "#0066B3"] },
  FR: { home: ["#1B2A5C", "#FFFFFF"], away: ["#FFFFFF", "#1B2A5C"] },
  ES: { home: ["#C60B1E", "#FFC400"], away: ["#FFFFFF", "#C60B1E"] },
  PT: { home: ["#A6192E", "#006600"], away: ["#FFFFFF", "#A6192E"] },
  NL: { home: ["#F36C21", "#000000"], away: ["#1B2A5C", "#F36C21"] },
  BE: { home: ["#C8102E", "#FDDA24"], away: ["#FFFFFF", "#C8102E"] },
  "GB-ENG": { home: ["#FFFFFF", "#1B2A5C"], away: ["#C8102E", "#FFFFFF"] },
  "GB-SCT": { home: ["#1B2A5C", "#FFFFFF"], away: ["#FFFFFF", "#1B2A5C"] },
  "GB-WLS": { home: ["#C8102E", "#FFFFFF"], away: ["#FFFFFF", "#C8102E"] },
  "GB-NIR": { home: ["#00843D", "#FFFFFF"], away: ["#FFFFFF", "#00843D"] },
  GB: { home: ["#FFFFFF", "#1B2A5C"], away: ["#C8102E", "#FFFFFF"] },
  IE: { home: ["#169B62", "#FFFFFF"], away: ["#FFFFFF", "#169B62"] },
  DK: { home: ["#C8102E", "#FFFFFF"], away: ["#FFFFFF", "#C8102E"] },
  NO: { home: ["#C8102E", "#FFFFFF"], away: ["#FFFFFF", "#1B2A5C"] },
  SE: { home: ["#FECC00", "#006AA7"], away: ["#006AA7", "#FECC00"] },
  FI: { home: ["#FFFFFF", "#003580"], away: ["#003580", "#FFFFFF"] },
  IS: { home: ["#02529C", "#FFFFFF"], away: ["#FFFFFF", "#02529C"] },
  PL: { home: ["#FFFFFF", "#DC143C"], away: ["#DC143C", "#FFFFFF"] },
  CZ: { home: ["#D7141A", "#FFFFFF"], away: ["#FFFFFF", "#11457E"] },
  SK: { home: ["#FFFFFF", "#0B4EA2"], away: ["#0B4EA2", "#FFFFFF"] },
  HU: { home: ["#CE2939", "#FFFFFF"], away: ["#FFFFFF", "#477050"] },
  SI: { home: ["#FFFFFF", "#005DA4"], away: ["#005DA4", "#FFFFFF"] },
  HR: { home: ["#FFFFFF", "#D20F23"], away: ["#171796", "#FFFFFF"] },
  RS: { home: ["#C6363C", "#FFFFFF"], away: ["#FFFFFF", "#0C4076"] },
  BA: { home: ["#002395", "#FECB00"], away: ["#FFFFFF", "#002395"] },
  ME: { home: ["#C40308", "#D3AE3B"], away: ["#FFFFFF", "#C40308"] },
  MK: { home: ["#D20000", "#FFE600"], away: ["#FFFFFF", "#D20000"] },
  AL: { home: ["#E41E20", "#000000"], away: ["#FFFFFF", "#E41E20"] },
  XK: { home: ["#244AA5", "#D0A650"], away: ["#FFFFFF", "#244AA5"] },
  GR: { home: ["#FFFFFF", "#0D5EAF"], away: ["#0D5EAF", "#FFFFFF"] },
  TR: { home: ["#E30A17", "#FFFFFF"], away: ["#FFFFFF", "#E30A17"] },
  CY: { home: ["#1E4B9E", "#FFFFFF"], away: ["#FFFFFF", "#1E4B9E"] },
  RO: { home: ["#FCD116", "#002B7F"], away: ["#002B7F", "#FCD116"] },
  BG: { home: ["#FFFFFF", "#00966E"], away: ["#00966E", "#FFFFFF"] },
  UA: { home: ["#FFD700", "#0057B7"], away: ["#0057B7", "#FFD700"] },
  BY: { home: ["#C8313E", "#FFFFFF"], away: ["#FFFFFF", "#C8313E"] },
  RU: { home: ["#FFFFFF", "#D52B1E"], away: ["#D52B1E", "#FFFFFF"] },
  GE: { home: ["#FFFFFF", "#DA291C"], away: ["#DA291C", "#FFFFFF"] },
  AM: { home: ["#D90012", "#0033A0"], away: ["#FFFFFF", "#D90012"] },
  AZ: { home: ["#FFFFFF", "#0092BC"], away: ["#E00034", "#FFFFFF"] },
  LT: { home: ["#FDB913", "#006A44"], away: ["#006A44", "#FDB913"] },
  LV: { home: ["#9E3039", "#FFFFFF"], away: ["#FFFFFF", "#9E3039"] },
  EE: { home: ["#0072CE", "#FFFFFF"], away: ["#FFFFFF", "#0072CE"] },
  MD: { home: ["#0046AE", "#FFD200"], away: ["#FFFFFF", "#0046AE"] },
  LU: { home: ["#ED2939", "#FFFFFF"], away: ["#FFFFFF", "#00A1DE"] },
  MT: { home: ["#CF142B", "#FFFFFF"], away: ["#FFFFFF", "#CF142B"] },
  LI: { home: ["#002B7F", "#CE1126"], away: ["#CE1126", "#FFFFFF"] },
  SM: { home: ["#5EB6E4", "#FFFFFF"], away: ["#FFFFFF", "#5EB6E4"] },
  AD: { home: ["#10069F", "#FEDF00"], away: ["#D50032", "#FFFFFF"] },
  FO: { home: ["#FFFFFF", "#0065BD"], away: ["#0065BD", "#FFFFFF"] },
  GI: { home: ["#DA000C", "#FFFFFF"], away: ["#FFFFFF", "#DA000C"] },
  KZ: { home: ["#00AFCA", "#FEC50C"], away: ["#FFFFFF", "#00AFCA"] },
  IL: { home: ["#FFFFFF", "#0038B8"], away: ["#0038B8", "#FFFFFF"] },
  // Amerika
  AR: { home: ["#75AADB", "#FFFFFF"], away: ["#1B2A5C", "#75AADB"] },
  BR: { home: ["#FEDD00", "#009739"], away: ["#012169", "#FFFFFF"] },
  UY: { home: ["#5CBFEB", "#000000"], away: ["#FFFFFF", "#5CBFEB"] },
  CO: { home: ["#FCD116", "#003893"], away: ["#003893", "#FCD116"] },
  CL: { home: ["#D52B1E", "#0039A6"], away: ["#FFFFFF", "#D52B1E"] },
  PE: { home: ["#FFFFFF", "#D91023"], away: ["#D91023", "#FFFFFF"] },
  EC: { home: ["#FFD100", "#034EA2"], away: ["#034EA2", "#FFD100"] },
  PY: { home: ["#D52B1E", "#FFFFFF"], away: ["#0038A8", "#FFFFFF"] },
  VE: { home: ["#7B1E2E", "#FFFFFF"], away: ["#FFFFFF", "#7B1E2E"] },
  BO: { home: ["#007934", "#FFFFFF"], away: ["#FFFFFF", "#007934"] },
  MX: { home: ["#006847", "#FFFFFF"], away: ["#FFFFFF", "#006847"] },
  US: { home: ["#FFFFFF", "#1B2A5C"], away: ["#1B2A5C", "#C8102E"] },
  CA: { home: ["#D80621", "#FFFFFF"], away: ["#FFFFFF", "#D80621"] },
  CR: { home: ["#CE1126", "#002B7F"], away: ["#FFFFFF", "#CE1126"] },
  PA: { home: ["#DA121A", "#FFFFFF"], away: ["#FFFFFF", "#072357"] },
  JM: { home: ["#FED100", "#009B3A"], away: ["#000000", "#FED100"] },
  HN: { home: ["#FFFFFF", "#0073CF"], away: ["#0073CF", "#FFFFFF"] },
  // Afrika
  MA: { home: ["#C1272D", "#006233"], away: ["#FFFFFF", "#C1272D"] },
  SN: { home: ["#FFFFFF", "#00853F"], away: ["#00853F", "#FDEF42"] },
  NG: { home: ["#008751", "#FFFFFF"], away: ["#FFFFFF", "#008751"] },
  GH: { home: ["#FFFFFF", "#000000"], away: ["#CE1126", "#FCD116"] },
  CM: { home: ["#007A5E", "#CE1126"], away: ["#FFFFFF", "#007A5E"] },
  CI: { home: ["#F77F00", "#FFFFFF"], away: ["#FFFFFF", "#009E60"] },
  EG: { home: ["#CE1126", "#FFFFFF"], away: ["#FFFFFF", "#000000"] },
  TN: { home: ["#FFFFFF", "#E70013"], away: ["#E70013", "#FFFFFF"] },
  DZ: { home: ["#FFFFFF", "#006233"], away: ["#006233", "#FFFFFF"] },
  ZA: { home: ["#FFB81C", "#007749"], away: ["#FFFFFF", "#007749"] },
  ML: { home: ["#FCD116", "#14B53A"], away: ["#FFFFFF", "#CE1126"] },
  // Asien und Ozeanien
  JP: { home: ["#0B1D5E", "#FFFFFF"], away: ["#FFFFFF", "#0B1D5E"] },
  KR: { home: ["#CD2E3A", "#000000"], away: ["#FFFFFF", "#0047A0"] },
  AU: { home: ["#FFCD00", "#00843D"], away: ["#00843D", "#FFCD00"] },
  NZ: { home: ["#FFFFFF", "#000000"], away: ["#000000", "#FFFFFF"] },
  SA: { home: ["#FFFFFF", "#006C35"], away: ["#006C35", "#FFFFFF"] },
  IR: { home: ["#FFFFFF", "#DA0000"], away: ["#DA0000", "#FFFFFF"] },
  QA: { home: ["#8A1538", "#FFFFFF"], away: ["#FFFFFF", "#8A1538"] },
  AE: { home: ["#FFFFFF", "#00732F"], away: ["#C8102E", "#FFFFFF"] },
  IQ: { home: ["#FFFFFF", "#007A3D"], away: ["#007A3D", "#FFFFFF"] },
  JO: { home: ["#FFFFFF", "#CE1126"], away: ["#CE1126", "#FFFFFF"] },
  UZ: { home: ["#FFFFFF", "#0099B5"], away: ["#0099B5", "#FFFFFF"] },
  CN: { home: ["#DE2910", "#FFDE00"], away: ["#FFFFFF", "#DE2910"] },
};

// Farben, mit denen ein neues Team im Admin startet (app/admin/page.tsx).
const DEFAULT_PRIMARY = "#3FA66B";
const DEFAULT_SECONDARY = "#FFFFFF";

/** Hat der Admin beim Team noch keine eigenen Trikotfarben gewählt? */
function hasDefaultColors(team: Pick<Team, "primaryColor" | "secondaryColor">): boolean {
  return (
    (team.primaryColor ?? "").toUpperCase() === DEFAULT_PRIMARY &&
    (team.secondaryColor ?? "").toUpperCase() === DEFAULT_SECONDARY
  );
}

/**
 * Nationalteam ohne eigene Farben: Heim- und Auswärtsfarben aus der Liste.
 * Alle anderen Teams (und Länder, die nicht in der Liste sind) bleiben, wie sie sind.
 */
export function withNationalKit<T extends Team>(team: T): T {
  if (!team.isNationalTeam || !hasDefaultColors(team)) return team;
  const kit = KITS[(team.countryCode ?? "").toUpperCase()];
  if (!kit) return team;
  return {
    ...team,
    primaryColor: kit.home[0],
    secondaryColor: kit.home[1],
    awayPrimaryColor: team.awayPrimaryColor ?? kit.away[0],
    awaySecondaryColor: team.awaySecondaryColor ?? kit.away[1],
  };
}

// Englische Ländernamen wie bei API-Sports → Ländercode. Für Länderspiele
// ohne eigenes App-Team (Rene, 12.11.2026: Nations League zeigte nur graue
// Gast-Trikots), Frauenteams mit " W" am Ende gehen genauso.
const API_NATION_CODES: Record<string, string> = {
  austria: "AT", germany: "DE", switzerland: "CH", italy: "IT", france: "FR",
  spain: "ES", portugal: "PT", netherlands: "NL", belgium: "BE",
  england: "GB-ENG", scotland: "GB-SCT", wales: "GB-WLS", "northern ireland": "GB-NIR",
  ireland: "IE", "republic of ireland": "IE", denmark: "DK", norway: "NO",
  sweden: "SE", finland: "FI", iceland: "IS", poland: "PL",
  "czech republic": "CZ", czechia: "CZ", slovakia: "SK", hungary: "HU",
  slovenia: "SI", croatia: "HR", serbia: "RS", "bosnia & herzegovina": "BA",
  "bosnia and herzegovina": "BA", montenegro: "ME", "north macedonia": "MK",
  "fyr macedonia": "MK", albania: "AL", kosovo: "XK", greece: "GR",
  turkey: "TR", "türkiye": "TR", cyprus: "CY", romania: "RO", bulgaria: "BG",
  ukraine: "UA", belarus: "BY", russia: "RU", georgia: "GE", armenia: "AM",
  azerbaijan: "AZ", lithuania: "LT", latvia: "LV", estonia: "EE", moldova: "MD",
  luxembourg: "LU", malta: "MT", liechtenstein: "LI", "san marino": "SM",
  andorra: "AD", "faroe islands": "FO", gibraltar: "GI", kazakhstan: "KZ",
  israel: "IL",
  argentina: "AR", brazil: "BR", uruguay: "UY", colombia: "CO", chile: "CL",
  peru: "PE", ecuador: "EC", paraguay: "PY", venezuela: "VE", bolivia: "BO",
  mexico: "MX", usa: "US", "united states": "US", canada: "CA",
  "costa rica": "CR", panama: "PA", jamaica: "JM", honduras: "HN",
  morocco: "MA", senegal: "SN", nigeria: "NG", ghana: "GH", cameroon: "CM",
  "ivory coast": "CI", "cote d'ivoire": "CI", egypt: "EG", tunisia: "TN",
  algeria: "DZ", "south africa": "ZA", mali: "ML",
  japan: "JP", "korea republic": "KR", "south korea": "KR", australia: "AU",
  "new zealand": "NZ", "saudi arabia": "SA", iran: "IR", qatar: "QA",
  "united arab emirates": "AE", iraq: "IQ", jordan: "JO", uzbekistan: "UZ",
  china: "CN", "china pr": "CN",
};

/** Ländercode zu einem englischen API-Namen ("Belgium" → "BE"), sonst undefined. */
export function apiNationCode(apiName: string): string | undefined {
  const key = (apiName ?? "").trim().toLowerCase().replace(/\s+w$/, "");
  return API_NATION_CODES[key];
}

/** Startfarben fürs Admin-Formular eines neuen Nationalteams. */
export function nationalKitColors(code: string): { home: Kit; away: Kit } | undefined {
  return KITS[(code ?? "").toUpperCase()];
}

/**
 * Länderspiel ohne eigenes App-Team: ein Trikot in den Landesfarben (nur
 * Fußball). Unbekannte Namen (Vereine, kleine Nationen) → undefined, dann
 * bleibt es beim grauen Gast-Trikot.
 */
export function nationalKitTeam(sport: string, apiName: string): Team | undefined {
  if (sport !== "Fußball") return undefined;
  const code = apiNationCode(apiName);
  const kit = code ? KITS[code] : undefined;
  if (!code || !kit) return undefined;
  return {
    id: `nation:${code}`,
    // Deutscher Name wie bei den Nationalteams im Admin ("Belgien"), Frauen mit " W".
    name: /\s+w$/i.test(apiName.trim()) ? `${countryName(code)} W` : countryName(code),
    sport: "Fußball",
    countryCode: code,
    isNationalTeam: true,
    primaryColor: kit.home[0],
    secondaryColor: kit.home[1],
    awayPrimaryColor: kit.away[0],
    awaySecondaryColor: kit.away[1],
    jerseyStyle: "solid",
  };
}
