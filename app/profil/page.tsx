"use client";

import EmptyState from "@/components/EmptyState";
import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountSettings from "@/components/AccountSettings";
import StartPagePicker from "@/components/StartPagePicker";
import PassDecoSettings from "@/components/PassDecoSettings";
import SaveButton, { SavedHint, useDraft } from "@/components/SaveButton";
import RivalCompareButton from "@/components/RivalCompare";
import { StatsVisibility, useStatsVisibility } from "@/lib/rivals";
import { useOnline } from "@/lib/OnlineContext";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useMyOverallRank } from "@/lib/myOverallRank";
import RankBadge from "@/components/RankBadge";
import { getAllRankIcons, isUnsterblich, prestigeLevel, SPORT_EMOJI } from "@/lib/rankTiers";
import RankProgress from "@/components/RankProgress";
import SeasonFrame from "@/components/SeasonFrame";
import RankMeaningBadge from "@/components/RankMeaningBadge";
import FavoriteClubs from "@/components/FavoriteClubs";
import WelcomeBanner from "@/components/WelcomeBanner";
import FitText from "@/components/FitText";
import PassHonorTags from "@/components/PassHonors";
import { useFeedback } from "@/lib/FeedbackContext";
import { Sport, SPORTS, SPORT_ICONS, sportLabel } from "@/lib/types";
import { SEASON_THEME } from "@/lib/seasonTheme";
import { CURRENT_SEASON } from "@/lib/seasons";
import { xpForLevel } from "@/lib/seasonPass";
import { useSeasonDesign } from "@/lib/seasonDesign";
import { matchTitle, scoreText } from "@/lib/teamOrder";
import { liveTipLabel, livePointsText } from "@/lib/liveTipText";
import { getCurrentWeekWindow, kickoffLookup, sumWeeklyRangDelta, sumWeeklyTipPoints } from "@/lib/weeklyLeaderboard";
import { CoinIcon } from "@/components/CoinIcon";
import { resetDateText } from "@/lib/rankingReset";
import { TIER_BADGE } from "@/components/tierBadges";
import { daysDative, daysLabel, useStreak } from "@/lib/streak";
import Emoji from "@/components/Emoji";
import TippTypCard from "@/components/TippTyp";
import BeginnerShieldHint from "@/components/BeginnerShieldHint";
import HitRateBySport from "@/components/HitRateBySport";
import SportBioCard, { SportBioTag } from "@/components/SportBioCard";
import SportBioEditor from "@/components/SportBioEditor";
import { useSportBio } from "@/lib/sportBio";

const sportIcon: Record<string, string> = SPORT_ICONS;

// Das Profil gibt es nur mit Konto. Gäste (auch direkt nach dem Ausloggen
// oder über einen alten Link) landen beim Einloggen.
export default function ProfilPage() {
  const { isRegistered, sessionChecked } = useUser();
  const router = useRouter();
  const isGuest = sessionChecked && !isRegistered;
  useEffect(() => {
    if (isGuest) router.replace("/registrieren");
  }, [isGuest, router]);
  if (!isRegistered) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center text-sm text-muted">
        {isGuest ? "Weiter zum Einloggen…" : "Lädt…"}
      </main>
    );
  }
  return <ProfilInhalt />;
}

function ProfilInhalt() {
  const {
    displayName,
    setDisplayName,
    freeStars,
    passXP,
    passClaims,
    shownPassHonors: passHonors,
    passDisplay,
    tipsSubmitted,
    rangPunkte,
    prestige,
    selectedRankIconId,
    setSelectedRankIconId,
    activeRankIcon,
    photoVisibility,
    accountSync,
    setPhotoVisibility,
    photos,
    setPhoto,
    removePhoto,
    hasAdFreeSubscription,
    hasPremiumPass,
    isRegistered,
    authEmail,
    authUserId,
    logout,
  } = useUser();
  // Serie, wie sie gerade wirklich zählt (gerissen = 0), siehe lib/streak.ts.
  const streak = useStreak();
  const totalRangPunkte = Object.values(rangPunkte).reduce((sum, p) => sum + (p ?? 0), 0);
  const streakCount = streak.count;
  const [loggingOut, setLoggingOut] = useState(false);
  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }
  const { orderFor, matches, getTeam, myTips, countingTips, tipsBySport, rankingResetAt } = useAppData();
  const resetDate = resetDateText(rankingResetAt);
  // Tipp-Historie: nur Tipps, die im aktuellen Punktesystem zählen (die
  // alten bleiben in der Datenbank), neueste Abgabe oben.
  const historyTips = [...countingTips].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
  // Tipp-Historie: erst 10, "Mehr anzeigen" lädt je 20 weitere; Filter nach
  // Sportart (Rene, 19.10.2026: Liste wurde sonst endlos lang).
  const [historySport, setHistorySport] = useState<Sport | null>(null);
  const [historyCount, setHistoryCount] = useState(10);
  const historySportOf = (matchId: string) => matches.find((m) => m.id === matchId)?.sport;
  const historySports = SPORTS.filter((sp) => historyTips.some((t) => historySportOf(t.matchId) === sp));
  const filteredHistory = historySport ? historyTips.filter((t) => historySportOf(t.matchId) === historySport) : historyTips;
  const shownHistory = filteredHistory.slice(0, historyCount);
  const { showToast, celebrate } = useFeedback();
  const [nameInput, setNameInput] = useState(displayName);
  // Name auf einem anderen Gerät geändert: Eingabefeld mitziehen.
  useEffect(() => {
    setNameInput(displayName);
  }, [displayName]);
  const [saved, setSaved] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("Übersicht");
  // Reiter per Adresse öffnen (/profil#einstellungen, #herzensvereine, #rang),
  // z. B. aus dem Saison-Design-Hinweis oder der Vereinstabelle. Danach zum
  // Ziel scrollen, weil es erst mit dem Reiter im Seiteninhalt auftaucht.
  useEffect(() => {
    function openFromHash() {
      const id = window.location.hash.slice(1);
      const tab = HASH_TABS[id];
      if (!tab) return;
      setProfileTab(tab);
      // Zweimal, weil Fotos/Vereine beim Laden die Seite noch verschieben.
      for (const ms of [100, 700]) {
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), ms);
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);
  // Sport-Steckbrief (lib/sportBio.ts): oben in der Übersicht, bearbeiten unter Einstellungen.
  const sportBio = useSportBio(isRegistered ? authUserId : null);
  // Die eigene Karte steht immer da, ohne Angaben eben leer (Rene, 23.10.2026).
  const hasSportCard = sportBio.status === "ready";
  function openSportBioEditor() {
    chooseProfileTab("Einstellungen");
    for (const ms of [100, 700]) {
      setTimeout(() => document.getElementById("steckbrief")?.scrollIntoView({ block: "start" }), ms);
    }
  }
  function chooseProfileTab(tab: ProfileTab) {
    setProfileTab(tab);
    // Reiter in der Adresse merken, damit Neuladen auf demselben Reiter bleibt.
    const hash = tab === "Einstellungen" ? "#einstellungen" : tab === "Rang" ? "#rang" : "";
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
  }

  // Alle Icons zeigen, auch die noch gesperrten (ausgegraut), damit man
  // sieht, was man noch erreichen kann.
  const allRankIcons = getAllRankIcons(rangPunkte, prestige);
  const sportProgressOptions = allRankIcons
    .map((r) => r.option)
    .filter((o) => o.kind === "sport" && o.sport && o.points !== undefined);
  const [rangSportTab, setRangSportTab] = useState<Sport | null>(
    sportProgressOptions[0]?.sport ?? null
  );
  const selectedProgress = sportProgressOptions.find((o) => o.sport === rangSportTab);

  // Echter Gesamtplatz, gleiche Rechnung wie in der Kopfzeile (vorher stand
  // hier für jeden ein fester Demo-Platz aus mockLeaderboard).
  const myRank = useMyOverallRank();
  const currentRank = myRank.status === "ranked" ? myRank.rank : null;

  // Premium-Pass-Stufen (siehe lib/passLevels.ts): true, sobald die Premium-Spur
  // gekauft UND das jeweilige Level per Pass-XP erreicht ist.
  const hasLevelPremium = (level: number) => hasPremiumPass && passXP >= xpForLevel(level);
  const seasonDesign = useSeasonDesign();
  // Einstellungen mit Auswahl: erst "Speichern" übernimmt sie (components/SaveButton.tsx).
  const designDraft = useDraft(seasonDesign.enabled);
  const visibilityDraft = useDraft(photoVisibility);
  const statsVisibility = useStatsVisibility(authUserId ?? null);
  const statsDraft = useDraft<StatsVisibility>(statsVisibility.value);
  const online = useOnline();
  const onlineDraft = useDraft<boolean>(online.showOnline);
  const playedEarlierSeason = passClaims.some((c) => !c.startsWith(`${CURRENT_SEASON.theme.id}:`));

  // Nur Tipps seit dem Neustart der Rangpunkte, damit Trefferquote und
  // Tipp-Zahl zu den Punkten passen (lib/rankingReset.ts).
  const evaluatedTips = countingTips.filter((t) => t.evaluated && !t.refunded);

  // Punkte dieser Woche und dieser Saison: Ein einzelner Tipp kann ins
  // Minus gehen, entscheidend ist die Summe. Die Woche zählt wie die
  // Wochen-Rangliste nur Tipp-Punkte ohne Platz-Bonus (Dienstag 8:00 bis
  // Dienstag 8:00 MEZ, nach Anpfiff), die Saison die ganzen Rangpunkte.
  const weekPoints = sumWeeklyTipPoints(myTips, getCurrentWeekWindow(), kickoffLookup(matches));
  const seasonPoints = sumWeeklyRangDelta(myTips, {
    start: new Date(`${CURRENT_SEASON.startsOn}T00:00:00`),
    end: new Date(new Date(`${CURRENT_SEASON.endsOn}T00:00:00`).getTime() + 24 * 60 * 60 * 1000),
  });
  const signedPoints = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("de-DE")}`;
  const exaktCount = evaluatedTips.filter((t) => t.resultTier === "exakt").length;
  const trefferquote =
    evaluatedTips.length > 0 ? Math.round((exaktCount / evaluatedTips.length) * 100) : 0;

  // Level 10 Premium: einmaliges Abschluss-Feuerwerk beim Erreichen des
  // Champion-Titels – analog zum celebratedRef-Muster in MatchCard.tsx.
  const championCelebratedRef = useRef(false);
  useEffect(() => {
    if (hasLevelPremium(10) && !championCelebratedRef.current) {
      championCelebratedRef.current = true;
      celebrate(true);
      showToast(`🎆 Champion ${SEASON_THEME.year} – herzlichen Glückwunsch!`, "gold");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPremiumPass, passXP]);

  function handleShareRueckblick() {
    const text = `🏆 Mein PoolTipp-Rückblick ${SEASON_THEME.year}\n${tipsSubmitted} Tipps abgegeben · ${trefferquote}% Trefferquote (exakt)${
      currentRank ? `\nRang ${currentRank} in der Gesamt-Rangliste` : ""
    }${activeRankIcon ? ` · ${activeRankIcon.label}` : ""}\n🔥 ${streakCount} Tage Tipp-Serie`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => showToast("📋 Rückblick in die Zwischenablage kopiert.", "gold"))
      .catch(() => showToast("Kopieren nicht möglich – bitte manuell markieren.", "info"));
  }

  function handleSaveName(e: FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setDisplayName(nameInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handlePhotoChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Vor dem Speichern verkleinern (max. 600 px, JPEG): ein Handyfoto hat
    // sonst mehrere MB und wäre zu groß für die Datenbank.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setPhoto(index, canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("Dieses Bild konnte nicht geöffnet werden.", "info");
    };
    img.src = url;
    e.target.value = "";
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      {/* Saison-Pass Level 1: Willkommens-Banner für angemeldete Spieler –
          nur solange sie noch auf Level 1 sind, ab Level 2 verschwindet er.
          Wer schon in einer früheren Saison gespielt hat, ist nicht neu und
          bekommt ihn nach dem Saisonwechsel (XP wieder 0) nicht noch einmal. */}
      {isRegistered && authUserId && passXP < xpForLevel(2) && !playedEarlierSeason && (
        <WelcomeBanner userId={authUserId} name={displayName} />
      )}

      {/* Am PC steht links nur die Sportlerkarte, Name, Abzeichen und Reiter
          rechts daneben; das runde Profilbild fällt weg, weil das Foto schon
          in der Karte steckt (Rene, 21.10.2026). Am Handy Karte in der Übersicht. */}
      <div className="lg:flex lg:items-start lg:gap-10">
        {hasSportCard && (
          <div className="hidden w-[250px] shrink-0 lg:mb-10 lg:block">
            <SportBioCard
              userId={authUserId}
              compact
              bio={sportBio.bio}
              name={displayName}
              photo={photos[0]}
              rankIcon={activeRankIcon}
              place={currentRank}
              points={totalRangPunkte}
              onEdit={openSportBioEditor}
            />
          </div>
        )}
        <div className={`min-w-0 flex-1 ${hasSportCard ? "lg:pt-2" : ""}`}>
        {/* Level 8 Premium: Profil-Hintergrundbanner in den Saison-Farben
            (SEASON_THEME) – nur ein Farbverlauf, kein neues Bild pro Saison nötig. */}
        <div
          className={`mb-8 flex items-center gap-6 ${hasLevelPremium(8) ? "rounded-card p-5" : ""}`}
          style={
            hasLevelPremium(8)
              ? {
                  background: `linear-gradient(135deg, ${SEASON_THEME.colorFrom}26, ${SEASON_THEME.colorTo}26)`,
                  border: `1px solid ${SEASON_THEME.colorFrom}55`,
                }
              : undefined
          }
        >
          <div className={`relative h-16 w-16 shrink-0 ${hasSportCard ? "lg:hidden" : ""}`}>
            {/* Das Foto wird in einem eigenen, rund abgeschnittenen Kreis
                dargestellt – die Rang-Badge sitzt außerhalb davon, sonst
                schneidet "overflow-hidden" sie zu einem hässlichen Eck ab. */}
            <SeasonFrame size={64}>
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-2xl font-bold text-gold">
                {photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0]} alt="Profilbild" className="h-full w-full object-cover" />
                ) : (
                  displayName.slice(0, 1).toUpperCase()
                )}
              </div>
            </SeasonFrame>
            {/* Level 8 Premium: animiertes Kronen-Icon */}
            {hasLevelPremium(8) && (
              <span
                className="animate-frame-pulse absolute -left-1 -top-1 text-lg"
                title="Kronen-Icon (Level 8 Premium)"
              >
                👑
              </span>
            )}
            {/* Rang-Abzeichen in der Ecke des Profilbilds – größer als in Listen,
                weil Bild und Name hier groß sind. Bedeutung poppt bei
                Hover/Antippen auf. Ragt etwas über den Rand hinaus, damit es
                möglichst wenig vom Foto verdeckt. */}
            {activeRankIcon && (
              <span className="absolute -bottom-1.5 -right-3 z-10">
                <RankMeaningBadge option={activeRankIcon} size="profil" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className={`flex items-center gap-2 font-display text-2xl font-bold text-ink ${hasSportCard ? "lg:text-4xl" : ""}`}>
              {/* Lange Einzelwort-Namen schrumpfen statt rechts abgeschnitten zu werden. */}
              <FitText text={displayName} minPx={14} />
              {/* Kronen-Icon (Level 8 Premium) sonst am runden Profilbild, das am PC neben der Karte fehlt. */}
              {hasSportCard && hasLevelPremium(8) && (
                <span className="hidden text-2xl lg:inline" title="Kronen-Icon (Level 8 Premium)">
                  👑
                </span>
              )}
              {/* Level 3 Premium: Saison-Icon neben dem Namen */}
              {hasLevelPremium(3) && passDisplay.nameIcon !== false && (
                <span className="text-lg" title={`Saison-Icon (${SEASON_THEME.name})`}>
                  {SEASON_THEME.icon}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted">
              {currentRank
                ? `Aktuell Platz ${currentRank} in der Rangliste`
                : myRank.status === "loading"
                  ? "Platz wird geladen …"
                  : "Noch nicht platziert"}
            </p>
            {/* Hauptrolle aus dem Sport-Steckbrief, z. B. "🎽 Ex-Vereinsspieler". */}
            <SportBioTag bio={sportBio.bio} />
            {/* Saison-Pass: Titel (Level 4/6/8) und Abzeichen (Level 10, bleibt für immer). */}
            {(passHonors.title || passHonors.badges.length > 0) && (
              <div className="mt-2">
                <PassHonorTags honors={passHonors} />
              </div>
            )}
            {/* Level 10 Premium: Saison-gebundener Champion-Titel (siehe
                lib/passLevels.ts – bewusst an SEASON_THEME.year statt an einen
                Rang gebunden). */}
            {hasLevelPremium(10) && (
              <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold px-3 py-1 font-display text-xs font-bold text-gold">
                🎆 Champion {SEASON_THEME.year}
              </span>
            )}
          </div>
        </div>

        {/* Reiter: Übersicht (Fotos, Statistik, Historie), Rang (Icons, Fortschritt),
            Einstellungen (Name, Sichtbarkeit, Startseite, Design, Vereine, Konto) */}
        <div className="mb-6 flex flex-wrap gap-2">
          {PROFILE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => chooseProfileTab(t)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                profileTab === t
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-edge bg-surface text-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        </div>
      </div>

      {profileTab === "Rang" && (
        <>
          <section className="mb-8">
            <h2 className="mb-1 font-display text-lg font-semibold text-ink">Dein Rang-Icon</h2>
            <p className="mb-3 text-xs text-muted">
              Wähle, welches Icon neben deinem Namen in Rangliste, Profil und Chat angezeigt wird.
              Ausgegraute Icons schaltest du noch frei.
            </p>
            {/* Am Handy volle Breite untereinander, ab Tablet ein Raster – alle
                Kästchen gleich breit und hoch, Icon links in fester Box, Text
                immer an derselben Stelle, Status (✓ / 🔒) rechts. */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {allRankIcons.map(({ option, unlocked, hint }) => {
                const active = unlocked && option.id === activeRankIcon?.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => unlocked && setSelectedRankIconId(option.id)}
                    disabled={!unlocked}
                    aria-pressed={active}
                    aria-label={unlocked ? option.label : `${option.label} (gesperrt: ${hint})`}
                    className={`flex min-h-[68px] w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-gold bg-gold/10"
                        : unlocked
                        ? "border-edge bg-surface hover:border-muted"
                        : "cursor-not-allowed border-dashed border-edge bg-surface"
                    }`}
                  >
                    <span
                      className={`relative flex h-11 w-11 shrink-0 items-center justify-center ${
                        unlocked ? "" : "opacity-40 grayscale"
                      }`}
                    >
                      <RankBadge option={option} size="md" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm font-semibold leading-snug ${
                          active ? "text-gold" : unlocked ? "text-ink" : "text-muted"
                        }`}
                      >
                        {unlocked ? option.label : option.kind === "sport" ? sportLabel(option.sport) : option.label}
                      </span>
                      <span className="block text-xs leading-snug text-muted">
                        {active ? "Ausgewählt" : unlocked ? "Antippen zum Wählen" : hint}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        active
                          ? "bg-gold text-pitch"
                          : unlocked
                          ? "border border-edge"
                          : "text-sm"
                      }`}
                    >
                      {active ? "✓" : unlocked ? "" : "🔒"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {sportProgressOptions.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-1 font-display text-lg font-semibold text-ink">Rang-Fortschritt</h2>
              <p className="mb-3 text-xs text-muted">
                Pro Sportart steigst du mit deinen gesammelten Punkten automatisch die Ränge hoch –
                der Balken zeigt, wie viele Punkte dir bis zur nächsten Stufe fehlen.
              </p>

              {/* Gleich breite Knöpfe: am Handy 2 × 2, ab Tablet in einer Reihe. */}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sportProgressOptions.map((o) => (
                  <button
                    key={o.sport}
                    onClick={() => setRangSportTab(o.sport!)}
                    className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      rangSportTab === o.sport
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-surface text-muted hover:text-ink"
                    }`}
                  >
                    <span>{o.icon}</span>
                    {sportLabel(o.sport)}
                  </button>
                ))}
              </div>

              {selectedProgress && (
                <RankProgress
                  sport={selectedProgress.sport!}
                  points={selectedProgress.points!}
                  prestige={prestigeLevel(prestige, selectedProgress.sport!)}
                  unsterblich={isUnsterblich(rangPunkte, prestige)}
                />
              )}
            </section>
          )}
        </>
      )}

      {/* Übersicht neu sortiert (Rene, 19.10.2026): Zahlen oben (ohne doppelte
          Punkte), dann Tipp-Historie mit Punkten je Tipp, Tipp-Typ,
          Rückblick und zuletzt kleine Fotos. "Werbefrei" steht jetzt unter
          Einstellungen → App. */}
      {profileTab === "Übersicht" && (
        <>
      {sportBio.status === "ready" && (
        <SportBioCard
              userId={authUserId}
          className={hasSportCard ? "lg:hidden" : ""}
          bio={sportBio.bio}
          name={displayName}
          photo={photos[0]}
          rankIcon={activeRankIcon}
          place={currentRank}
              points={totalRangPunkte}
          onEdit={openSportBioEditor}
        />
      )}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">Deine Zahlen</h2>
          {isRegistered && <RivalCompareButton />}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <StatCard label="Punkte" value={totalRangPunkte.toLocaleString("de-DE")} accent="action" />
          <StatCard label="Diese Woche" value={signedPoints(weekPoints)} accent={weekPoints >= 0 ? "action" : "ink"} />
          <StatCard label="Coins" value={freeStars.toLocaleString("de-DE")} accent="gold" />
          <StatCard label="Tipp-Serie" value={`🔥 ${streakCount.toLocaleString("de-DE")}`} accent="gold" />
        </div>
        {/* Anfänger-Schutz (erste 10 Tipps insgesamt), solange noch übrig (Rene, 15.10.2026) */}
        <BeginnerShieldHint className="mt-3 rounded-card border border-edge bg-surface px-4 py-3" />
        <p className="mt-3 text-xs text-muted">
          Pro Tipp gibt es feste Punkte: exakt +10, richtige Tordifferenz +7, richtige Tendenz +5, daneben −3 (bei
          Sieger-Tipps richtig +5, falsch −3). Dazu kommt ein Bonus bis ±10, je nachdem, wie viele Mittipper du
          schlägst. Wer 2 Wochen gar nicht tippt, verliert 5 Punkte pro Woche.
        </p>
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-card border border-edge bg-surface px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            Mehr Zahlen
            <span className="text-xs text-gold transition-transform group-open:rotate-180" aria-hidden>▼</span>
          </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Diese Saison" value={signedPoints(seasonPoints)} accent={seasonPoints >= 0 ? "action" : "ink"} />
          <StatCard label="Pass-XP" value={passXP.toLocaleString("de-DE")} accent="action" />
          <StatCard label="Abgegebene Tipps" value={tipsSubmitted.toLocaleString("de-DE")} accent="ink" />
        </div>
        <HitRateBySport />
        {isRegistered && (
          <div className="mt-3 rounded-card border border-edge bg-surface p-4 text-xs text-muted">
            <p>
              🔥 Tipp-Serie:{" "}
              <span className="font-semibold text-ink">
                {streak.count > 0 ? `${daysLabel(streak.count)} in Folge` : "gerade keine"}
              </span>
              {streak.status === "today" && " · heute schon getippt"}
              {streak.nextMilestone && (
                <>
                  {" "}
                  · bei {daysDative(streak.nextMilestone.days)} gibt es +{streak.nextMilestone.bonusStars} Coins
                </>
              )}
            </p>
            {streak.shieldFree !== null && (
              <p className="mt-1">
                🛡️ Serien-Schutz diese Woche:{" "}
                <span className="font-semibold text-ink">{streak.shieldFree ? "bereit" : "schon genutzt"}</span>. Einmal pro
                Woche wird ein Tag ohne Tipp automatisch überbrückt, wenn du am Tag danach wieder tippst.
              </p>
            )}
          </div>
        )}
        <p className="mb-2 mt-4 font-display text-sm font-semibold text-ink">Tipps nach Sportart</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SPORTS.map((sport) => (
            <div key={sport} className="rounded-card border border-edge bg-surface px-2 py-3 text-center">
              <div className="mb-1 text-xl"><Emoji e={sportIcon[sport]} /></div>
              <p className="font-display text-lg font-bold text-ink">{(tipsBySport[sport] ?? 0).toLocaleString("de-DE")}</p>
              <p className="text-xs text-muted">{sportLabel(sport)}</p>
            </div>
          ))}
        </div>
        {resetDate && (
          <p className="mt-3 text-xs text-muted">Gezählt werden deine Tipps seit dem Neustart der Punkte am {resetDate}.</p>
        )}
        </details>
        {isRegistered && (
          <Link
            href="/rueckblick"
            className="mt-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4 transition-colors hover:border-gold/60"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">📊 Wochenrückblick</span>
              <span className="block text-xs text-muted">Deine letzte Woche und diese Woche bisher</span>
            </span>
            <span className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold">
              Ansehen
            </span>
          </Link>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Meine Tipp-Historie</h2>
        {historySports.length > 1 && (
          <div role="group" aria-label="Nach Sportart filtern" className="mb-3 flex flex-wrap gap-2">
            {[null, ...historySports].map((sp) => (
              <button
                key={sp ?? "alle"}
                type="button"
                aria-pressed={historySport === sp}
                onClick={() => {
                  setHistorySport(sp);
                  setHistoryCount(10);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  historySport === sp ? "border-gold bg-gold/15 text-gold" : "border-edge bg-surface text-muted hover:text-ink"
                }`}
              >
                {sp ? (
                  <>
                    <Emoji e={sportIcon[sp]} /> {sportLabel(sp)}
                  </>
                ) : (
                  "Alle"
                )}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {historyTips.length === 0 && (
            <EmptyState
              emoji="🎯"
              title="Noch keine Tipps"
              text={myTips.length === 0 ? "Hier siehst du später alle deine Tipps mit Punkten." : "Seit dem Neustart der Punkte hast du noch nichts getippt."}
              action={{ href: "/", label: "Jetzt tippen" }}
            />
          )}
          {shownHistory.map((tip) => {
            const match = matches.find((m) => m.id === tip.matchId);
            if (!match) return null;
            const homeTeam = getTeam(match.homeTeamId);
            const awayTeam = getTeam(match.awayTeamId);
            if (!homeTeam || !awayTeam) return null;
            const order = orderFor(match);
            const isOneXTwo = match.tipMode === "1x2";
            // Tipp wie auf den Karten: "Sieg Frankfurt", "Unentschieden" bzw. "2:1"
            // (Rene, 19.10.2026: statt "1 (Tottenham)" und Abgabezeit mit Sekunden).
            const tipLabel = liveTipLabel(
              tip.predictedHomeScore,
              tip.predictedAwayScore,
              isOneXTwo,
              homeTeam.name,
              awayTeam.name,
              scoreText(order, tip.predictedHomeScore, tip.predictedAwayScore)
            );
            const kickoff = new Date(match.kickoff).toLocaleString("de-DE", {
              weekday: "short",
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            // Ergebnis als farbiges Wort (nicht nur Farbe), sobald der Tipp
            // ausgewertet ist. Offene und abgesagte Tipps bleiben ohne.
            const tier = tip.evaluated && !tip.refunded ? tip.resultTier ?? "falsch" : null;
            // 1X2 kennt nur richtig (grün) oder falsch (rot).
            const badge = !tier
              ? null
              : isOneXTwo && tier !== "falsch"
              ? { text: "Richtig", className: TIER_BADGE.exakt.className }
              : TIER_BADGE[tier];
            // Rangpunkte des Tipps statt Coins (Coins gibt es nur noch beim Booster).
            const points = tip.evaluated && !tip.refunded ? tip.rangDelta : undefined;

            return (
              <div
                key={tip.id}
                className="flex items-center justify-between gap-3 rounded-card border border-edge bg-surface px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    <Emoji e={sportIcon[match.sport]} /> {match.competition}
                    {match.matchday ? ` · Spieltag ${match.matchday}` : ""} · {kickoff}
                  </p>
                  <p className="font-display text-sm font-semibold text-ink">
                    {matchTitle(order, homeTeam.name, awayTeam.name)}
                  </p>
                  <p className="text-xs text-muted">
                    Dein Tipp: <span className="font-semibold text-ink">{tipLabel}</span>
                    {match.status === "finished" &&
                      ` · Endstand ${scoreText(order, match.liveHomeScore, match.liveAwayScore)}`}
                    {tip.stake > 0 && (
                      <span className="ml-1 inline-flex items-center gap-1 text-gold">
                        · ⚡ <CoinIcon className="h-3 w-3" />
                        {tip.evaluated && tip.starsDelta !== undefined
                          ? `${tip.starsDelta > 0 ? "+" : ""}${tip.starsDelta}`
                          : tip.stake}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {badge && (
                    <span
                      className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 font-display text-xs font-bold ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  )}
                  {tip.refunded ? (
                    <span className="text-xs text-muted">abgesagt</span>
                  ) : points !== undefined ? (
                    <span
                      className={`font-display text-base font-bold ${points > 0 ? "text-action" : points < 0 ? "text-red-400" : "text-muted"}`}
                      title={tip.beginnerShielded ? "Anfänger-Schutz: kein Minus" : undefined}
                    >
                      {livePointsText(points)} <span className="text-[11px] font-semibold text-muted">Pkt.</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">offen</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {filteredHistory.length > shownHistory.length && (
          <button
            type="button"
            onClick={() => setHistoryCount((n) => n + 20)}
            className="mt-3 w-full rounded-full border border-edge py-2 text-sm font-semibold text-muted transition-colors hover:border-gold hover:text-ink"
          >
            Mehr anzeigen ({filteredHistory.length - shownHistory.length} weitere)
          </button>
        )}
      </section>

      {/* Dein Tipp-Typ (supabase/tipp-typ.sql): was für ein Tipper du bist, mit Bild zum Teilen. */}
      {isRegistered && authUserId && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Dein Tipp-Typ</h2>
          <TippTypCard userId={authUserId} playerName={displayName} own />
        </section>
      )}

      {/* Level 9 Premium: automatische, teilbare Saison-Rückblick-Karte –
          läuft komplett mit echten Daten (myTips, streakCount, currentRank),
          braucht also keine wiederkehrende Design-Arbeit pro Saison. */}
      {hasLevelPremium(9) && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Saison-Rückblick-Karte</h2>
          <div
            className="rounded-card border p-5"
            style={{
              background: `linear-gradient(135deg, ${SEASON_THEME.colorFrom}33, ${SEASON_THEME.colorTo}33)`,
              borderColor: `${SEASON_THEME.colorFrom}66`,
            }}
          >
            <p className="font-display text-sm font-semibold text-gold">
              {SEASON_THEME.icon} {SEASON_THEME.name}
            </p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{displayName}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-display text-lg font-bold text-ink">{tipsSubmitted}</p>
                <p className="text-[11px] text-muted">Tipps</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">{trefferquote}%</p>
                <p className="text-[11px] text-muted">Trefferquote</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-ink">🔥 {streakCount}</p>
                <p className="text-[11px] text-muted">Streak</p>
              </div>
            </div>
            {currentRank && (
              <p className="mt-3 text-xs text-muted">
                Rang {currentRank} in der Gesamt-Rangliste
                {activeRankIcon ? ` · ${activeRankIcon.label}` : ""}
              </p>
            )}
            <button
              onClick={handleShareRueckblick}
              className="mt-4 w-full rounded-full bg-action py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              📋 Rückblick kopieren
            </button>
          </div>
        </section>
      )}

      {/* Fotos klein statt drei großer Felder (Rene, 19.10.2026). */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Fotos</h2>
        <div className="grid max-w-md grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div
              key={index}
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-card border border-dashed border-edge bg-surface"
            >
              {photo ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removePhoto(index)}
                    aria-label={`Foto ${index + 1} entfernen`}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-pitch/80 text-xs text-ink"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-0.5 text-muted">
                  <span className="text-xl">＋</span>
                  <span className="text-[11px]">Foto {index + 1}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoChange(index, e)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Das erste Foto ist dein Profilbild. Wer deine Fotos sehen darf, stellst du unter Einstellungen ein.
        </p>
      </section>
        </>
      )}

      {profileTab === "Einstellungen" && (
        // id für Links von außen (Saison-Design-Hinweis); scroll-mt wegen der
        // festen Kopfleiste.
        <div id="einstellungen" className="scroll-mt-48">
          <section className="mb-8">
            <h2 className="font-display text-lg font-semibold text-ink">Profil</h2>
            <form
              onSubmit={handleSaveName}
              className="mt-3 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="profil-name" className="mb-1 block text-xs text-muted">Anzeigename</label>
                <input
                  id="profil-name"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setSaved(false);
                  }}
                  className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                />
              </div>
              <SaveButton
                type="submit"
                dirty={!!nameInput.trim() && nameInput.trim() !== displayName}
                saved={saved}
                className="self-start py-2 sm:self-auto"
              />
            </form>
            <div className="mt-3 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Wer darf deine Fotos sehen?</p>
                <p className="text-xs text-muted">
                  Gilt für dein Profil, wenn andere User dich antippen (z. B. in der Rangliste).
                </p>
              </div>
              {/* Am Handy zwei gleich breite Knöpfe nebeneinander (wie bei der Startseite). */}
              <div className="grid shrink-0 grid-cols-2 items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => visibilityDraft.pick("public", (v) => setPhotoVisibility(v))}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-center text-xs font-semibold transition-colors ${
                      visibilityDraft.value === "public"
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-muted hover:text-ink"
                    }`}
                  >
                    🌐 Öffentlich
                  </button>
                  <button
                    type="button"
                    onClick={() => visibilityDraft.pick("friends", (v) => setPhotoVisibility(v))}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-center text-xs font-semibold transition-colors ${
                      visibilityDraft.value === "friends"
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-muted hover:text-ink"
                    }`}
                  >
                    🔒 Nur für Freunde
                  </button>
                <SavedHint className="col-span-2" saved={visibilityDraft.saved} />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Wer darf deine Statistik sehen?</p>
                <p className="text-xs text-muted">
                  {statsVisibility.missing
                    ? "Diese Einstellung wird gerade freigeschaltet – bitte später nochmal probieren."
                    : "Gilt für den Rivalen-Vergleich: Wer dich sucht, sieht sonst nur 🔒."}
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-3 items-center gap-2 sm:flex">
                {(
                  [
                    ["public", "🌐 Alle"],
                    ["friends", "👥 Nur Freunde"],
                    ["private", "🔒 Niemand"],
                  ] as [StatsVisibility, string][]
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    disabled={statsVisibility.missing}
                    onClick={() => statsDraft.pick(v, (x) => statsVisibility.save(x))}
                    className={`whitespace-nowrap rounded-full border px-2.5 py-1.5 text-center text-xs font-semibold transition-colors sm:px-3.5 ${
                      statsDraft.value === v
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <SavedHint className="col-span-3" saved={statsDraft.saved} />
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Online-Status zeigen</p>
                <p className="text-xs text-muted">
                  {online.settingState === "missing"
                    ? "Diese Einstellung wird gerade freigeschaltet – bitte später nochmal probieren."
                    : "Deine Freunde sehen einen grünen Punkt, wenn du gerade in der App bist."}
                </p>
              </div>
              <div className="grid shrink-0 grid-cols-2 items-center gap-2 sm:flex">
                {(
                  [
                    [true, "🟢 An"],
                    [false, "⚪ Aus"],
                  ] as [boolean, string][]
                ).map(([v, label]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={online.settingState !== "ready"}
                    onClick={() => onlineDraft.pick(v, (x) => online.saveShowOnline(x))}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-center text-xs font-semibold transition-colors ${
                      onlineDraft.value === v
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <SavedHint className="col-span-2" saved={onlineDraft.saved} />
              </div>
            </div>
          </section>

          {isRegistered && authUserId && sportBio.status !== "loading" && (
            <SportBioEditor
              userId={authUserId}
              name={displayName}
              photo={photos[0]}
              rankIcon={activeRankIcon}
              place={currentRank}
              points={totalRangPunkte}
              bio={sportBio.bio}
              unavailable={sportBio.status === "missing"}
              onSaved={sportBio.reload}
            />
          )}

          <section className="mb-8">
            <h2 className="font-display text-lg font-semibold text-ink">App</h2>
            {isRegistered && <StartPagePicker />}
            {/* Werbefrei: kompakt hier statt als große Box in der Übersicht (Rene, 19.10.2026). */}
            {isRegistered &&
              (hasAdFreeSubscription ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Werbefrei</p>
                    <p className="text-xs text-muted">Im Premium-Pass enthalten – du siehst keine Werbebanner.</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold text-gold">✓ aktiv</span>
                </div>
              ) : (
                <Link
                  href="/fortschritt"
                  className="mt-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4 transition-colors hover:border-gold/60"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Werbung ausblenden</span>
                    <span className="block text-xs text-muted">Ist im Premium-Pass enthalten – kein separater Kauf nötig.</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold">
                    Ansehen
                  </span>
                </Link>
              ))}
            {/* Saison-Design: kommt automatisch ab dem Level aus der Saison-Datei,
                hier abschaltbar (gilt pro Gerät, siehe lib/seasons/design.ts). */}
            {seasonDesign.available && (
              <div className="mt-3 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Saison-Design</p>
                  <p className="text-xs text-muted">
                    {seasonDesign.unlocked
                      ? `Farben und Deko der Saison „${seasonDesign.seasonName}“ in der ganzen App.`
                      : `Kommt automatisch, sobald du im Saison-Pass Level ${seasonDesign.unlockLevel} erreichst.`}
                  </p>
                </div>
                {seasonDesign.unlocked ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Schalter wie bei "Für Vereine spielen", speichert sofort
                        (Rene, 19.10.2026: vorher nur ein Knopf "Aus" ohne "An"). */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={designDraft.value}
                      aria-label="Saison-Design an oder aus"
                      onClick={() => designDraft.pick(!designDraft.value, (on) => seasonDesign.setEnabled(on))}
                      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
                        designDraft.value ? "border-gold bg-gold/80" : "border-edge bg-pitch"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${designDraft.value ? "left-6" : "left-0.5"}`}
                      />
                    </button>
                    <SavedHint saved={designDraft.saved} />
                  </div>
                ) : (
                  <span className="shrink-0 self-start rounded-full border border-edge px-3 py-1.5 font-display text-sm font-semibold text-muted sm:self-auto">
                    🔒 Level {seasonDesign.unlockLevel}
                  </span>
                )}
              </div>
            )}
            {seasonDesign.available && seasonDesign.unlocked && accountSync?.seasonDesign === false && (
              <p className="mt-2 text-[11px] text-muted">
                ⚠️ Saison-Design gilt im Moment nur auf diesem Gerät. Damit es auf allen Geräten gilt, fehlt noch ein
                Datenbank-Update.
              </p>
            )}

            {isRegistered && (
              <Link
                href="/start?vorschau=1"
                className="mt-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4 transition-colors hover:border-gold/60"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">👋 Start-Erlebnis</span>
                  <span className="block text-xs text-muted">
                    So sieht ein neuer Spieler den Start. Nur zum Ansehen, es wird nichts gespeichert.
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold">
                  Ansehen
                </span>
              </Link>
            )}
          </section>

          {/* Pass-Belohnungen anlegen/ablegen + Deko anderer Spieler */}
          {isRegistered && (
            <div id="pass-belohnungen" className="scroll-mt-48">
              <PassDecoSettings />
            </div>
          )}

          {/* id für die Links aus der Vereinstabelle */}
          <div id="herzensvereine" className="scroll-mt-48">
            <FavoriteClubs />
          </div>

          <section>
            <h2 className="font-display text-lg font-semibold text-ink">Konto</h2>
            {isRegistered ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Angemeldet als</p>
                    <p className="break-all text-sm font-semibold text-ink">{authEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="shrink-0 rounded-full border border-edge px-4 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-red-400/60 hover:text-red-300 disabled:opacity-60"
                  >
                    {loggingOut ? "…" : "Ausloggen"}
                  </button>
                </div>
                <AccountSettings />
              </>
            ) : (
              <Link
                href="/registrieren"
                className="mt-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4 transition-colors hover:border-gold/60"
              >
                <span className="text-sm text-muted">Noch nicht eingeloggt</span>
                <span className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold">
                  Registrieren / Einloggen →
                </span>
              </Link>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

const PROFILE_TABS = ["Übersicht", "Rang", "Einstellungen"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];
const HASH_TABS: Record<string, ProfileTab> = {
  rang: "Rang",
  einstellungen: "Einstellungen",
  herzensvereine: "Einstellungen",
  "pass-belohnungen": "Einstellungen",
  steckbrief: "Einstellungen",
};

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "gold" | "action" | "ink";
}) {
  const colorClass =
    accent === "gold" ? "text-gold" : accent === "action" ? "text-action" : "text-ink";
  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
