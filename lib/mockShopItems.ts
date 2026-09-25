export interface ShopItem {
  id: string;
  category: "In-Game";
  name: string;
  description: string;
  cost: number; // in Sternen
}

// Klare Trennung zum Saison-Pass: Der Prämien-Shop bietet AUSSCHLIESSLICH
// funktionale, spielerische Vorteile an – keine optischen Dinge (Rahmen,
// Farben, Titel, Badges). Alles Optische/Saison-Identität bleibt dem Pass
// vorbehalten, den man sich durch Punkte verdient. So verbraucht der Shop
// nie Ideen, die für den Pass gebraucht werden, und beide Bereiche bleiben
// auf einen Blick unterscheidbar.
export const mockShopItems: ShopItem[] = [
  {
    id: "joker-extra",
    category: "In-Game",
    name: "Extra-Joker",
    description: "Ein zusätzlicher Risiko-Joker für den nächsten Spieltag.",
    cost: 80,
  },
  {
    id: "streak-saver",
    category: "In-Game",
    name: "Streak-Retter",
    description: "Rettet deine Tipp-Serie, falls du einen Spieltag verpasst.",
    cost: 120,
  },
  {
    id: "double-points-booster",
    category: "In-Game",
    name: "Doppel-Punkte-Booster",
    description: "Ein Spiel deiner Wahl zählt doppelte Punkte.",
    cost: 180,
  },
  {
    id: "tip-insurance",
    category: "In-Game",
    name: "Tipp-Versicherung",
    description: "Liegst du bei einem Spiel nur 1 Tor daneben, bekommst du trotzdem Teilpunkte statt 0.",
    cost: 150,
  },
  {
    id: "star-booster",
    category: "In-Game",
    name: "Sterne-Booster",
    description: "Für deine nächsten 3 Spieltage verdienst du 25% mehr Sterne.",
    cost: 200,
  },
  {
    id: "community-trend",
    category: "In-Game",
    name: "Community-Trend",
    description: "Sieh vor Tippschluss, wie die Mehrheit der Community bei einem Spiel getippt hat.",
    cost: 100,
  },
];
