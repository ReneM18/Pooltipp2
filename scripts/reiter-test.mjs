// Test für die Reiter "Offene" / "Geschlossene" auf der Tipps-Seite (lib/matchTabs.ts).
// Ausführen: npm run test:reiter
process.env.TZ = "Europe/Vienna";
import assert from "node:assert/strict";
import { autoHomeTab, homeTabOf, splitHomeTabs, splitMatchesByTab } from "../lib/matchTabs.ts";
import { deadlineText, groupMatchesByDay } from "../lib/dayGroups.ts";

const now = Date.parse("2026-10-04T18:00:00Z");
const h = (d) => new Date(now + d * 3600e3).toISOString();
const M = (id, status, deadlineIn) => ({ id, status, tipDeadline: h(deadlineIn), kickoff: h(deadlineIn + 0.25) });
const matches = [
  M("bald", "upcoming", 2),
  M("spaeter", "upcoming", 30),
  M("tippschluss-vorbei", "upcoming", -1),
  M("laeuft", "live", -2),
  M("lange-vorbei-ohne-endstand", "upcoming", -48),
  M("beendet", "finished", -5),
  M("abgesagt", "cancelled", -3),
];

const { offen, geschlossen } = splitMatchesByTab(matches, now);
const ids = (l) => l.map((m) => m.id);

// Nur Endstand (beendet) oder Absage schließt ein Spiel, nie die Uhrzeit.
assert.deepEqual(ids(geschlossen), ["abgesagt", "beendet"]);
// Offene streng nach Anpfiff, das früheste oben, auch nach Tippschluss.
assert.deepEqual(ids(offen), ["lange-vorbei-ohne-endstand", "laeuft", "tippschluss-vorbei", "bald", "spaeter"]);

// Vor dem Laden im Browser (now = null) ebenfalls nichts automatisch geschlossen.
assert.deepEqual(ids(splitMatchesByTab(matches, null).geschlossen), ["abgesagt", "beendet"]);

// Überschriften nach Tag: Reihenfolge bleibt, Angepfiffenes unter "Läuft gerade".
// now = So., 04.10.2026 20:00 Wien.
const g = groupMatchesByDay(offen, now, "offen");
assert.deepEqual(g.map((x) => [x.label, ids(x.matches)]), [
  ["Läuft gerade", ["lange-vorbei-ohne-endstand", "laeuft", "tippschluss-vorbei"]],
  ["Heute", ["bald"]],
  ["Dienstag", ["spaeter"]],
]);
assert.equal(g[1].sub, "Sonntag, 04.10.");
assert.equal(g[2].sub, "06.10.");
const morgen = groupMatchesByDay([M("m", "upcoming", 10)], now, "offen");
assert.equal(morgen[0].label, "Morgen");
const gz = groupMatchesByDay(geschlossen, now, "geschlossen");
assert.deepEqual(gz.map((x) => [x.label, ids(x.matches)]), [["Heute", ["abgesagt", "beendet"]]]);
assert.deepEqual(groupMatchesByDay(offen, null, "offen").map((x) => x.label), [""]);

// Startseite Tippen/Live/Beendet (Rene, 18.10.2026).
const getippt = new Set(["spaeter"]);
const abgepfiffen = new Set(["laeuft"]);
const home = splitHomeTabs(matches, now, (m) => getippt.has(m.id), (m) => abgepfiffen.has(m.id));
assert.deepEqual(ids(home.offen), ["bald"]);
assert.deepEqual(ids(home.getippt), ["spaeter"]);
// Ohne Live-Daten: Anpfiff vorbei und kein Endstand = läuft.
assert.deepEqual(ids(home.laeuft), ["lange-vorbei-ohne-endstand", "tippschluss-vorbei"]);
assert.deepEqual(ids(home.geradeBeendet), ["laeuft"]);
// Tippschluss vorbei, Anpfiff noch nicht (kickoff = Tippschluss + 15 Min.).
const gleich = splitHomeTabs([M("gleich", "upcoming", -0.1)], now, () => false, () => false);
assert.deepEqual(ids(gleich.gleich), ["gleich"]);
assert.deepEqual(ids(home.beendet), ["abgesagt", "beendet"]);
// Offene Tipps nach Tippschluss sortiert.
const sortiert = splitHomeTabs([M("b", "upcoming", 5), M("a", "upcoming", 1)], now, () => false, () => false);
assert.deepEqual(ids(sortiert.offen), ["a", "b"]);
// Automatische Reiterwahl: Live vor Tippen vor Beendet.
assert.equal(autoHomeTab(home), "live");
assert.equal(autoHomeTab(splitHomeTabs([M("x", "upcoming", 3)], now, () => false, () => false)), "tippen");
// Renes Regel (21.10.2026): Live vor Tipps (auch schon getippt) vor Beendet.
assert.equal(autoHomeTab(splitHomeTabs([M("x", "upcoming", 3)], now, () => true, () => false)), "tippen");
assert.equal(autoHomeTab(splitHomeTabs([M("x", "upcoming", 3), M("alt", "finished", -20)], now, () => true, () => false)), "tippen");
assert.equal(autoHomeTab(splitHomeTabs([M("alt", "finished", -20)], now, () => true, () => false)), "beendet");
assert.equal(autoHomeTab(splitHomeTabs([M("alt", "finished", -20), M("laeuft", "live", -1)], now, () => true, () => false)), "live");
assert.equal(autoHomeTab(splitHomeTabs([], now, () => false, () => false)), "tippen");
assert.equal(autoHomeTab(gleich), "tippen");
assert.equal(homeTabOf(home, "bald"), "tippen");
assert.equal(homeTabOf(home, "laeuft"), "live");
assert.equal(homeTabOf(home, "beendet"), "beendet");
// Tippschluss-Text: heute nur Uhrzeit, sonst mit Wochentag.
assert.equal(deadlineText(Date.parse("2026-10-04T19:30:00Z"), now), "21:30");
assert.equal(deadlineText(Date.parse("2026-10-10T13:30:00Z"), now), "Sa. 15:30");
assert.equal(deadlineText(Date.parse("2026-10-24T13:30:00Z"), now), "Sa. 24.10. 15:30");

console.log("✓ Reiter-Test: 30 Prüfungen bestanden");
