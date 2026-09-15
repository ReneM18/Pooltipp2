// Wandelt einen ISO-3166-1-alpha-2-Ländercode in ein Flaggen-Emoji um,
// z. B. "DE" -> 🇩🇪. Funktioniert automatisch für jeden gültigen Code,
// ohne dass wir jede Flagge einzeln hinterlegen müssen.
export function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "DE", name: "Deutschland" },
  { code: "US", name: "USA" },
  { code: "GB", name: "England" },
  { code: "ES", name: "Spanien" },
  { code: "IT", name: "Italien" },
  { code: "FR", name: "Frankreich" },
  { code: "NL", name: "Niederlande" },
  { code: "PT", name: "Portugal" },
];
