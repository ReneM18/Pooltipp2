// Test für die Verknüpfung Tippspiele ↔ Matchcenter (lib/matchcenterLink.ts).
// Ausführen: npm run test:matchcenter
import assert from "node:assert/strict";
import { inMatchcenterDays, isMatchTippable, matchcenterHref, tipCardHref } from "../lib/matchcenterLink.ts";

// 27.10.2026, 08:00 in Wien (07:00 UTC, Winterzeit).
const now = Date.parse("2026-10-27T07:00:00Z");
const h = (d) => new Date(now + d * 3600e3).toISOString();

// Tippbar nur bis zum Tippschluss, nicht als Entwurf, beendet oder abgesagt.
assert.equal(isMatchTippable({ status: "upcoming", tipDeadline: h(2) }, now), true);
assert.equal(isMatchTippable({ status: "upcoming", tipDeadline: h(-0.1) }, now), false);
assert.equal(isMatchTippable({ status: "upcoming", tipDeadline: h(2), draft: true }, now), false);
assert.equal(isMatchTippable({ status: "live", tipDeadline: h(2) }, now), false);
assert.equal(isMatchTippable({ status: "finished", tipDeadline: h(2) }, now), false);
assert.equal(isMatchTippable({ status: "cancelled", tipDeadline: h(2) }, now), false);

// Matchcenter kennt heute und gestern (Wiener Kalendertag).
assert.equal(inMatchcenterDays("2026-10-27T19:00:00Z", now), true); // heute 20:00
assert.equal(inMatchcenterDays("2026-10-27T22:59:00Z", now), true); // heute 23:59 in Wien
assert.equal(inMatchcenterDays("2026-10-27T23:00:00Z", now), false); // morgen 00:00 in Wien
assert.equal(inMatchcenterDays("2026-10-25T23:00:00Z", now), true); // gestern 00:00 in Wien
assert.equal(inMatchcenterDays("2026-10-25T22:59:00Z", now), false); // vorgestern
// Über die Zeitumstellung (25.10.2026) hinweg: gestern = 26.10.
assert.equal(inMatchcenterDays("2026-10-26T12:00:00Z", Date.parse("2026-10-27T00:30:00Z")), true);

assert.equal(tipCardHref("a b"), "/?spiel=a%20b");
assert.equal(matchcenterHref("m1"), "/matchcenter?spiel=m1");

console.log("Matchcenter-Verknüpfung: alle Tests bestanden");
