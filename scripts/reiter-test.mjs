// Test für die Reiter "Offene" / "Geschlossene" auf der Tipps-Seite (lib/matchTabs.ts).
// Ausführen: npm run test:reiter
import assert from "node:assert/strict";
import { splitMatchesByTab } from "../lib/matchTabs.ts";

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

console.log("✓ Reiter-Test: 3 Prüfungen bestanden");
