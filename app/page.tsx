"use client";

import { useEffect, useState } from "react";
import MatchCard from "@/components/MatchCard";
import AdBanner from "@/components/AdBanner";
import { useUser } from "@/lib/UserContext";
import { useJokers } from "@/lib/JokerContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { BOOSTER_STAKE } from "@/lib/poolScore";
import { Match } from "@/lib/types";
import { splitMatchesByTab } from "@/lib/matchTabs";

export default function DashboardPage() {
  const { placeTip, streakCount, refreshStars } = useUser();
  const { reloadJokers } = useJokers();
  const { matches, getTeam, tipCounts, withdrawTip, myTips, contentLoaded, matchesLoadFailed } = useAppData();
  const { showToast, celebrate } = useFeedback();
  // Vom Spieler angeklickter Reiter (null = noch nicht gewählt). Solange
  // nichts gewählt ist, entscheidet die Seite selbst, siehe "tab" unten.
  const [chosenTab, setTab] = useState<"offen" | "geschlossen" | null>(null);
  // Uhrzeit für die Sortierung (erst nach dem Laden im Browser gesetzt,
  // sonst passen Server- und Browser-Ansicht nicht zusammen), jede Minute neu.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function findTipForMatch(matchId: string) {
    return [...myTips].reverse().find((t) => t.matchId === matchId);
  }

  async function handleSubmitTip(match: Match, homeScore: number, awayScore: number) {
    // Den Einsatz (nur bei Booster-Spielen, fest 20) zieht die Datenbank ab.
    const saved = await placeTip(match.id, homeScore, awayScore);
    if (!saved) {
      showToast(
        match.booster
          ? `Tipp konnte nicht gespeichert werden – Tippschluss erreicht, schon getippt oder weniger als ${BOOSTER_STAKE} Coins.`
          : "Tipp konnte nicht gespeichert werden – Tippschluss erreicht oder schon getippt.",
        "info"
      );
      return;
    }
    celebrate();
    showToast(match.booster ? `✓ Booster-Tipp gespeichert – ${BOOSTER_STAKE} Coins eingesetzt, viel Glück!` : "✓ Tipp gespeichert – viel Glück!");
  }

  // "Ändern": der Tipp wird in der Datenbank zurückgenommen, die Karte ist
  // danach auf jedem Gerät leer. Einsatz und Joker kommen zurück.
  async function handleWithdrawTip(matchId: string) {
    const result = await withdrawTip(matchId);
    if (!result) {
      showToast("Tippschluss – der Tipp kann nicht mehr geändert werden.", "info");
      return false;
    }
    refreshStars();
    void reloadJokers();
    const extras = [
      result.refunded > 0 ? `${result.refunded} Coins sind zurück` : null,
      result.joker ? "dein Joker liegt wieder im Vorrat" : null,
    ].filter(Boolean);
    showToast(
      `Tipp zurückgenommen${extras.length ? ` – ${extras.join(", ")}` : ""}. Gib jetzt deinen neuen Tipp ab.`,
      "info"
    );
    return true;
  }

  // Geschlossen erst, wenn der Admin den Endstand eingetragen oder das Spiel
  // abgesagt hat, nie nach Uhrzeit (Regel und Test in lib/matchTabs.ts).
  // Spiele, deren Team fehlt (z. B. gelöscht), zeigt die Seite nicht an, also
  // zählen sie auch nicht als offen.
  const shownMatches = matches.filter((m) => getTeam(m.homeTeamId) && getTeam(m.awayTeamId));
  const { offen: offeneMatches, geschlossen: geschlosseneMatches } = splitMatchesByTab(shownMatches, now);
  // Kein offenes Spiel mehr: gleich die geschlossenen zeigen statt einer
  // leeren Seite. Sobald wieder eins offen ist, stehen die offenen vorne.
  // Hat der Spieler selbst einen Reiter angeklickt, bleibt es dabei.
  const tab =
    chosenTab ?? (offeneMatches.length === 0 && geschlosseneMatches.length > 0 ? "geschlossen" : "offen");
  // Booster-Spiele stehen ganz normal in der Liste (nach Anpfiff sortiert),
  // die Karte selbst zeigt oben, dass es ein Booster ist.
  const visibleMatches = tab === "offen" ? offeneMatches : geschlosseneMatches;

  function renderCard(match: Match) {
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
                rangCalculated: tip.rangCalculated,
                starsDelta: tip.starsDelta,
                narration: tip.narration,
                basePoints: tip.basePoints,
                duelPoints: tip.duelPoints,
                duelsWon: tip.duelsWon,
                duelsDrawn: tip.duelsDrawn,
                duelsLost: tip.duelsLost,
                scoredWithoutDuels: tip.scoredWithoutDuels,
                bonusPoints: tip.bonusPoints,
                opponents: tip.opponents,
                beaten: tip.beaten,
                joker: tip.joker,
                rankingScored: tip.rankingScored,
                rankingLegacy: tip.rankingLegacy,
                stake: tip.stake,
                refunded: tip.refunded,
              }
            : undefined
        }
        onSubmitTip={(homeScore, awayScore) => handleSubmitTip(match, homeScore, awayScore)}
        onWithdrawTip={() => handleWithdrawTip(match.id)}
      />
    );
  }

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

      {/* Bis die echten Spiele geladen sind (nach Einloggen oder Neuladen),
          stehen nur Demo-Spiele im Speicher. Erst danach wird der Reiter
          gewählt, sonst blitzt "Offene Tipps" kurz auf. */}
      {!contentLoaded ? (
        <p className="py-8 text-center text-sm text-muted">
          {matchesLoadFailed
            ? "Spiele konnten nicht geladen werden – bitte die Seite neu laden."
            : "Spiele werden geladen …"}
        </p>
      ) : (
      <>
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

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-5">
        {visibleMatches.length === 0 && (
          <p className="py-8 text-center text-sm text-muted lg:col-span-3">
            {tab === "offen" ? "Aktuell keine offenen Spiele." : "Noch keine beendeten Spiele."}
          </p>
        )}
        {visibleMatches.map(renderCard)}
      </div>
      </>
      )}
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
