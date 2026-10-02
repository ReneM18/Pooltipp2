"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";
import AdBanner from "@/components/AdBanner";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";

export default function DashboardPage() {
  const { spendStars, recordTipSubmitted, streakCount, displayName } = useUser();
  const { matches, getTeam, tipCounts, submitTip, changeTip, myTips } = useAppData();
  const { showToast, celebrate } = useFeedback();
  const [tab, setTab] = useState<"offen" | "geschlossen">("offen");

  function findTipForMatch(matchId: string) {
    return [...myTips].reverse().find((t) => t.matchId === matchId);
  }

  function handleSubmitTip(matchId: string, stake: number, homeScore: number, awayScore: number) {
    // Sicherheitsnetz: spendStars zieht nie mehr ab, als vorhanden ist – der
    // tatsächlich abgezogene (ggf. reduzierte) Betrag ist der Einsatz, der
    // gespeichert und bei der Auswertung berücksichtigt wird.
    const actualStake = spendStars(stake);
    recordTipSubmitted();
    submitTip(matchId, homeScore, awayScore, actualStake, displayName);
    celebrate();
    showToast(
      actualStake < stake
        ? "✓ Tipp gespeichert – mit reduziertem Einsatz (Sterne-Guthaben oder Tages-Limit erreicht)."
        : "✓ Tipp gespeichert – viel Glück!"
    );
  }

  function handleChangeTip(matchId: string, homeScore: number, awayScore: number) {
    // Kein spendStars: der Einsatz wurde schon bei der Abgabe bezahlt.
    if (changeTip(matchId, homeScore, awayScore)) {
      showToast("✓ Tipp geändert – Einsatz bleibt gleich, keine Sterne abgezogen.");
    } else {
      showToast("Tippschluss – der Tipp kann nicht mehr geändert werden.", "info");
    }
  }

  // Das Spiel mit dem nächsten Anpfiff steht immer ganz oben.
  const byKickoffAsc = (a: (typeof matches)[number], b: (typeof matches)[number]) =>
    new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();

  // Abgesagte Spiele stehen bei den geschlossenen (nicht mehr tippbar).
  const isClosed = (m: (typeof matches)[number]) => m.status === "finished" || m.status === "cancelled";
  const offeneMatches = matches.filter((m) => !isClosed(m)).sort(byKickoffAsc);
  const geschlosseneMatches = matches.filter(isClosed).sort(byKickoffAsc);
  const visibleMatches = tab === "offen" ? offeneMatches : geschlosseneMatches;

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-5 sm:py-8">
      {/* Kompakter Titel statt großer Headline + Untertitel – die
          Sterne-Anzahl steht schon oben in der Navbar, das musste hier
          nicht wiederholt werden. Die Werbe-Platzhalterzeile steht jetzt in
          derselben Zeile rechts daneben statt in einer eigenen Zeile darunter
          – spart eine ganze Zeile Höhe, bevor die eigentlichen Spiele
          kommen. Am Handy (zu schmal für eine Zeile) fällt sie automatisch
          darunter. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex shrink-0 items-center gap-2.5">
          <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">
            Spieltag
          </h1>
          {streakCount > 0 && (
            <span
              title="Aufeinanderfolgende Tage mit mindestens einem Tipp"
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 font-display text-xs font-bold text-gold"
            >
              🔥 {streakCount} {streakCount === 1 ? "Tag" : "Tage"} in Folge
            </span>
          )}
        </div>

        <AdBanner />
      </div>

      <div className="mb-5 flex gap-2 border-b border-edge">
        <TabButton
          label="Offene Tipps"
          count={offeneMatches.length}
          active={tab === "offen"}
          onClick={() => setTab("offen")}
        />
        <TabButton
          label="Geschlossene Tipps"
          count={geschlosseneMatches.length}
          active={tab === "geschlossen"}
          onClick={() => setTab("geschlossen")}
        />
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-5">
        {visibleMatches.length === 0 && (
          <p className="py-8 text-center text-sm text-muted lg:col-span-3">
            {tab === "offen" ? "Aktuell keine offenen Spiele." : "Noch keine beendeten Spiele."}
          </p>
        )}
        {visibleMatches.map((match) => {
          const homeTeam = getTeam(match.homeTeamId);
          const awayTeam = getTeam(match.awayTeamId);
          if (!homeTeam || !awayTeam) return null;
          const tip = findTipForMatch(match.id);

          return (
            <MatchCard
              key={match.id}
              match={match}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              tipCount={tipCounts[match.id] ?? 0}
              myTip={
                tip
                  ? {
                      predictedHomeScore: tip.predictedHomeScore,
                      predictedAwayScore: tip.predictedAwayScore,
                      evaluated: tip.evaluated,
                      resultTier: tip.resultTier,
                      rangDelta: tip.rangDelta,
                      starsDelta: tip.starsDelta,
                      narration: tip.narration,
                      stake: tip.stake,
                      refunded: tip.refunded,
                    }
                  : undefined
              }
              onSubmitTip={(homeScore, awayScore) =>
                handleSubmitTip(match.id, match.fixedStake, homeScore, awayScore)
              }
              onChangeTip={(homeScore, awayScore) => handleChangeTip(match.id, homeScore, awayScore)}
            />
          );
        })}
      </div>
    </main>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-1 pb-2.5 font-display text-sm font-semibold transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs ${
          active ? "bg-gold text-pitch" : "bg-surface-hover text-muted"
        }`}
      >
        {count}
      </span>
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />}
    </button>
  );
}
