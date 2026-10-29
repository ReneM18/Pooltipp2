// Eishockey-Hallen als feste Liste (Rene, 29.10.2026: "bei eishockey gibts
// keine stadien von der api"). API-Sports liefert bei Eishockey kein
// Stadion, darum füllt "Von der API füllen" die Hallen von hier. Stand
// Saison 2025/26, aus allgemeinem Wissen – Plätze bei Eishockey-Spielen.
// Fehlt die Kapazität, war sie nicht sicher bekannt. Von Hand geänderte
// Stadien im Admin überschreibt diese Liste nicht.
//
// names: voller Name zuerst, dann übliche Kurzformen.

export interface HockeyArena {
  // NHL-Team (USA/Kanada): "Capitals" ist dann Washington, nicht Wien.
  nhl?: boolean;
  names: string[];
  arena: string;
  capacity?: number;
}

export const HOCKEY_ARENAS: HockeyArena[] = [
  // NHL
  { nhl: true, names: ["Anaheim Ducks"], arena: "Honda Center", capacity: 17174 },
  { nhl: true, names: ["Boston Bruins"], arena: "TD Garden", capacity: 17850 },
  { nhl: true, names: ["Buffalo Sabres"], arena: "KeyBank Center", capacity: 19070 },
  { nhl: true, names: ["Calgary Flames"], arena: "Scotiabank Saddledome", capacity: 19289 },
  { nhl: true, names: ["Carolina Hurricanes"], arena: "Lenovo Center", capacity: 18700 },
  { nhl: true, names: ["Chicago Blackhawks"], arena: "United Center", capacity: 19717 },
  { nhl: true, names: ["Colorado Avalanche"], arena: "Ball Arena", capacity: 18007 },
  { nhl: true, names: ["Columbus Blue Jackets"], arena: "Nationwide Arena", capacity: 18144 },
  { nhl: true, names: ["Dallas Stars"], arena: "American Airlines Center", capacity: 18532 },
  { nhl: true, names: ["Detroit Red Wings"], arena: "Little Caesars Arena", capacity: 19515 },
  { nhl: true, names: ["Edmonton Oilers"], arena: "Rogers Place", capacity: 18347 },
  { nhl: true, names: ["Florida Panthers"], arena: "Amerant Bank Arena", capacity: 19250 },
  { nhl: true, names: ["Los Angeles Kings", "LA Kings"], arena: "Crypto.com Arena", capacity: 18145 },
  { nhl: true, names: ["Minnesota Wild"], arena: "Grand Casino Arena", capacity: 17954 },
  { nhl: true, names: ["Montreal Canadiens", "Montréal Canadiens"], arena: "Centre Bell", capacity: 21105 },
  { nhl: true, names: ["Nashville Predators"], arena: "Bridgestone Arena", capacity: 17159 },
  { nhl: true, names: ["New Jersey Devils"], arena: "Prudential Center", capacity: 16514 },
  { nhl: true, names: ["New York Islanders"], arena: "UBS Arena", capacity: 17255 },
  { nhl: true, names: ["New York Rangers"], arena: "Madison Square Garden", capacity: 18006 },
  { nhl: true, names: ["Ottawa Senators"], arena: "Canadian Tire Centre", capacity: 18652 },
  { nhl: true, names: ["Philadelphia Flyers"], arena: "Xfinity Mobile Arena", capacity: 19537 },
  { nhl: true, names: ["Pittsburgh Penguins"], arena: "PPG Paints Arena", capacity: 18387 },
  { nhl: true, names: ["San Jose Sharks"], arena: "SAP Center", capacity: 17562 },
  { nhl: true, names: ["Seattle Kraken"], arena: "Climate Pledge Arena", capacity: 17151 },
  { nhl: true, names: ["St. Louis Blues", "St Louis Blues"], arena: "Enterprise Center", capacity: 18096 },
  { nhl: true, names: ["Tampa Bay Lightning"], arena: "Benchmark International Arena", capacity: 19092 },
  { nhl: true, names: ["Toronto Maple Leafs"], arena: "Scotiabank Arena", capacity: 18800 },
  { nhl: true, names: ["Utah Mammoth", "Utah Hockey Club"], arena: "Delta Center" },
  { nhl: true, names: ["Vancouver Canucks"], arena: "Rogers Arena", capacity: 18910 },
  { nhl: true, names: ["Vegas Golden Knights"], arena: "T-Mobile Arena", capacity: 17367 },
  { nhl: true, names: ["Washington Capitals"], arena: "Capital One Arena", capacity: 18573 },
  { nhl: true, names: ["Winnipeg Jets"], arena: "Canada Life Centre", capacity: 15225 },
  // ICE Hockey League
  { names: ["EC KAC", "KAC", "Klagenfurter AC", "Klagenfurt"], arena: "Heidi Horten Arena", capacity: 4945 },
  { names: ["Vienna Capitals", "Wien Capitals", "spusu Vienna Capitals"], arena: "Steffl Arena", capacity: 7022 },
  { names: ["EC Red Bull Salzburg", "Red Bull Salzburg", "RB Salzburg", "Salzburg"], arena: "Eisarena Salzburg", capacity: 3200 },
  { names: ["Graz99ers", "Graz 99ers", "99ers", "Graz"], arena: "Merkur Eisstadion", capacity: 4126 },
  { names: ["Black Wings Linz", "Steinbach Black Wings Linz", "Black Wings 1992", "Linz"], arena: "Linz AG Eisarena", capacity: 4863 },
  { names: ["EC VSV", "VSV", "Villacher SV", "Villach"], arena: "Stadthalle Villach", capacity: 4500 },
  { names: ["HC Innsbruck", "HC TWK Innsbruck", "Innsbruck Haie", "Innsbruck"], arena: "TIWAG Arena" },
  { names: ["Pioneers Vorarlberg", "Vorarlberg"], arena: "Vorarlberghalle" },
  { names: ["HC Bozen", "HCB Südtirol", "HCB Südtirol Alperia", "HC Bolzano", "Bozen"], arena: "Sparkasse Arena", capacity: 7220 },
  { names: ["HC Pustertal", "Pustertal Wölfe", "Pustertal"], arena: "Intercable Arena" },
  { names: ["Fehérvár AV19", "Hydro Fehérvár AV19", "Fehervar AV19", "Fehérvár"], arena: "Ifj. Ocskay Gábor Jégcsarnok" },
  { names: ["HK Olimpija", "Olimpija Ljubljana", "HK Olimpija Ljubljana", "Ljubljana"], arena: "Hala Tivoli", capacity: 4050 },
];
