// Shop vorerst ausgeblendet: die Joker ziehen Sterne ab, wirken aber noch
// nirgends. Kein Link mehr in der Kopfzeile, /shop zeigt nur "Kommt bald".
// Sobald die Joker wirklich etwas tun, hier auf true stellen.
export const SHOP_ENABLED = false;

// Vorschau: Warenkorb in der Kopfzeile ist wieder da und /shop zeigt alle
// Joker mit Preis, aber Einlösen ist gesperrt (es werden keine Sterne
// abgebucht). Mit SHOP_ENABLED = true wird der Shop wieder echt.
export const SHOP_PREVIEW = true;

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
    category: "In-Game",
    name: "Schutz-Joker",
    description: "Ein Spiel deiner Wahl kostet dich keine Rangpunkte: Liegst du daneben, zählt der Tipp 0 statt Minus.",
    cost: 120,
  },
  {
    id: "pause-joker",
    category: "In-Game",
    name: "Pause-Joker",
    description:
      "Wer 2 Wochen gar nicht tippt, verliert ab der 3. Woche 5 Rangpunkte pro Woche in jeder Sportart. Der Pause-Joker schützt dich automatisch eine Woche lang.",
    cost: 100,
  },
  {
    id: "doppel-joker",
    category: "In-Game",
    name: "Doppel-Joker",
    description: "Bei einem Spiel deiner Wahl zählen die festen Punkte doppelt: exakt 20, Tordifferenz 14, Tendenz 10. Bonus und Minus bleiben gleich.",
    cost: 180,
  },
  {
    id: "toleranz-joker",
    category: "In-Game",
    name: "Toleranz-Joker",
    description: "Liegst du bei einem Spiel nur 1 Tor daneben, kostet dich der Tipp 0 statt −3 Punkte.",
    cost: 150,
  },
  {
    id: "trend-joker",
    category: "In-Game",
    name: "Trend-Joker",
    description: "Sieh vor Tippschluss, wie die Mehrheit der Community bei einem Spiel getippt hat.",
    cost: 100,
  },
];
