// Rechentest für die Sterne-Auswertung (lib/poolScore.ts).
// Ausführen: npm run test:sterne
import assert from "node:assert/strict";
import {
  evaluatePoolScore,
  compareWithOthers,
  DAILY_STAKE_BUDGET,
  RESCUE_BONUS_STARS,
  stakeBudgetAfterRefund,
} from "../lib/poolScore.ts";

let count = 0;
function check(name, params, expected) {
  const r = evaluatePoolScore(params);
  assert.equal(r.tier, expected.tier, `${name}: Ergebnis`);
  assert.equal(r.starsCredit, expected.credit, `${name}: zurück`);
  assert.equal(r.starsNet, expected.net, `${name}: netto`);
  assert.equal(r.rangDelta, expected.rang, `${name}: Rangpunkte`);
  assert.ok(Number.isInteger(r.starsCredit), `${name}: ganze Sterne`);
  count++;
}

// Ergebnis-Tipp, Endstand 2:1
for (const [stake, exakt, falsch] of [
  [10, 15, 5],
  [20, 30, 10],
  [40, 60, 20],
]) {
  const base = { actualHome: 2, actualAway: 1, stake };
  check(`Ergebnis ${stake} exakt`, { ...base, predictedHome: 2, predictedAway: 1 }, { tier: "exakt", credit: exakt, net: exakt - stake, rang: 10 });
  check(`Ergebnis ${stake} Tendenz`, { ...base, predictedHome: 3, predictedAway: 0 }, { tier: "tendenz", credit: stake, net: 0, rang: 6 });
  check(`Ergebnis ${stake} falsch`, { ...base, predictedHome: 0, predictedAway: 2 }, { tier: "falsch", credit: falsch, net: falsch - stake, rang: 0 });
  check(`Ergebnis ${stake} Remis Tendenz`, { ...base, actualHome: 1, actualAway: 1, predictedHome: 0, predictedAway: 0 }, { tier: "tendenz", credit: stake, net: 0, rang: 6 });
}

// 1X2: Tipp "1" wird als 1:0 gespeichert, "X" als 0:0, "2" als 0:1.
// Richtig = Einsatz + 50 %, falsch = Hälfte zurück. Kein "exakt", auch wenn
// das Spiel zufällig genau 1:0 / 0:0 / 0:1 endet.
for (const [stake, richtig, falsch] of [
  [10, 15, 5],
  [20, 30, 10],
  [40, 60, 20],
]) {
  const t = { stake, isOneXTwo: true };
  check(`1X2 ${stake} Heimsieg 3:1`, { ...t, predictedHome: 1, predictedAway: 0, actualHome: 3, actualAway: 1 }, { tier: "tendenz", credit: richtig, net: richtig - stake, rang: 6 });
  check(`1X2 ${stake} Heimsieg genau 1:0`, { ...t, predictedHome: 1, predictedAway: 0, actualHome: 1, actualAway: 0 }, { tier: "tendenz", credit: richtig, net: richtig - stake, rang: 6 });
  check(`1X2 ${stake} Remis genau 0:0`, { ...t, predictedHome: 0, predictedAway: 0, actualHome: 0, actualAway: 0 }, { tier: "tendenz", credit: richtig, net: richtig - stake, rang: 6 });
  check(`1X2 ${stake} Auswärts genau 0:1`, { ...t, predictedHome: 0, predictedAway: 1, actualHome: 0, actualAway: 1 }, { tier: "tendenz", credit: richtig, net: richtig - stake, rang: 6 });
  check(`1X2 ${stake} falsch`, { ...t, predictedHome: 1, predictedAway: 0, actualHome: 2, actualAway: 2 }, { tier: "falsch", credit: falsch, net: falsch - stake, rang: 0 });
}

// Einsatz 0 (Tages-Limit oder Guthaben aufgebraucht): keine Sterne-Bewegung.
check("Einsatz 0 exakt", { stake: 0, predictedHome: 1, predictedAway: 1, actualHome: 1, actualAway: 1 }, { tier: "exakt", credit: 0, net: 0, rang: 10 });
// Gekürzter, ungerader Einsatz wird auf ganze Sterne gerundet.
check("Einsatz 7 exakt", { stake: 7, predictedHome: 1, predictedAway: 0, actualHome: 1, actualAway: 0 }, { tier: "exakt", credit: 11, net: 4, rang: 10 });
check("Einsatz 7 falsch", { stake: 7, predictedHome: 1, predictedAway: 0, actualHome: 0, actualAway: 1 }, { tier: "falsch", credit: 4, net: -3, rang: 0 });

// Vergleich mit Mitspielern bei 1X2: zwei gleiche Tipps sind gleich gut,
// auch wenn das Spiel genau 1:0 endet.
const cmp = compareWithOthers("tendenz", [{ predictedHome: 1, predictedAway: 0 }, { predictedHome: 0, predictedAway: 0 }], 1, 0, true);
assert.deepEqual(cmp, { beaten: 1, tied: 1, ahead: 0, total: 2 });
count++;

// Tages-Limit 100: bei 40 pro Spiel 40 + 40 + 20 + 0.
let left = DAILY_STAKE_BUDGET;
const stakes = [40, 40, 40, 40].map((s) => {
  const actual = Math.min(s, left);
  left -= actual;
  return actual;
});
assert.deepEqual(stakes, [40, 40, 20, 0]);
assert.equal(RESCUE_BONUS_STARS, 20);
count++;

// Abgesagtes Spiel: erstatteter Einsatz zählt nicht mehr gegen das Tages-Limit.
const now = "2026-10-02T12:00:00.000Z";
const heute = { stakedToday: 100, stakeBudgetDay: "2026-10-02T09:00:00.000Z", refundedTipIds: [] };
const tipHeute = { id: "t1", stake: 40, submittedAt: "2026-10-02T10:00:00.000Z" };
const nach1 = stakeBudgetAfterRefund(heute, tipHeute, now);
assert.equal(nach1.stakedToday, 60, "40 zurück ins Tages-Limit");
assert.deepEqual(nach1.refundedTipIds, ["t1"]);
// Zweimal (Neuladen, zweiter Tab): nichts doppelt.
assert.equal(stakeBudgetAfterRefund(nach1, tipHeute, now), nach1, "nie doppelt");
// Tipp von gestern: Limit von heute bleibt, Tipp wird nur gemerkt.
const nach2 = stakeBudgetAfterRefund(heute, { id: "t2", stake: 20, submittedAt: "2026-10-01T10:00:00.000Z" }, now);
assert.equal(nach2.stakedToday, 100);
assert.deepEqual(nach2.refundedTipIds, ["t2"]);
// Nie unter 0.
assert.equal(stakeBudgetAfterRefund({ ...heute, stakedToday: 10 }, tipHeute, now).stakedToday, 0);
// Limit-Tag ist schon vorbei: nichts abziehen.
assert.equal(
  stakeBudgetAfterRefund({ ...heute, stakeBudgetDay: "2026-10-01T09:00:00.000Z" }, tipHeute, now).stakedToday,
  100
);
count += 5;

console.log(`OK – ${count} Sterne-Rechnungen stimmen.`);
