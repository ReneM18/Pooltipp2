// Bekannte Abweichungen der Teamnamen App ↔ Live-Anbieter (Rene, 16.10.2026).
// Jede Zeile ist eine Gruppe von Schreibweisen desselben Teams. Die
// Zuordnung (findLiveGame in lib/liveScores.ts) prüft zuerst diese Liste,
// danach die tolerante Namenslogik (teamNameScore). Groß/Klein, Akzente,
// Umlaute ("ö" = "oe" = "o") und Satzzeichen zählen nicht.
//
// Neue Abweichung? Im Admin unter "Live-Daten" → Zuordnungs-Check steht bei
// "✗ kein passendes Live-Spiel" der Name, den die API verwendet – einfach
// in die passende Gruppe hier eintragen (oder eine neue Zeile).
const ALIAS_GROUPS: readonly (readonly string[])[] = [
  // Eishockey – ICE Hockey League
  ["KAC", "EC KAC", "EC-KAC", "Klagenfurt", "KAC Klagenfurt", "EC Klagenfurt AC"],
  ["Capitals", "Vienna Capitals", "spusu Vienna Capitals"],
  ["Black Wings", "Black Wings Linz", "Steinbach Black Wings Linz", "Steinbach Black Wings 1992", "EHC Linz"],
  ["Salzburg", "EC Red Bull Salzburg", "EC Salzburg", "Red Bull Salzburg"],
  // Fußball
  ["Rapid", "Rapid Wien", "SK Rapid", "SK Rapid Wien"],
  ["Hartberg", "TSV Hartberg"],
  ["Köln", "1. FC Köln", "FC Köln", "FC Koln", "1. FC Koeln", "FC Cologne"],
  ["Frankfurt", "Eintracht Frankfurt", "SGE"],
  // Kurznamen deutscher Vereine (Rene, 27.10.2026: HSV – Frankfurt ohne Zuordnung)
  ["HSV", "Hamburger SV", "Hamburg"],
  ["BVB", "Borussia Dortmund", "Dortmund"],
  ["S04", "Schalke 04", "FC Schalke 04", "Schalke"],
  ["Gladbach", "Borussia Mönchengladbach", "Mönchengladbach", "BMG"],
  ["Sassuolo", "US Sassuolo"],
  ["Frosinone", "Frosinone Calcio"],
  // Eishockey – NHL
  ["Avalanche", "Colorado Avalanche"],
  ["Ducks", "Anaheim Ducks"],
  ["Penguins", "Pittsburgh Penguins"],
  ["Bruins", "Boston Bruins"],
];

function aliasKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/oe/g, "o")
    .replace(/ae/g, "a")
    .replace(/ue/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Schreibweise → Nummer der Gruppe.
const GROUP_OF = new Map<string, number>();
ALIAS_GROUPS.forEach((group, i) => group.forEach((n) => GROUP_OF.set(aliasKey(n), i)));

// Im Admin unter "Vereinsnamen" verknüpfte Namen (Rene, 27.10.2026): API-Name
// → Name des eigenen Teams, z. B. "Rapid Vienna" → "Rapid Wien". Setzt
// AppDataContext über lib/teamApiNames.ts; zählen wie ein Alias.
let manualPairs = new Set<string>();

export function setManualAliases(pairs: readonly (readonly [string, string])[]) {
  manualPairs = new Set(pairs.map(([a, b]) => `${aliasKey(a)}|${aliasKey(b)}`));
}

// true = beide Namen stehen in derselben Alias-Gruppe oder sind im Admin
// verknüpft (Reihenfolge egal).
export function isTeamAlias(a: string, b: string): boolean {
  const ka = aliasKey(a);
  const kb = aliasKey(b);
  if (manualPairs.has(`${ka}|${kb}`) || manualPairs.has(`${kb}|${ka}`)) return true;
  const ga = GROUP_OF.get(ka);
  return ga !== undefined && ga === GROUP_OF.get(kb);
}
