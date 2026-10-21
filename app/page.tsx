"use client";

import EmptyState from "@/components/EmptyState";
import { viennaDateKey } from "@/lib/seasons/schedule";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MatchCard from "@/components/MatchCard";
import { SPORT_BADGE } from "@/lib/cardStyle";
import AdBanner from "@/components/AdBanner";
import WeeklyReviewCard from "@/components/WeeklyReviewCard";
import { StreakHint } from "@/components/StreakChip";
import BeginnerShieldHint from "@/components/BeginnerShieldHint";
import HomeGreeting from "@/components/HomeGreeting";
import LiveStrip from "@/components/LiveStrip";
import HomeTipBar from "@/components/HomeTipBar";
import { useUser } from "@/lib/UserContext";
import { useJokers } from "@/lib/JokerContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { BOOSTER_STAKE } from "@/lib/poolScore";
import { Match, isSportActive } from "@/lib/types";
import { DayGroup, deadlineText, groupMatchesByDay } from "@/lib/dayGroups";
import { HomeTab, autoHomeTab, homeTabOf, splitHomeTabs } from "@/lib/matchTabs";
import { displayOrder } from "@/lib/teamOrder";
import { useStreak } from "@/lib/streak";
import { readPendingInvite } from "@/lib/leagueInvite";
import { useMyClubs } from "@/lib/clubs";
import { peekLiveScore, useLiveStoreVersion } from "@/lib/useLiveScores";
import { isLiveFinished } from "@/lib/liveScores";

export default function DashboardPage() {
  const { placeTip, refreshStars, isRegistered, startDone, authUserId, sessionChecked } = useUser();
  const { reloadJokers } = useJokers();
  const { orderFor, matches, getTeam, tipCounts, withdrawTip, myTips, myTipsLoaded, contentLoaded, matchesLoadFailed } = useAppData();
  const streak = useStreak();
  // Bei neuen Live-Daten neu rendern (für "Gerade beendet" unten).
  useLiveStoreVersion();
  // Herzensvereine EINMAL für die ganze Seite laden (nicht pro Karte: jeder
  // Aufruf holt die Daten und öffnet einen eigenen Realtime-Kanal).
  const { clubs: myClubs, playForClubs } = useMyClubs(authUserId);
  const router = useRouter();

  // Neu registriert (noch kein Tipp, Start-Erlebnis weder fertig noch
  // übersprungen): einmal zum Start-Erlebnis. Nicht, wenn man gerade über
  // einen Tipprunden-Link kommt.
  useEffect(() => {
    if (!isRegistered || startDone !== false || !myTipsLoaded || myTips.length > 0) return;
    if (readPendingInvite()) return;
    router.replace("/start");
  }, [isRegistered, startDone, myTipsLoaded, myTips.length, router]);

  // Vom Start-Erlebnis vorgeschlagenes Spiel (/?spiel=…): hinrollen und
  // kurz umranden.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const scrolledRef = useRef(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("spiel");
    if (!id) return;
    setHighlightId(id);
    const timer = window.setTimeout(() => setHighlightId(null), 6000);
    return () => window.clearTimeout(timer);
  }, []);
  const { showToast, celebrate } = useFeedback();
  // Reiter Tippen/Live/Beendet (Rene, 18.10.2026: Tippen/Live/Beendet).
  // null = noch nicht gewählt: beim Öffnen wählt die Seite EINMAL nach Renes
  // Regel (autoHomeTab), danach bleibt der Reiter, bis der Spieler umschaltet –
  // ändert sich die Lage, werden nur die Zahlen neu, es springt nichts um.
  // Kein Speichern über Besuche hinweg.
  const [chosenTab, setTab] = useState<HomeTab | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Klick aufs Logo: Reiter wieder nach der Regel wählen und nach oben.
  useEffect(() => {
    function onLogo() {
      setPinned({});
      setTab(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener("pooltipp:logo", onLogo);
    return () => window.removeEventListener("pooltipp:logo", onLogo);
  }, []);
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

  async function handleSubmitTip(match: Match, homeScore: number, awayScore: number, booster = false) {
    // Den Einsatz (nur mit eingeschaltetem Booster, fest 20) zieht die Datenbank ab.
    const withBooster = !!match.booster && booster;
    const saved = await placeTip(match.id, homeScore, awayScore, withBooster);
    if (!saved) {
      showToast(
        withBooster
          ? `Tipp konnte nicht gespeichert werden – Tippschluss erreicht, schon getippt oder weniger als ${BOOSTER_STAKE} Coins.`
          : "Tipp konnte nicht gespeichert werden – Tippschluss erreicht oder schon getippt.",
        "info"
      );
      return;
    }
    setPinned((p) => ({ [match.id]: "offen", ...p }));
    celebrate();
    showToast(withBooster ? `✓ Booster-Tipp gespeichert – ${BOOSTER_STAKE} Coins eingesetzt, viel Glück!` : "✓ Tipp gespeichert – viel Glück!");
  }

  // "Ändern": der Tipp wird in der Datenbank zurückgenommen, die Karte ist
  // danach auf jedem Gerät leer. Einsatz und Joker kommen zurück.
  async function handleWithdrawTip(matchId: string) {
    const result = await withdrawTip(matchId);
    if (!result) {
      showToast("Tippschluss – der Tipp kann nicht mehr geändert werden.", "info");
      return false;
    }
    setPinned((p) => ({ [matchId]: "getippt", ...p }));
    refreshStars();
    void reloadJokers();
    const extras = [
      result.refunded > 0 ? `${result.refunded} Coins sind zurück` : null,
      result.joker ? "dein Joker liegt wieder im Vorrat" : null,
      result.gutschein ? "dein Booster-Gutschein liegt wieder im Vorrat" : null,
    ].filter(Boolean);
    showToast(
      `Tipp zurückgenommen${extras.length ? ` – ${extras.join(", ")}` : ""}. Gib jetzt deinen neuen Tipp ab.`,
      "info"
    );
    return true;
  }

  // Spiele, deren Team fehlt (z. B. gelöscht), zeigt die Seite nicht an, also
  // zählen sie auch nicht. Spiele ausgeblendeter Sportarten (HIDDEN_SPORTS in
  // lib/types.ts) ebenfalls nicht.
  const shownMatches = matches.filter(
    (m) => isSportActive(m.sport) && getTeam(m.homeTeamId) && getTeam(m.awayTeamId)
  );

  // Laut Live-Daten abgepfiffen, in der App aber noch ohne Endstand
  // (Rene, 15.10.2026): steht nicht mehr unter "Läuft gerade", sondern unter
  // "Gerade beendet · Wertung folgt". Mit Endstand ist es ohnehin unter
  // "Beendet" wie bisher.
  function liveFinished(m: Match): boolean {
    if (m.status === "finished" && m.liveHomeScore !== null && m.liveAwayScore !== null) return false;
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);
    if (!home || !away) return false;
    const live = peekLiveScore(m, home.name, away.name);
    return !!live && isLiveFinished(live.status);
  }

  // Einteilung in Tippen/Live/Beendet (Regel und Test in lib/matchTabs.ts,
  // Rene, 18.10.2026: Tippen/Live/Beendet). Ohne Live-Daten gilt: Anpfiff
  // vorbei und kein Endstand = läuft.
  const split = splitHomeTabs(shownMatches, now, (m) => !!findTipForMatch(m.id), liveFinished);
  const toTip = split.offen.length;
  // Reiter "Tipps x/y": getippte von allen noch tippbaren Spielen (Rene, 19.10.2026).
  const tipTabDone = split.getippt.length;
  const tipTabTotal = split.offen.length + split.getippt.length;
  const running = split.laeuft.length;
  // Erst wählen, wenn Spiele, Uhr und (eingeloggt) die eigenen Tipps da sind,
  // sonst stünde beim Öffnen kurz der falsche Reiter da.
  // Hängt das Laden der Tipps, nach 5 s trotzdem zeigen statt ewig "lädt".
  const [tipsWaitOver, setTipsWaitOver] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTipsWaitOver(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  const ready = contentLoaded && now !== null && (tipsWaitOver || (sessionChecked && (!authUserId || myTipsLoaded)));
  // Vom Start-Erlebnis vorgeschlagenes Spiel: dessen Reiter zuerst.
  const autoTab =
    highlightId && shownMatches.some((m) => m.id === highlightId) ? homeTabOf(split, highlightId) : autoHomeTab(split);
  useEffect(() => {
    if (ready && chosenTab === null) setTab(autoTab);
  }, [ready, chosenTab, autoTab]);
  const tab: HomeTab = chosenTab ?? autoTab;
  // Karte erst suchen, wenn der Reiter steht (sonst ist sie noch nicht da).
  useEffect(() => {
    if (!highlightId || !ready || scrolledRef.current) return;
    const card = document.getElementById(`spiel-${highlightId}`);
    if (!card) return;
    scrolledRef.current = true;
    const header = document.querySelector("[data-pull-anchor]");
    const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 12;
    window.scrollBy({ top: card.getBoundingClientRect().top - top, behavior: "smooth" });
  }, [highlightId, ready, tab, matches]);

  // Gerade getippt oder zurückgenommen: die Karte bleibt in ihrer Gruppe
  // ("Noch offen" bzw. "Schon getippt"), statt beim Tippen wegzuspringen.
  // Beim nächsten Reiterwechsel wird neu einsortiert. Die Zahlen stimmen sofort.
  const [pinned, setPinned] = useState<Record<string, "offen" | "getippt">>({});
  function selectTab(next: HomeTab | null) {
    setPinned({});
    setTab(next);
  }

  // Reiter wechseln und die Reiter-Leiste unter die angeheftete Kopfzeile holen.
  function goToTab(next: HomeTab) {
    selectTab(next);
    const tabs = tabsRef.current;
    if (!tabs) return;
    const header = document.querySelector("[data-pull-anchor]");
    const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 8;
    window.scrollBy({ top: tabs.getBoundingClientRect().top - top, behavior: "smooth" });
  }

  // Live-Streifen antippen (auf Tippen/Beendet): zum Reiter Live, dann zur Karte.
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  useEffect(() => {
    if (!scrollToId) return;
    setScrollToId(null);
    document.getElementById(`spiel-${scrollToId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollToId]);

  // Top-Spiel für die Bühne ganz oben im Reiter Tippen: nur das vom Admin
  // gewählte Topspiel (das nächste davon, auf das man noch tippen kann). Ist
  // keins gewählt, gibt es keine Bühne, nur die normale Liste (Rene,
  // 09.10.2026). Es steht dann nicht noch einmal in der Liste darunter.
  // Bis zu zwei Topspiele oben: das nächste Topspiel und ein weiteres vom
  // selben Tag (am PC nebeneinander, am Handy untereinander – Rene
  // 11.10.2026). Topspiele späterer Tage kommen erst an ihrem Tag nach oben.
  const tippable = [...split.offen, ...split.getippt].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const firstTop = tab === "tippen" ? tippable.find((m) => m.topMatch) ?? null : null;
  const stageMatches = firstTop
    ? tippable
        .filter((m) => m.topMatch && viennaDateKey(new Date(m.kickoff)) === viennaDateKey(new Date(firstTop.kickoff)))
        .slice(0, 2)
    : [];
  const stageIds = new Set(stageMatches.map((m) => m.id));
  const notOnStage = (list: Match[]) => (stageIds.size ? list.filter((m) => !stageIds.has(m.id)) : list);

  // "Alles getippt – nächstes Spiel in 2 Std. 14 Min." (unter 3 Std.) bzw.
  // "um 21:00" / "Sa. 15:30" (Rene, 20.10.2026).
  const nextKickoff = tippable[0] ? Date.parse(tippable[0].kickoff) : null;
  const nextKickoffText = (() => {
    if (nextKickoff === null || now === null) return null;
    const ms = nextKickoff - now;
    if (ms <= 0) return null;
    if (ms < 3 * 60 * 60 * 1000) {
      const h = Math.floor(ms / 3_600_000);
      const min = Math.floor((ms % 3_600_000) / 60_000);
      return h > 0 ? `in ${h} Std. ${min} Min.` : `in ${Math.max(1, min)} Min.`;
    }
    const when = deadlineText(nextKickoff, now);
    return /^\d/.test(when) ? `um ${when}` : when;
  })();

  // Nächster Tippschluss eines noch nicht getippten Spiels ("12:30" bzw.
  // "Sa. 15:30") für die Leiste über den Reitern und "Noch offen".
  const next = split.offen[0] && now !== null ? deadlineText(Date.parse(split.offen[0].tipDeadline), now) : null;

  // Gruppen je Reiter. Tippen: "Noch offen" und "✓ Schon getippt", darin nach
  // Tag ("Heute", "Morgen" …). Live: "Läuft gerade", "Tippschluss vorbei ·
  // beginnt gleich", "Gerade beendet · Wertung folgt". Beendet: nach Tag.
  // Ohne Spiele-Anzahl: die steht schon im Reiter (Rene, 18.10.2026).
  type Section = { key: string; label: string; sub?: string; dot?: boolean; days: DayGroup<Match>[] };
  const byDay = (list: Match[]) => groupMatchesByDay(list, now, "offen");
  const flat = (list: Match[]) => (list.length ? [{ key: "alle", label: "", sub: "", matches: list }] : []);
  const groupOf = (m: Match) => pinned[m.id] ?? (findTipForMatch(m.id) ? "getippt" : "offen");
  const byDeadline = (a: Match, b: Match) => Date.parse(a.tipDeadline) - Date.parse(b.tipDeadline);
  const offenList = notOnStage(tippable.filter((m) => groupOf(m) === "offen")).sort(byDeadline);
  const getipptList = notOnStage(tippable.filter((m) => groupOf(m) === "getippt")).sort(byDeadline);
  const offenNext = offenList[0] && now !== null ? deadlineText(Date.parse(offenList[0].tipDeadline), now) : null;
  const sections: Section[] =
    tab === "tippen"
      ? [
          ...(offenList.length ? [{ key: "offen", label: "Noch offen", sub: offenNext ? `nächster Tippschluss ${offenNext}` : undefined, days: byDay(offenList) }] : []),
          ...(getipptList.length
            ? [{ key: "getippt", label: "✓ Schon getippt", sub: "bis Tippschluss änderbar", days: byDay(getipptList) }]
            : []),
        ]
      : tab === "live"
        ? [
            ...(split.laeuft.length ? [{ key: "laeuft", label: "Läuft gerade", dot: true, days: flat(split.laeuft) }] : []),
            ...(split.gleich.length
              ? [{ key: "gleich", label: "🔒 Tippschluss vorbei", sub: "beginnt gleich", days: flat(split.gleich) }]
              : []),
            ...(split.geradeBeendet.length
              ? [{ key: "gerade-beendet", label: "Gerade beendet", sub: "Wertung folgt", days: flat(split.geradeBeendet) }]
              : []),
          ]
        : split.beendet.length
          ? [{ key: "beendet", label: "", days: groupMatchesByDay(split.beendet, now, "geschlossen") }]
          : [];

  // Laufende Spiele als Streifen über den Reitern Tippen und Beendet
  // (Spielstand kommt live mit), laut Live-Daten schon abgepfiffene nicht
  // mehr (Rene, 15.10.2026). Im Reiter Live stehen sie als Karten mit
  // Anzeigetafel, dort kein Streifen (Rene, 18.10.2026: Tippen/Live/Beendet).
  const liveItems = tab === "live" ? [] : split.laeuft
    .filter((m) => m.status === "live")
    .map((m) => {
      const tip = findTipForMatch(m.id);
      const [l, r] = tip ? displayOrder(orderFor(m), tip.predictedHomeScore, tip.predictedAwayScore) : [0, 0];
      return {
        match: m,
        home: getTeam(m.homeTeamId)!,
        away: getTeam(m.awayTeamId)!,
        myTip: tip ? (m.tipMode === "1x2" ? "✓" : `${l} : ${r}`) : null,
      };
    });

  function renderCard(match: Match, stage = false) {
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
        fanTeamId={playForClubs ? myClubs?.[match.sport]?.teamId ?? null : null}
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
                beginnerShielded: tip.beginnerShielded,
                rankingScored: tip.rankingScored,
                rankingLegacy: tip.rankingLegacy,
                stake: tip.stake,
                refunded: tip.refunded,
                gutschein: tip.gutschein,
              }
            : undefined
        }
        onSubmitTip={(homeScore, awayScore, booster) => handleSubmitTip(match, homeScore, awayScore, booster)}
        onWithdrawTip={() => handleWithdrawTip(match.id)}
        highlight={match.id === highlightId}
        stage={stage}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-4 py-5 sm:px-5 sm:py-8">
      {/* Am Handy px-4 statt px-5: 8 px mehr Kartenbreite für die Vereinsnamen (Rene, 15.10.2026). */}
      {/* Kompakter Titel statt großer Headline + Untertitel – die
          Sterne-Anzahl steht schon oben in der Navbar, das musste hier
          nicht wiederholt werden. Die Werbe-Platzhalterzeile steht jetzt in
          derselben Zeile rechts daneben statt in einer eigenen Zeile darunter
          – spart eine ganze Zeile Höhe, bevor die eigentlichen Spiele
          kommen. Am Handy (zu schmal für eine Zeile) fällt sie automatisch
          darunter. */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <HomeGreeting streak={streak} />

        <AdBanner />
      </div>
      {streak.status !== "none" && (
        <div className="-mt-3 mb-5">
          <StreakHint streak={streak} />
        </div>
      )}
      {/* Anfänger-Schutz: noch X von 10 Tipps insgesamt ohne Punktabzug (Rene, 15.10.2026) */}
      <BeginnerShieldHint className="-mt-3 mb-5" />

      {/* Gäste: Hinweis "Zum Tippen einloggen". Erst wenn alles geladen ist. */}
      {ready && sessionChecked && !authUserId && (
        <HomeTipBar guest toTip={toTip} next={next} tab={tab} onGo={goToTab} />
      )}

      <WeeklyReviewCard />

      {/* Bis die echten Spiele (und eingeloggt die eigenen Tipps) geladen
          sind, stehen nur Demo-Spiele im Speicher. Erst danach wird der
          Reiter gewählt, sonst blitzt kurz der falsche auf. */}
      {!ready ? (
        <p className="py-8 text-center text-sm text-muted">
          {matchesLoadFailed
            ? "Spiele konnten nicht geladen werden – bitte die Seite neu laden."
            : "Spiele werden geladen …"}
        </p>
      ) : (
      <>
      <LiveStrip
        items={liveItems}
        onSelect={(id) => {
          selectTab("live");
          setScrollToId(id);
        }}
      />
      {/* Eingeloggt: schmale Zeile "Noch N offene Tipps · nächster
          Tippschluss" nur auf Live/Beendet (Rene, 18.10.2026). */}
      {sessionChecked && authUserId && (
        <HomeTipBar guest={false} toTip={toTip} next={next} tab={tab} onGo={goToTab} />
      )}
      <div ref={tabsRef} className="mb-5 flex gap-5 border-b border-edge" role="tablist">
        <TabButton active={tab === "tippen"} onClick={() => selectTab("tippen")}>
          {/* "Tipps 4/5" = 4 von 5 Spielen in diesem Reiter getippt; ohne
              Spiele nur "Tipps" (Rene, 19.10.2026). */}
          Tipps{" "}
          {tipTabTotal > 0 && (
            <span className={toTip > 0 ? "text-gold" : "text-muted"} aria-label={`${tipTabDone} von ${tipTabTotal} getippt`}>
              {tipTabDone}/{tipTabTotal}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "live"} onClick={() => selectTab("live")}>
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${running > 0 ? "animate-pulse bg-red-500" : "bg-edge"}`}
          />
          Live <span className={running > 0 ? "text-red-400" : "text-muted"}>({running})</span>
        </TabButton>
        <TabButton active={tab === "beendet"} onClick={() => selectTab("beendet")}>
          Beendet
        </TabButton>
      </div>

      {stageMatches.length > 0 && (
        <div className={`mb-7 grid gap-5 ${stageMatches.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {stageMatches.map((m) => renderCard(m, true))}
        </div>
      )}

      {/* Leerzustände je Reiter (Rene, 18.10.2026: Tippen/Live/Beendet). */}
      {tab === "tippen" && split.offen.length === 0 && (
        <EmptyState
          className="mb-7"
          emoji="✅"
          title={nextKickoffText ? `Alles getippt – nächstes Spiel ${nextKickoffText}` : "Alles getippt"}
          text={
            tippable.length > 0
              ? "Deine Tipps siehst du unten und kannst sie bis zum Tippschluss ändern. Neue Spiele erscheinen hier, sobald sie angesetzt sind."
              : "Neue Spiele erscheinen hier, sobald sie angesetzt sind. Schau solange im Matchcenter vorbei."
          }
          action={tippable.length > 0 ? undefined : { href: "/matchcenter", label: "Zum Matchcenter" }}
        />
      )}
      {tab === "live" && sections.length === 0 && (
        <EmptyState
          emoji="📺"
          title="Gerade läuft kein Spiel."
          text={toTip > 0 ? "Bis zum Anpfiff kannst du noch tippen." : "Sobald ein Spiel angepfiffen ist, siehst du es hier mit Spielstand."}
        />
      )}
      {tab === "beendet" && sections.length === 0 && (
        <EmptyState
          emoji="🏁"
          title="Noch keine beendeten Spiele"
          text="Sobald ein Spiel ausgewertet ist, siehst du hier deine Punkte."
        />
      )}

      {/* Gruppen des Reiters, darin Abschnitte nach Tag ("Heute", "Morgen" …),
          Reihenfolge wie in lib/matchTabs.ts. Am PC je Abschnitt drei Spalten. */}
      <div className="flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.key} aria-label={section.label || undefined} className="flex flex-col gap-5">
            {section.label && (
              <h2 className={`${SPORT_BADGE ? "mb-0" : "-mb-1"} flex items-baseline gap-2 px-0.5`}>
                {section.dot && (
                  <span className="relative top-[-1px] h-2 w-2 shrink-0 animate-pulse self-center rounded-full bg-red-500" aria-hidden />
                )}
                <span className="font-display text-base font-bold text-ink">{section.label}</span>
                {section.sub && <span className="text-xs text-muted">· {section.sub}</span>}
              </h2>
            )}
            {/* Mit SPORT_BADGE ragt das Abzeichen 14 px über die Karte, daher
                über den Karten etwas mehr Luft (Rene, 19.10.2026:
                Sportart-Abzeichen, Schalter SPORT_BADGE). */}
            {section.days.map((day) => (
              <div key={day.key}>
                {day.label && (
                  <h3 className={`${SPORT_BADGE ? "mb-5" : "mb-3"} flex items-baseline gap-2 px-0.5 ${section.label ? "text-xs font-semibold uppercase tracking-wide text-muted" : ""}`}>
                    <span className={section.label ? "" : "font-display text-base font-bold text-ink"}>{day.label}</span>
                    {day.sub && <span className="text-xs font-normal normal-case tracking-normal text-muted">{day.sub}</span>}
                  </h3>
                )}
                {/* Am PC wieder drei Karten nebeneinander: Seit die Vereine
                    untereinander stehen (Variante B), passen die Namen auch in
                    schmalere Karten (Rene, 15.10.2026). */}
                <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:gap-5">{day.matches.map((m) => renderCard(m))}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
      </>
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-1 pb-2.5 font-display text-sm font-semibold transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />}
    </button>
  );
}
