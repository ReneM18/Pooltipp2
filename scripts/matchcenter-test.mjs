// Test für die Verknüpfung Tippspiele ↔ Matchcenter (lib/matchcenterLink.ts).
// Ausführen: npm run test:matchcenter
import assert from "node:assert/strict";
import { upcomingDrafts } from "../lib/draftMatches.ts";
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

// Spielplan-Tage (Rene, 30.10.2026): Heute/Morgen/Gestern nach Kalendertag.
{
  const { relativeDayLabel, viennaCalendarDay, planDayRange, addDays } = await import("../lib/matchcenterLink.ts");
  const early = Date.parse("2026-10-30T02:30:00Z"); // 30.10. 03:30 in Wien
  assert.equal(viennaCalendarDay(early), "2026-10-30");
  assert.equal(relativeDayLabel("2026-10-30", early), "Heute"); // nicht "Morgen"
  assert.equal(relativeDayLabel("2026-10-31", early), "Morgen");
  assert.equal(relativeDayLabel("2026-10-29", early), "Gestern");
  assert.equal(relativeDayLabel("2026-11-01", early), null);
  const late = Date.parse("2026-10-30T22:30:00Z"); // 30.10. 23:30 in Wien
  assert.equal(relativeDayLabel("2026-10-30", late), "Heute");
  assert.equal(relativeDayLabel("2026-10-31", Date.parse("2026-10-30T23:30:00Z")), "Heute"); // 00:30 Wien
  assert.deepEqual(planDayRange(false), { back: 1, ahead: 1 });
  assert.deepEqual(planDayRange(true), { back: 7, ahead: 7 });
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  console.log("Spielplan-Tage: alle Tests bestanden");
}

// Spielplan nach Bewerb (Rene, 04.11.2026): Runden auf Deutsch, aktuelle Runde.
{
  const { roundLabel, groupRounds, currentRoundIndex } = await import("../lib/competitionFixtures.ts");
  assert.deepEqual(roundLabel("Regular Season - 11"), { title: "11. Spieltag", phase: null });
  assert.deepEqual(roundLabel("League Stage - 4"), { title: "4. Spieltag", phase: "Ligaphase" });
  assert.deepEqual(roundLabel("League A - 3"), { title: "3. Spieltag", phase: "Liga A" });
  assert.equal(roundLabel("Round of 16").title, "Achtelfinale");
  assert.equal(roundLabel("8th Finals").title, "Achtelfinale");
  assert.equal(roundLabel("Quarter-finals").title, "Viertelfinale");
  assert.equal(roundLabel("Final").title, "Finale");
  assert.equal(roundLabel("Knockout Round Play-offs").title, "Play-offs");
  assert.equal(roundLabel("2nd Round").title, "2. Runde");
  assert.equal(roundLabel("3rd Qualifying Round").title, "3. Quali-Runde");
  const g = (id, round, kickoff, status = "NS") => ({ id, round, kickoff, status, home: "A" + id, away: "B" + id });
  const rounds = groupRounds([
    g(3, "League Stage - 2", "2026-10-01T19:00:00Z", "FT"),
    g(1, "League Stage - 1", "2026-09-16T19:00:00Z", "FT"),
    g(2, "League Stage - 1", "2026-09-17T19:00:00Z", "FT"),
    g(4, "League Stage - 3", "2026-10-21T19:00:00Z"),
    g(5, "League Stage - 3", "2026-10-22T19:00:00Z"),
    g(6, undefined, "2026-10-22T19:00:00Z"),
  ]);
  assert.deepEqual(rounds.map((r) => r.key), ["League Stage - 1", "League Stage - 2", "League Stage - 3"]);
  assert.equal(rounds[0].games.length, 2);
  assert.equal(currentRoundIndex(rounds, Date.parse("2026-10-10T12:00:00Z")), 2); // nächster Spieltag
  assert.equal(currentRoundIndex(rounds, Date.parse("2026-12-01T12:00:00Z")), 2); // Saison vorbei → letzter
  assert.equal(currentRoundIndex([], Date.now()), -1);
  // Nachholspiel von Runde 1 Wochen später: Runde 1 bleibt am alten Termin
  // und wird nicht wieder "aktuell".
  const late = groupRounds([
    g(1, "Regular Season - 1", "2026-08-01T15:00:00Z", "FT"),
    g(2, "Regular Season - 1", "2026-08-02T15:00:00Z", "FT"),
    g(3, "Regular Season - 1", "2026-08-02T17:00:00Z", "FT"),
    g(4, "Regular Season - 1", "2026-11-05T19:00:00Z"),
    g(5, "Regular Season - 2", "2026-08-08T15:00:00Z", "FT"),
    g(6, "Regular Season - 12", "2026-11-07T15:00:00Z"),
  ]);
  assert.equal(late[0].last, "2026-08-02T17:00:00Z");
  assert.equal(late[currentRoundIndex(late, Date.parse("2026-11-04T12:00:00Z"))].key, "Regular Season - 12");
console.log("Spielplan nach Bewerb: alle Tests bestanden");
}

// Neue Teams aus Länderspielen sind Nationalteams (12.11.2026: "India").
{
  const { isNationalTeamLeague } = await import("../lib/liveConfig.ts");
  assert.equal(isNationalTeamLeague("Fußball", "Friendlies · World"), true);
  assert.equal(isNationalTeamLeague("Fußball", "UEFA Nations League · World"), true);
  assert.equal(isNationalTeamLeague("Fußball", "World Cup - Qualification Europe · World"), true);
  assert.equal(isNationalTeamLeague("Fußball", "Bundesliga · Austria"), false);
  assert.equal(isNationalTeamLeague("Fußball", "Champions League · World"), false);
  assert.equal(isNationalTeamLeague("NHL", "Friendlies · World"), false);
}

// Entwurf-Hinweis für den Admin (12.11.2026): nur Entwürfe, die noch tippbar
// wären, nach Anstoß sortiert.
{
  const list = upcomingDrafts(
    [
      { id: "a", draft: true, status: "upcoming", kickoff: h(10), tipDeadline: h(10) },
      { id: "b", draft: true, status: "upcoming", kickoff: h(3), tipDeadline: h(3) },
      { id: "c", draft: false, status: "upcoming", kickoff: h(3), tipDeadline: h(3) },
      { id: "d", draft: true, status: "upcoming", kickoff: h(-1), tipDeadline: h(-1) },
      { id: "e", draft: true, status: "cancelled", kickoff: h(5), tipDeadline: h(5) },
    ],
    now,
  );
  assert.deepEqual(list.map((m) => m.id), ["b", "a"]);
}
console.log("Entwurf-Hinweis: alle Tests bestanden");

// Länderspiele ohne Verknüpfung (12.11.2026: Türkei–Belgien ohne "Tippen"):
// deutscher App-Name findet den englischen API-Namen über das Land.
{
  // lib/liveScores.ts importiert ohne Endung ("./teamName") – für Node ".ts" ergänzen.
  const { register } = await import("node:module");
  const hook = `export async function resolve(spec, ctx, next) {
    try { return await next(spec, ctx); } catch (e) {
      if (spec.startsWith(".") && !spec.endsWith(".ts")) return next(spec + ".ts", ctx);
      throw e;
    }
  }`;
  register("data:text/javascript," + encodeURIComponent(hook));
  const { findLiveGame, teamMatchScore } = await import("../lib/liveScores.ts");
  const game = (id, home, away, kickoff) => ({ id, home, away, kickoff, homeScore: null, awayScore: null, status: "NS" });
  const ko = "2026-11-12T17:00:00Z";
  const games = [game(1, "Türkiye", "Belgium", ko), game(2, "Armenia", "Cyprus", ko)];
  const hit = findLiveGame(games, ko, "Türkei", "Belgien");
  assert.equal(hit?.game.id, 1);
  assert.equal(hit?.swapped, false);
  assert.equal(findLiveGame(games, ko, "Belgien", "Türkei")?.swapped, true);
  assert.equal(findLiveGame(games, ko, "Armenien", "Zypern")?.game.id, 2);
  assert.ok(teamMatchScore("Turkei", "Turkey") >= 3);
  // Frauen nur mit Frauen, Vereine mit Ländernamen nicht.
  assert.equal(teamMatchScore("Belgien W", "Belgium"), 0);
  assert.equal(teamMatchScore("Belgien W", "Belgium W"), 3);
  const { nationCodeOfName } = await import("../lib/nationalKits.ts");
  assert.equal(nationCodeOfName("Austria Wien"), undefined);
  assert.equal(nationCodeOfName("Türkei"), "TR");
  assert.equal(nationCodeOfName("Türkiye"), "TR");
  // Teams ohne Staat (Rene, 14.11.2026): Flagge statt graues Trikot, Name deutsch.
  const { nationalKitTeam } = await import("../lib/nationalKits.ts");
  const { flagEmoji } = await import("../lib/flags.ts");
  assert.equal(nationCodeOfName("Basque Country"), "ES-PV");
  assert.equal(nationCodeOfName("Baskenland"), "ES-PV");
  assert.equal(nationCodeOfName("Catalonia"), "ES-CT");
  assert.equal(nationalKitTeam("Fußball", "Basque Country")?.name, "Baskenland");
  assert.equal(nationalKitTeam("Fußball", "Basque Country")?.countryCode, "ES-PV");
  assert.equal(nationalKitTeam("Fußball", "Athletic Club"), undefined);
  assert.equal(flagEmoji("ES-PV"), "\u{1F3F4}\u{E0065}\u{E0073}\u{E0070}\u{E0076}\u{E007F}");
  assert.equal(flagEmoji("GB-NIR"), flagEmoji("GB"));
  console.log("Länderspiel-Zuordnung: alle Tests bestanden");
}
