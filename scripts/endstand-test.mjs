// Test fürs Vorausfüllen des Endstands im Admin aus der API
// (lib/liveScores.ts → apiAdminScore). Ausführen: npm run test:endstand
import assert from "node:assert/strict";
import { register } from "node:module";

// lib/liveScores.ts importiert ohne Endung ("./teamName") – für Node ".ts" ergänzen.
const hook = `export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); } catch (e) {
    if (spec.startsWith(".") && !spec.endsWith(".ts")) return next(spec + ".ts", ctx);
    throw e;
  }
}`;
register("data:text/javascript," + encodeURIComponent(hook));
const { apiAdminScore } = await import("../lib/liveScores.ts");

const kickoff = "2026-11-01T19:00:00Z";
const now = Date.parse("2026-11-01T22:00:00Z"); // 3 h nach Anpfiff
const late = Date.parse("2026-11-02T00:30:00Z"); // 5,5 h nach Anpfiff
const game = (extra) => ({
  id: "1", kickoff, home: "A", away: "B", homeScore: 2, awayScore: 1,
  status: "FT", statusShort: "FT", statusText: "Beendet", elapsed: null, league: "x", ...extra,
});
const res = (g, swapped = false) => ({
  game: g, swapped,
  homeScore: swapped ? g.awayScore : g.homeScore,
  awayScore: swapped ? g.homeScore : g.awayScore,
});

// Fußball regulär beendet: Endstand.
assert.deepEqual(apiAdminScore("Fußball", res(game({ fulltimeHome: 2, fulltimeAway: 1 })), now),
  { state: "final", homeScore: 2, awayScore: 1, stuck: false, status: "FT" });

// Fußball n. V.: gewertet wird der Stand nach 90 Minuten.
const aet = game({ status: "AET", homeScore: 3, awayScore: 2, fulltimeHome: 2, fulltimeAway: 2 });
assert.deepEqual(apiAdminScore("Fußball", res(aet), now),
  { state: "final", homeScore: 2, awayScore: 2, stuck: false, status: "AET", fullHome: 3, fullAway: 2 });

// Fußball i. E., Heim/Gast bei der API andersrum: alles gedreht.
const pen = game({ status: "PEN", homeScore: 1, awayScore: 1, fulltimeHome: 1, fulltimeAway: 0, penaltyHome: 4, penaltyAway: 3 });
assert.deepEqual(apiAdminScore("Fußball", res(pen, true), now),
  { state: "final", homeScore: 0, awayScore: 1, stuck: false, status: "PEN", fullHome: 1, fullAway: 1, penaltyHome: 3, penaltyAway: 4 });

// Fußball n. V. ohne 90-Minuten-Stand: nichts vorschlagen.
assert.deepEqual(apiAdminScore("Fußball", res(game({ status: "AET" })), now),
  { state: "no90", fullHome: 2, fullAway: 1 });

// NHL nach Verlängerung: Endstand inkl. Verlängerung.
assert.deepEqual(apiAdminScore("NHL", res(game({ status: "AET", homeScore: 4, awayScore: 3 })), now),
  { state: "final", homeScore: 4, awayScore: 3, stuck: false, status: "AET" });

// Läuft noch: nur zeigen.
const running = game({ status: "LIVE", statusText: "3. Drittel 20'" });
assert.equal(apiAdminScore("NHL", res(running), now).state, "running");

// Hängt 4 h nach Anpfiff noch auf "läuft" (#418): Vorschlag mit Warnung.
assert.deepEqual(apiAdminScore("NHL", res(running), late),
  { state: "final", homeScore: 2, awayScore: 1, stuck: true, status: "FT" });

// Noch nicht begonnen, abgesagt, Handball, kein Stand: nichts.
assert.equal(apiAdminScore("Fußball", res(game({ status: "NS" })), now), null);
assert.equal(apiAdminScore("Fußball", res(game({ status: "OTHER" })), now), null);
assert.equal(apiAdminScore("Handball", res(game({})), now), null);
assert.equal(apiAdminScore("NBA", res(game({ homeScore: null })), now), null);

console.log("Endstand-Vorschlag: alle Tests bestanden");
