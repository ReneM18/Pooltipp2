// Emoji-Auswahl für Chat und Kommentare, nach Kategorien sortiert.
// Reine Emoji-Zeichen (kein Paket, keine Bilder). Jede Zeile: Emoji, danach
// deutsche Suchwörter. Bewusst nur Emojis bis Unicode 13, damit sie auch auf
// älteren Handys angezeigt werden.

import { COUNTRIES, flagEmoji, normalizeForSearch } from "@/lib/flags";

export type EmojiEntry = { emoji: string; keywords: string };
export type EmojiCategory = { id: string; label: string; icon: string; emojis: EmojiEntry[] };

function parse(list: string): EmojiEntry[] {
  return list
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [emoji, ...words] = line.split(" ");
      return { emoji, keywords: normalizeForSearch(words.join(" ")) };
    });
}

const SMILEYS = `
😀 grinsen freude lachen smiley
😃 grinsen freude lachen
😄 lachen freude augen
😁 grinsen zähne strahlen
😆 lachen zugekniffen
😅 lachen schweiß puh erleichtert
🤣 lachen boden kugeln rofl
😂 lachen tränen lol haha
🙂 lächeln smiley
🙃 kopfüber umgedreht ironie
😉 zwinkern
😊 lächeln rot freundlich
😇 engel unschuldig heiligenschein
🥰 verliebt herzen
😍 verliebt herzaugen
🤩 stern begeistert wow
😘 kuss
😗 kuss
😚 kuss
😙 kuss pfeifen
😋 lecker zunge
😛 zunge
😜 zunge zwinkern verrückt
🤪 verrückt crazy
😝 zunge
🤑 geld reich dollar
🤗 umarmen umarmung
🤭 hand mund kichern ups
🤫 psst leise geheim
🤔 denken nachdenken hmm
🤐 mund zu schweigen
🤨 skeptisch augenbraue
😐 neutral
😑 ausdruckslos
😶 sprachlos
😏 grinsen schmunzeln selbstgefällig
😒 genervt unbeeindruckt
🙄 augenrollen genervt
😬 grimasse peinlich
🤥 lügen pinocchio
😌 erleichtert zufrieden
😔 nachdenklich traurig
😪 müde schläfrig
🤤 sabbern
😴 schlafen müde zzz
😷 maske krank
🤒 krank fieber
🤕 verletzt verband
🤢 übel schlecht
🤮 kotzen übel
🤧 niesen erkältet
🥵 heiß schwitzen
🥶 kalt frieren
🥴 benommen beschwipst
😵 schwindlig k.o.
🤯 explodieren kopf umgehauen wahnsinn
🤠 cowboy
🥳 party feiern
😎 cool sonnenbrille
🤓 nerd streber
🧐 monokel prüfen
😕 verwirrt
😟 besorgt
🙁 traurig
😮 staunen überrascht oh
😯 still überrascht
😲 schockiert erstaunt
😳 rot peinlich erröten
🥺 bitte bettelnd hundeblick
😦 entsetzt
😧 gequält
😨 angst
😰 angst schweiß
😥 enttäuscht erleichtert
😢 weinen traurig träne
😭 heulen weinen laut
😱 schreien schock horror
😖 verwirrt gequält
😣 durchhalten
😞 enttäuscht
😓 schweiß niedergeschlagen
😩 erschöpft müde
😫 erschöpft
🥱 gähnen müde langweilig
😤 schnauben triumph wütend
😡 wütend sauer
😠 wütend böse
🤬 fluchen wütend
😈 teufel frech
👿 teufel böse
💀 totenkopf tot lachen
☠️ totenkopf gift
💩 kacke haufen
🤡 clown
👹 oger monster
👻 geist gespenst halloween
👽 alien außerirdischer
🤖 roboter
😺 katze lachen
😹 katze tränen lachen
😻 katze verliebt
😿 katze weinen
🙈 affe nichts sehen peinlich
🙉 affe nichts hören
🙊 affe nichts sagen
`;

const GESTEN = `
👍 daumen hoch gut super ok like
👎 daumen runter schlecht dislike
👏 klatschen applaus bravo
🙌 hände hoch feiern hurra
👐 offene hände
🤲 hände bitten
🤝 handschlag deal einverstanden
🙏 bitte danke beten hoffen
✌️ peace sieg victory
🤞 daumen drücken glück hoffen
🤟 ich liebe dich
🤘 rock metal
🤙 ruf mich an shaka
👌 ok perfekt
🤌 italienisch was
🤏 ein bisschen klein
👈 links zeigen
👉 rechts zeigen
👆 oben zeigen
👇 unten zeigen
☝️ zeigefinger achtung
✋ hand stopp
🤚 hand
🖐️ hand fünf
🖖 vulkanier spock
👋 winken hallo tschüss
✊ faust
👊 faust faustcheck
🤛 faust links
🤜 faust rechts
💪 muskel stark kraft
🦵 bein
🦶 fuß
👀 augen schauen gucken
👁️ auge
👄 mund
🧠 gehirn schlau
🙋 melden hand hoch
🙆 ok geste
🙅 nein geste stopp
🤷 achselzucken keine ahnung egal
🤦 facepalm kopf hand
🙇 verbeugen entschuldigung
💁 info bitte
🙎 schmollen
🧑‍💻 laptop programmieren
🕺 tanzen
💃 tanzen tänzerin
🏃 rennen laufen
🚶 gehen
🧍 stehen
🧘 yoga meditation ruhe
`;

const HERZEN = `
❤️ herz liebe rot
🧡 herz orange
💛 herz gelb
💚 herz grün
💙 herz blau
💜 herz lila
🤎 herz braun
🖤 herz schwarz
🤍 herz weiß
💔 gebrochenes herz kummer
❣️ herz ausrufezeichen
💕 zwei herzen liebe
💞 herzen kreisen
💓 herz schlagen
💗 herz wachsen
💖 herz glitzer
💘 herz pfeil amor
💝 herz geschenk
💟 herz deko
💋 kuss lippen
💌 liebesbrief
😻 verliebt katze
`;

const SPORT = `
⚽ fußball ball tor soccer
🥅 tor netz
🏀 basketball nba
🏈 football nfl
⚾ baseball
🥎 softball
🏐 volleyball
🏉 rugby
🎾 tennis
🏓 tischtennis
🏸 badminton
🏒 eishockey hockey nhl
🏑 hockey feldhockey
🥍 lacrosse
🏏 cricket
⛳ golf
🏌️ golf golfer
🎯 darts dart volltreffer ziel
🎳 bowling kegeln
🥊 boxen boxhandschuh
🥋 kampfsport judo karate
🤺 fechten
🤼 ringen
🤸 turnen rad
⛹️ basketball spieler
🏋️ gewichtheben fitness
🚴 radfahren fahrrad
🚵 mountainbike
🏎️ formel 1 rennwagen f1 auto
🏍️ motorrad motogp
🏁 zielflagge rennen formel ziel
🏇 pferderennen
⛷️ ski skifahren
🏂 snowboard
⛸️ eislaufen schlittschuh
🛷 schlitten rodeln
🥌 curling
🏄 surfen
🏊 schwimmen
🤽 wasserball
🚣 rudern
🧗 klettern
🎿 ski
🏆 pokal trophäe sieger meister
🥇 gold erster platz sieger
🥈 silber zweiter platz
🥉 bronze dritter platz
🏅 medaille
🎖️ orden
🎽 trikot laufshirt
👟 schuh sportschuh
🧢 kappe cap
📣 megafon fans anfeuern
🥁 trommel fans
🎺 trompete fans
📢 lautsprecher durchsage
⏱️ stoppuhr zeit
🟨 gelbe karte
🟥 rote karte
🎮 spiel zocken controller
🎲 würfel glück zufall
♟️ schach
`;

const FEIERN = `
🎉 party feiern konfetti glückwunsch
🎊 konfetti feiern
🥳 party feiern
🍾 sekt champagner feiern
🥂 anstoßen prost sekt
🍻 bier prost anstoßen
🎈 luftballon
🎁 geschenk
🎂 torte geburtstag
🍰 kuchen
🧁 cupcake muffin
🕯️ kerze
🎆 feuerwerk silvester
🎇 wunderkerze
✨ glitzer funkeln
🌟 stern leuchten
⭐ stern
💫 schwindlig sterne
🔥 feuer heiß hammer stark
💥 knall boom
💯 hundert perfekt
🚀 rakete abheben
👑 krone könig
💎 diamant
💰 geld sack
🪅 piñata
🎃 kürbis halloween
🎄 weihnachtsbaum weihnachten
🎅 weihnachtsmann
🐣 ostern küken
🎵 musik note
🎶 musik noten
🎤 mikrofon singen karaoke
📸 foto kamera
`;

const TIERE = `
🐶 hund
🐱 katze
🐭 maus
🐹 hamster
🐰 hase kaninchen
🦊 fuchs
🐻 bär
🐼 panda
🐨 koala
🐯 tiger
🦁 löwe
🐮 kuh
🐷 schwein
🐸 frosch
🐵 affe
🐔 huhn
🐧 pinguin
🐦 vogel
🐤 küken
🦆 ente
🦅 adler
🦉 eule
🦇 fledermaus
🐺 wolf
🐗 wildschwein
🐴 pferd
🦄 einhorn
🐝 biene
🐛 raupe
🦋 schmetterling
🐌 schnecke langsam
🐞 marienkäfer
🐢 schildkröte langsam
🐍 schlange
🦎 eidechse
🦖 dinosaurier
🐙 oktopus krake
🦀 krebs krabbe
🐠 fisch
🐬 delfin
🐳 wal
🦈 hai
🐊 krokodil
🦓 zebra
🦒 giraffe
🐘 elefant
🦘 känguru
🐐 ziege goat
🐑 schaf
🦌 hirsch
🐕 hund
🐈 katze
🐓 hahn
🦃 truthahn
🕊️ taube frieden
🐿️ eichhörnchen
🦔 igel
🌵 kaktus
🌲 tanne baum
🌳 baum
🍀 kleeblatt glück
🍁 ahornblatt herbst
🍂 blätter herbst
🌻 sonnenblume
🌹 rose blume
🌷 tulpe
🌸 blüte kirschblüte
💐 blumenstrauß
☀️ sonne
🌤️ sonne wolke
⛅ wolke sonne
🌧️ regen
⛈️ gewitter
❄️ schnee kalt
⛄ schneemann
🌈 regenbogen
⚡ blitz schnell
🌙 mond nacht
🌍 erde welt
`;

const ESSEN = `
🍏 apfel grün
🍎 apfel rot
🍐 birne
🍊 orange
🍋 zitrone
🍌 banane
🍉 melone
🍇 trauben
🍓 erdbeere
🍒 kirschen
🍑 pfirsich
🥭 mango
🍍 ananas
🥥 kokosnuss
🥝 kiwi
🍅 tomate
🥑 avocado
🥦 brokkoli
🥕 karotte
🌽 mais
🌶️ chili scharf
🥔 kartoffel
🥐 croissant
🥖 baguette brot
🥨 brezel
🧀 käse
🥚 ei
🍳 spiegelei
🥓 speck
🥩 steak fleisch
🍗 hähnchen keule
🍖 fleisch knochen
🌭 hotdog würstchen
🍔 burger
🍟 pommes
🍕 pizza
🥪 sandwich
🌮 taco
🌯 burrito wrap
🥙 döner kebab
🥗 salat
🍝 spaghetti nudeln pasta
🍜 nudelsuppe ramen
🍣 sushi
🍤 garnele
🍦 eis softeis
🍨 eis becher
🍩 donut
🍪 keks
🍫 schokolade
🍬 bonbon
🍭 lutscher
🍿 popcorn kino
🥜 erdnüsse
☕ kaffee
🍵 tee
🥤 becher getränk
🧃 saft
🍺 bier
🍻 bier prost
🍷 wein
🍸 cocktail
🍹 cocktail urlaub
🥃 whisky schnaps
🧉 mate
💧 wasser tropfen
🧊 eiswürfel
🍽️ essen teller besteck
`;

const SYMBOLE = `
✅ häkchen richtig erledigt
☑️ häkchen kästchen
✔️ häkchen
❌ kreuz falsch nein
❎ kreuz
❗ ausrufezeichen achtung
❓ fragezeichen frage
‼️ doppelt ausrufezeichen
⁉️ ausrufe fragezeichen
⚠️ warnung achtung
🚫 verboten
⛔ stopp
🔴 rot kreis
🟠 orange kreis
🟡 gelb kreis
🟢 grün kreis
🔵 blau kreis
🟣 lila kreis
⚫ schwarz kreis
⚪ weiß kreis
🟥 rot quadrat
🟩 grün quadrat
🟦 blau quadrat
⬆️ pfeil hoch
⬇️ pfeil runter
⬅️ pfeil links
➡️ pfeil rechts
↩️ zurück
🔁 wiederholen
🔄 neu laden
➕ plus
➖ minus
✖️ mal
➗ geteilt
0️⃣ null 0
1️⃣ eins 1
2️⃣ zwei 2
3️⃣ drei 3
4️⃣ vier 4
5️⃣ fünf 5
6️⃣ sechs 6
7️⃣ sieben 7
8️⃣ acht 8
9️⃣ neun 9
🔟 zehn 10
🆗 ok
🆕 neu
🆒 cool
🔝 top
💤 schlafen zzz
💬 sprechblase chat
💭 gedanke
🗯️ wut sprechblase
📌 pin stecknadel
📍 ort
🔔 glocke benachrichtigung
🔕 stumm
⏰ wecker
⌛ sanduhr zeit
📅 kalender datum
📊 statistik diagramm
📈 steigend trend hoch
📉 fallend trend runter
💡 idee glühbirne
🔒 schloss gesperrt
🔓 offen entsperrt
🔑 schlüssel
🎟️ ticket eintrittskarte
📺 fernseher tv
📱 handy
💻 laptop
🍀 glück kleeblatt
🧿 glücksbringer
☮️ frieden
♻️ recycling
©️ copyright
™️ marke
`;

const FLAGGEN_EXTRA = `
🏳️ weiße flagge aufgeben
🏴 schwarze flagge
🏁 zielflagge rennen
🚩 rote flagge
🏳️‍🌈 regenbogen pride
🏴󠁧󠁢󠁥󠁮󠁧󠁿 england
🏴󠁧󠁢󠁳󠁣󠁴󠁿 schottland
🏴󠁧󠁢󠁷󠁬󠁳󠁿 wales
🇪🇺 europa eu
`;

const FLAGGEN: EmojiEntry[] = [
  ...parse(FLAGGEN_EXTRA),
  ...COUNTRIES.map((c) => ({
    emoji: flagEmoji(c.code),
    keywords: normalizeForSearch(`${c.name} flagge ${c.code}`),
  })),
];

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { id: "smileys", label: "Smileys", icon: "😀", emojis: parse(SMILEYS) },
  { id: "gesten", label: "Gesten & Leute", icon: "👍", emojis: parse(GESTEN) },
  { id: "herzen", label: "Herzen", icon: "❤️", emojis: parse(HERZEN) },
  { id: "sport", label: "Sport & Pokale", icon: "⚽", emojis: parse(SPORT) },
  { id: "feiern", label: "Feiern", icon: "🎉", emojis: parse(FEIERN) },
  { id: "natur", label: "Tiere & Natur", icon: "🐶", emojis: parse(TIERE) },
  { id: "essen", label: "Essen & Trinken", icon: "🍕", emojis: parse(ESSEN) },
  { id: "symbole", label: "Symbole", icon: "✅", emojis: parse(SYMBOLE) },
  { id: "flaggen", label: "Flaggen", icon: "🏁", emojis: FLAGGEN },
];

/** Suche über alle Kategorien, jedes Emoji höchstens einmal. */
export function searchEmojis(query: string, limit = 120): string[] {
  const parts = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const seen = new Set<string>();
  const hits: string[] = [];
  for (const cat of EMOJI_CATEGORIES) {
    for (const e of cat.emojis) {
      if (seen.has(e.emoji)) continue;
      const words = e.keywords.split(" ");
      if (parts.every((p) => words.some((w) => w.startsWith(p)))) {
        seen.add(e.emoji);
        hits.push(e.emoji);
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

const RECENT_KEY = "pooltipp-emoji-zuletzt";
const RECENT_MAX = 16;

export function loadRecentEmojis(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string, current: string[]): string[] {
  const next = [emoji, ...current.filter((e) => e !== emoji)].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ohne Speicher geht es auch
  }
  return next;
}
