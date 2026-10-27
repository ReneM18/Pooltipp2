import type { ShopJoker } from "@/lib/JokerContext";

// Kaufen und Einsetzen: supabase/joker-shop.sql (dort stehen dieselben Preise).
export interface ShopItem {
  id: string;
  joker: ShopJoker;
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
//
// Alle Prämien sind bewusst als "Joker" konzipiert – jeder mit einem
// klar eigenen, echten Nutzen für die PoolScore-Mechanik (Rangliste-Punkte
// bzw. Tipp-Abgabe). Keiner davon zahlt in Sterne zurück (kein Kreislauf)
// und keiner bezieht sich auf eine Mechanik, die es in der App nicht gibt.
// Passend zum Rankingsystem (supabase/rankingsystem.sql, dort wirken die
// Joker bei der Auswertung). Der Korrektur-Joker ist gestrichen: Tipps ändern
// geht bis zum Anpfiff ohnehin gratis.
export const mockShopItems: ShopItem[] = [
  {
    id: "schutz-joker",
    joker: "schutz",
    category: "In-Game",
    name: "Schutz-Joker",
    description: "Ein Spiel deiner Wahl kostet dich keine Punkte: Liegst du daneben, zählt der Tipp 0 statt Minus.",
    cost: 120,
  },
  {
    id: "pause-joker",
    joker: "pause",
    category: "In-Game",
    name: "Pause-Joker",
    description:
      "Wer 2 Wochen gar nicht tippt, verliert ab der 3. Woche 5 Punkte pro Woche in jeder Sportart. Der Pause-Joker schützt dich automatisch eine Woche lang.",
    cost: 100,
  },
  {
    id: "doppel-joker",
    joker: "doppel",
    category: "In-Game",
    name: "Doppel-Joker",
    description: "Bei einem Spiel deiner Wahl zählen die festen Punkte doppelt: exakt 20, Tordifferenz 14, Tendenz 10. Bonus und Minus bleiben gleich.",
    cost: 180,
  },
  {
    id: "toleranz-joker",
    joker: "toleranz",
    category: "In-Game",
    name: "Toleranz-Joker",
    description: "Liegst du bei einem Spiel nur 1 Tor daneben, kostet dich der Tipp keine Punkte: 0 statt Minus.",
    cost: 150,
  },
  {
    id: "trend-joker",
    joker: "trend",
    category: "In-Game",
    name: "Trend-Joker",
    description:
      "Sieh vor Tippschluss bei einem Spiel, wie viel Prozent der anderen auf Heimsieg, Remis oder Auswärtssieg getippt haben.",
    cost: 80,
  },
  {
    id: "experten-joker",
    joker: "experte",
    category: "In-Game",
    name: "Experten-Joker",
    description:
      "Wie der Trend-Joker, und zusätzlich siehst du das Ergebnis, das die besten 30 % der Rangliste dieser Sportart am öftesten getippt haben (ab 3 Top-Tippern). Bei 1X2-Spielen ihre häufigste Wahl.",
    cost: 100,
  },
];
