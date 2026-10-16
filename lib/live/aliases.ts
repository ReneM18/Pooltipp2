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
  ["Frankfurt", "Eintracht Frankfurt"],
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

// true = beide Namen stehen in derselben Alias-Gruppe.
export function isTeamAlias(a: string, b: string): boolean {
  const ga = GROUP_OF.get(aliasKey(a));
  return ga !== undefined && ga === GROUP_OF.get(aliasKey(b));
}
