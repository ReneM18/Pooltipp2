// Rechentest für den Saison-Kalender (lib/seasons/schedule.ts).
// Ausführen: npm run test:saison
import assert from "node:assert/strict";
import {
  seasonForDate,
  seasonCountdownText,
  seasonPeriodText,
  viennaDateKey,
  playableSeasons,
} from "../lib/seasons/schedule.ts";
import { HERBST_2026 } from "../lib/seasons/herbst2026.ts";
import { WINTER_2026 } from "../lib/seasons/winter2026.ts";

let count = 0;
function eq(actual, expected, name) {
  assert.equal(actual, expected, name);
  count++;
}

// Uhrzeit in Österreich -> Date. Oktober = Sommerzeit (UTC+2), Dez/März = UTC+1.
const vienna = (iso, offset) => new Date(`${iso}${offset}`);

// --- Österreichischer Kalendertag, egal wo das Gerät steht -----------------
eq(viennaDateKey(vienna("2026-12-20T23:59:59", "+01:00")), "2026-12-20", "letzte Sekunde 20.12.");
eq(viennaDateKey(vienna("2026-12-21T00:00:00", "+01:00")), "2026-12-21", "Mitternacht 21.12.");
eq(viennaDateKey(new Date("2026-12-20T23:30:00Z")), "2026-12-21", "UTC 23:30 ist in Wien schon der 21.");

// --- Echte Saison-Dateien: Winter ist Entwurf, Herbst läuft weiter ---------
const real = [HERBST_2026, WINTER_2026];
eq(playableSeasons(real).length, 1, "nur Herbst spielbar");
eq(seasonForDate(real, vienna("2026-10-02T12:00:00", "+02:00")).theme.id, "herbst-2026", "heute");
eq(seasonForDate(real, vienna("2026-12-21T00:00:01", "+01:00")).theme.id, "herbst-2026", "Winter-Entwurf startet nicht");
eq(seasonForDate(real, vienna("2026-09-01T12:00:00", "+02:00")).theme.id, "herbst-2026", "vor dem ersten Start");

// --- Winter fertig (Entwurf aufgehoben) -------------------------------------
const winterLive = { ...WINTER_2026, draft: false };
const live = [winterLive, HERBST_2026]; // Reihenfolge egal
eq(seasonForDate(live, vienna("2026-12-20T23:59:59", "+01:00")).theme.id, "herbst-2026", "20.12. noch Herbst");
eq(seasonForDate(live, vienna("2026-12-21T00:00:00", "+01:00")).theme.id, "winter-2026", "21.12. Winter");
eq(seasonForDate(live, vienna("2027-03-19T22:00:00", "+01:00")).theme.id, "winter-2026", "letzter Wintertag");
eq(seasonForDate(live, vienna("2027-06-01T12:00:00", "+02:00")).theme.id, "winter-2026", "Frühling fehlt -> Winter verlängert");

// --- Countdown ----------------------------------------------------------------
eq(seasonCountdownText(HERBST_2026, vienna("2026-10-02T12:00:00", "+02:00")), "Endet in 79 Tagen", "2.10.");
eq(seasonCountdownText(HERBST_2026, vienna("2026-12-18T08:00:00", "+01:00")), "Endet in 2 Tagen", "18.12.");
eq(seasonCountdownText(HERBST_2026, vienna("2026-12-19T23:00:00", "+01:00")), "Endet morgen", "19.12.");
eq(seasonCountdownText(HERBST_2026, vienna("2026-12-20T00:00:00", "+01:00")), "Endet heute", "20.12.");
eq(
  seasonCountdownText(HERBST_2026, vienna("2026-12-21T00:00:00", "+01:00")),
  "Läuft weiter, bis die nächste Saison startet",
  "21.12. ohne Winter"
);
// Zeitumstellung 25.10. darf keinen Tag verschlucken
eq(seasonCountdownText(HERBST_2026, vienna("2026-10-24T12:00:00", "+02:00")), "Endet in 57 Tagen", "vor Zeitumstellung");
eq(seasonCountdownText(HERBST_2026, vienna("2026-10-26T12:00:00", "+01:00")), "Endet in 55 Tagen", "nach Zeitumstellung");

// --- Zeitraum-Text -----------------------------------------------------------
eq(seasonPeriodText(HERBST_2026), "23.9.–20.12.2026", "Herbst-Zeitraum");
eq(seasonPeriodText(WINTER_2026), "21.12.2026–19.3.2027", "Winter-Zeitraum");

// --- Winter-Entwurf hat dieselben 10 Stufen-Typen wie der Herbst -------------
eq(WINTER_2026.levels.length, 10, "Winter 10 Stufen");
for (let i = 0; i < 10; i++) {
  eq(WINTER_2026.levels[i].kind, HERBST_2026.levels[i].kind, `Stufe ${i + 1} gleiche Art`);
  eq(WINTER_2026.levels[i].xpRequired, HERBST_2026.levels[i].xpRequired, `Stufe ${i + 1} gleiche XP`);
}
// Saisons dürfen sich nicht überlappen
assert.ok(HERBST_2026.endsOn < WINTER_2026.startsOn, "keine Überlappung");
count++;

console.log(`✔ ${count} Saison-Prüfungen bestanden`);
