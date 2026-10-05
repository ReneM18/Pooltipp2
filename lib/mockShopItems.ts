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
    description: "Ein Spiel deiner Wahl kostet dich keine Rangpunkte: Liegst du daneben, zählt der Tipp 0 statt Minus.",
    cost: 120,
  },
  {
    id: "pause-joker",
    joker: "pause",
    category: "In-Game",
    name: "Pause-Joker",
    description:
      "Wer 2 Wochen gar nicht tippt, verliert ab der 3. Woche 5 Rangpunkte pro Woche in jeder Sportart. Der Pause-Joker schützt dich automatisch eine Woche lang.",
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
    description: "Liegst du bei einem Spiel nur 1 Tor daneben, kostet dich der Tipp 0 statt −3 Punkte.",
    cost: 150,
  },
  {
    id: "trend-joker",
    joker: "trend",
    category: "In-Game",
    name: "Trend-Joker",
    description: "Sieh vor Tippschluss, wie die Mehrheit der Community bei einem Spiel getippt hat.",
    cost: 100,
  },
];
