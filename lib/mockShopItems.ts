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
// Alle sechs Prämien sind bewusst als "Joker" konzipiert – jeder mit einem
// klar eigenen, echten Nutzen für die PoolScore-Mechanik (Rangliste-Punkte
// bzw. Tipp-Abgabe). Keiner davon zahlt in Sterne zurück (kein Kreislauf)
// und keiner bezieht sich auf eine Mechanik, die es in der App nicht gibt.
export const mockShopItems: ShopItem[] = [
  {
    id: "schutz-joker",
    category: "In-Game",
    name: "Schutz-Joker",
    description: "Schützt deine Rangliste-Punkte beim nächsten Fehltipp – kein Punkteabzug für dieses eine Spiel.",
    cost: 120,
  },
  {
    id: "pause-joker",
    category: "In-Game",
    name: "Pause-Joker",
    description: "Pausiert das langsame Abklingen deiner Rangliste-Punkte für 7 Tage, falls du mal keine Zeit hast.",
    cost: 100,
  },
  {
    id: "doppel-joker",
    category: "In-Game",
    name: "Doppel-Joker",
    description: "Ein Spiel deiner Wahl zählt doppelte Rangliste-Punkte.",
    cost: 180,
  },
  {
    id: "toleranz-joker",
    category: "In-Game",
    name: "Toleranz-Joker",
    description: "Liegst du bei einem Spiel nur 1 Tor daneben, bekommst du trotzdem Teilpunkte statt 0.",
    cost: 150,
  },
  {
    id: "korrektur-joker",
    category: "In-Game",
    name: "Korrektur-Joker",
    description: "Ändere einen bereits abgegebenen Tipp noch einmal, solange das Spiel noch nicht angepfiffen ist.",
    cost: 90,
  },
  {
    id: "trend-joker",
    category: "In-Game",
    name: "Trend-Joker",
    description: "Sieh vor Tippschluss, wie die Mehrheit der Community bei einem Spiel getippt hat.",
    cost: 100,
  },
];
