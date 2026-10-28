// Test für die Verknüpfung Tippspiele ↔ Matchcenter (lib/matchcenterLink.ts).
// Ausführen: npm run test:matchcenter
import assert from "node:assert/strict";
import { inMatchcenterDays, isMatchTippable, isNightKickoff, matchcenterHref, sportDay, tipCardHref } from "../lib/matchcenterLink.ts";

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

// Matchcenter kennt heute und gestern als Sporttag (06:00 bis 06:00 Wien).
assert.equal(inMatchcenterDays("2026-10-27T19:00:00Z", now), true); // heute 20:00
assert.equal(inMatchcenterDays("2026-10-27T22:59:00Z", now), true); // heute 23:59 in Wien
assert.equal(inMatchcenterDays("2026-10-28T02:00:00Z", now), true); // Nacht 03:00 zählt zu heute
assert.equal(inMatchcenterDays("2026-10-28T04:59:00Z", now), true); // Nacht 05:59
assert.equal(inMatchcenterDays("2026-10-28T05:00:00Z", now), false); // morgen 06:00
assert.equal(inMatchcenterDays("2026-10-26T05:00:00Z", now), true); // gestern 06:00
assert.equal(inMatchcenterDays("2026-10-26T04:59:00Z", now), false); // Nacht davor = vorgestern
// Über die Zeitumstellung (25.10.2026) hinweg: gestern = 26.10.
assert.equal(inMatchcenterDays("2026-10-26T12:00:00Z", Date.parse("2026-10-27T07:30:00Z")), true);
// Um 03:00 in der Nacht ist noch "gestern" der Sporttag heute.
const night = Date.parse("2026-10-28T02:00:00Z"); // 28.10. 03:00 in Wien
assert.equal(sportDay(night), "2026-10-27");
assert.equal(inMatchcenterDays("2026-10-27T19:00:00Z", night), true);
assert.equal(inMatchcenterDays("2026-10-26T12:00:00Z", night), true);
assert.equal(inMatchcenterDays("2026-10-25T12:00:00Z", night), false);

// Sporttag und Nacht-Spiele (Rene, 28.10.2026).
assert.equal(isNightKickoff("2026-10-27T23:00:00Z"), true); // 00:00 Wien
assert.equal(isNightKickoff("2026-10-28T04:59:00Z"), true); // 05:59 Wien
assert.equal(isNightKickoff("2026-10-28T05:00:00Z"), false); // 06:00 Wien
assert.equal(isNightKickoff("2026-10-27T22:59:00Z"), false); // 23:59 Wien
assert.equal(sportDay("2026-10-28T01:00:00Z"), "2026-10-27"); // NBA 02:00
assert.equal(sportDay("2026-10-28T12:00:00Z"), "2026-10-28");
// Sommerzeit: 03:30 Wien = 01:30 UTC.
assert.equal(sportDay("2026-07-15T01:30:00Z"), "2026-07-14");
assert.equal(sportDay("2026-07-15T04:00:00Z"), "2026-07-15"); // 06:00 Wien

assert.equal(tipCardHref("a b"), "/?spiel=a%20b");
assert.equal(matchcenterHref("m1"), "/matchcenter?spiel=m1");

console.log("Matchcenter-Verknüpfung: alle Tests bestanden");

// Europacup-Ligaphase: Farben nach Platz bzw. API-Beschreibung (Rene, 28.10.2026).
{
  const { cupZone } = await import("../lib/standings.ts");
  const r = (rank, description = null) => ({ rank, description });
  assert.equal(cupZone(2, r(1), 36), "r16");
  assert.equal(cupZone(2, r(8), 36), "r16");
  assert.equal(cupZone(3, r(9), 36), "playoff");
  assert.equal(cupZone(848, r(24), 36), "playoff");
  assert.equal(cupZone(2, r(25), 36), "out");
  assert.equal(cupZone(2, r(36), 36), "out");
  assert.equal(cupZone(2, r(10, "Promotion - Champions League (Round of 16)"), 36), "r16");
  assert.equal(cupZone(2, r(3, "Promotion - Champions League (Play Offs: 1/16-finals)"), 36), "playoff");
  assert.equal(cupZone(78, r(1), 18), null); // Bundesliga: wie bisher
  assert.equal(cupZone(2, r(1), 4), null); // keine Ligaphase
}
