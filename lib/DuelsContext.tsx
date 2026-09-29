"use client";

// Kopf-an-Kopf-Duelle: 1-gegen-1 mit Sterne-Einsatz gegen einen Freund.
// Läuft aktuell als SIMULATION, weil es (noch) kein Backend gibt – der
// Freund tippt nicht wirklich mit, sein Tipp wird deterministisch simuliert
// (gleiches mulberry32-Muster wie simulateOpponents in lib/poolScore.ts) und
// von Anfang an klar als solcher angezeigt. Nur der eigene Sterne-Einsatz
// und -Gewinn sind echt (laufen über spendStars/creditStars aus UserContext).

import { createContext, useContext, useState, ReactNode } from "react";
import { useAppData } from "./AppDataContext";
import { useUser } from "./UserContext";
import { classifyTip, TIER_ORDER } from "./poolScore";
import { Duel } from "./duelTypes";

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DuelsContextValue {
  duels: Duel[];
  // Gibt zurück, wie viele Sterne tatsächlich eingesetzt wurden (0 = Duell
  // konnte nicht erstellt werden, z. B. weil kein Guthaben mehr da war).
  createDuel: (opponentName: string, matchId: string, stake: number) => number;
  resolveDuelsForMatch: (matchId: string, actualHome: number, actualAway: number) => void;
}

const DuelsContext = createContext<DuelsContextValue | null>(null);

export function DuelsProvider({ children }: { children: ReactNode }) {
  const { matches, getTeam, addActivity, myTips } = useAppData();
  const { displayName, spendStars, creditStars } = useUser();
  const [duels, setDuels] = useState<Duel[]>([]);

  function createDuel(opponentName: string, matchId: string, stake: number): number {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return 0;
    if (new Date(match.tipDeadline).getTime() <= Date.now()) return 0;
    if (!opponentName.trim() || opponentName === displayName) return 0;
    if (stake < 1) return 0;

    const actualStake = spendStars(stake);
    if (actualStake <= 0) return 0;

    const rng = mulberry32(hashString(`duel:${matchId}:${opponentName}:${displayName}`));
    let opponentPredictedHome: number;
    let opponentPredictedAway: number;
    let opponentPickLabel: string;

    if (match.tipMode === "1x2") {
      const r = rng();
      const pick: "1" | "X" | "2" = r < 0.4 ? "1" : r < 0.55 ? "X" : "2";
      if (pick === "1") {
        opponentPredictedHome = 1;
        opponentPredictedAway = 0;
        opponentPickLabel = "Heimsieg (1)";
      } else if (pick === "2") {
        opponentPredictedHome = 0;
        opponentPredictedAway = 1;
        opponentPickLabel = "Auswärtssieg (2)";
      } else {
        opponentPredictedHome = 0;
        opponentPredictedAway = 0;
        opponentPickLabel = "Unentschieden (X)";
      }
    } else {
      opponentPredictedHome = Math.floor(rng() * 4);
      opponentPredictedAway = Math.floor(rng() * 4);
      opponentPickLabel = `${opponentPredictedHome}:${opponentPredictedAway}`;
    }

    const duel: Duel = {
      id: `duel-${Date.now()}`,
      opponentName,
      matchId,
      stake: actualStake,
      status: "offen",
      createdAt: new Date().toISOString(),
      opponentPredictedHome,
      opponentPredictedAway,
      opponentPickLabel,
    };
    setDuels((current) => [duel, ...current]);

    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);
    addActivity(
      "⚔️",
      `Du hast ${opponentName} zum Duell herausgefordert (${actualStake} Sterne) bei ${home?.name ?? "?"} vs ${away?.name ?? "?"}.`
    );
    return actualStake;
  }

  // Wird beim Beenden eines Spiels aufgerufen (siehe app/admin/page.tsx). Nur
  // OFFENE Duelle werden verarbeitet, ein zweiter Aufruf (z. B. bei einer
  // späteren Endstand-Korrektur) rührt bereits ausgewertete Duelle nicht an.
  function resolveDuelsForMatch(matchId: string, actualHome: number, actualAway: number) {
    const relevant = duels.filter((d) => d.matchId === matchId && d.status === "offen");
    if (relevant.length === 0) return;

    // Ohne eigenen Tipp zu diesem Spiel lässt sich kein Duell auswerten –
    // bleibt offen, bis doch noch getippt wird (Endstand ändert sich ja nicht
    // mehr rückwirkend in diesem MVP).
    const myTip = myTips.find((t) => t.matchId === matchId);
    if (!myTip) return;

    const match = matches.find((m) => m.id === matchId);
    const home = match ? getTeam(match.homeTeamId) : undefined;
    const away = match ? getTeam(match.awayTeamId) : undefined;
    const myTier = classifyTip(myTip.predictedHomeScore, myTip.predictedAwayScore, actualHome, actualAway);
    const myOrder = TIER_ORDER[myTier];

    let totalCredited = 0;
    const updates = relevant.map((duel) => {
      const opponentTier = classifyTip(duel.opponentPredictedHome, duel.opponentPredictedAway, actualHome, actualAway);
      const oppOrder = TIER_ORDER[opponentTier];

      let result: Duel["result"];
      let starsCredited: number;
      if (myOrder > oppOrder) {
        result = "gewonnen";
        starsCredited = duel.stake * 2;
      } else if (myOrder < oppOrder) {
        result = "verloren";
        starsCredited = 0;
      } else {
        result = "unentschieden";
        starsCredited = duel.stake;
      }
      totalCredited += starsCredited;

      addActivity(
        result === "gewonnen" ? "🏆" : result === "verloren" ? "⚔️" : "🤝",
        result === "gewonnen"
          ? `Duell gegen ${duel.opponentName} gewonnen – +${starsCredited - duel.stake} Sterne (${home?.name ?? "?"} vs ${away?.name ?? "?"}).`
          : result === "verloren"
          ? `Duell gegen ${duel.opponentName} verloren – ${duel.stake} Sterne weg (${home?.name ?? "?"} vs ${away?.name ?? "?"}).`
          : `Duell gegen ${duel.opponentName} unentschieden – Einsatz zurück (${home?.name ?? "?"} vs ${away?.name ?? "?"}).`
      );

      return { ...duel, status: "ausgewertet" as const, myTier, opponentTier, result, starsCredited };
    });

    setDuels((current) => current.map((d) => updates.find((u) => u.id === d.id) ?? d));
    if (totalCredited > 0) creditStars(totalCredited);
  }

  return (
    <DuelsContext.Provider value={{ duels, createDuel, resolveDuelsForMatch }}>
      {children}
    </DuelsContext.Provider>
  );
}

export function useDuels() {
  const context = useContext(DuelsContext);
  if (!context) {
    throw new Error("useDuels muss innerhalb von <DuelsProvider> verwendet werden");
  }
  return context;
}
