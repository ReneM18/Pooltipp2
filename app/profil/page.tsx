"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountSettings from "@/components/AccountSettings";
import StartPagePicker from "@/components/StartPagePicker";
import SaveButton, { useDraft } from "@/components/SaveButton";
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
import { matchTitle, oneXTwoText, scoreText } from "@/lib/teamOrder";
import { getCurrentWeekWindow, sumWeeklyRangDelta } from "@/lib/weeklyLeaderboard";
import { CoinIcon } from "@/components/CoinIcon";
import { resetDateText } from "@/lib/rankingReset";
import { TIER_BADGE } from "@/components/tierBadges";
import { daysDative, daysLabel, useStreak } from "@/lib/streak";

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
    userNumber,
    setDisplayName,
    freeStars,
    passXP,
    passClaims,
    passHonors,
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
  const streakCount = streak.count;
  const [loggingOut, setLoggingOut] = useState(false);
  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }
  const { matches, getTeam, myTips, countingTips, tipsBySport, rankingResetAt } = useAppData();
  const resetDate = resetDateText(rankingResetAt);
  // Tipp-Historie: nur Tipps, die im aktuellen Punktesystem zählen (die
  // alten bleiben in der Datenbank), neueste Abgabe oben.
  const historyTips = [...countingTips].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
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
  const playedEarlierSeason = passClaims.some((c) => !c.startsWith(`${CURRENT_SEASON.theme.id}:`));

  // Nur Tipps seit dem Neustart der Rangpunkte, damit Trefferquote und
  // Tipp-Zahl zu den Punkten passen (lib/rankingReset.ts).
  const evaluatedTips = countingTips.filter((t) => t.evaluated && !t.refunded);

  // Rangpunkte dieser Woche und dieser Saison: Ein einzelner Tipp kann ins
  // Minus gehen, entscheidend ist die Summe. Gleiche Woche wie die
  // Wochen-Rangliste (Montag bis Sonntag, nach Abgabezeit des Tipps).
  const weekPoints = sumWeeklyRangDelta(myTips, getCurrentWeekWindow());
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
    }${activeRankIcon ? ` · ${activeRankIcon.label}` : ""}\n🔥 ${streakCount} Tage Streak`;
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

      {/* Level 8 Premium: Profil-Hintergrundbanner in den Saison-Farben
          (SEASON_THEME) – nur ein Farbverlauf, kein neues Bild pro Saison nötig. */}
      <div
        className={`mb-8 flex items-center gap-4 ${hasLevelPremium(8) ? "rounded-card p-5" : ""}`}
        style={
          hasLevelPremium(8)
            ? {
                background: `linear-gradient(135deg, ${SEASON_THEME.colorFrom}26, ${SEASON_THEME.colorTo}26)`,
                border: `1px solid ${SEASON_THEME.colorFrom}55`,
              }
            : undefined
        }
      >
        <div className="relative h-16 w-16 shrink-0">
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
          {/* Rang-Icon direkt am Profilbild – Bedeutung (Label + Titel) steht
              nicht mehr zusätzlich als Text daneben, sondern poppt bei
              Hover/Antippen auf genau diesem Icon auf (siehe
              components/RankMeaningBadge.tsx). Kein zweites, doppeltes Icon
              mehr weiter unten. Bewusst ohne Rahmen um das Icon – wirkte als
              dunkler Ring auf dem Profilbild optisch wie ein Fremdkörper. */}
          {activeRankIcon && (
            <span className="absolute -bottom-1 -right-1.5 rounded-full">
              <RankMeaningBadge option={activeRankIcon} size="xs" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
            {/* Lange Einzelwort-Namen schrumpfen statt rechts abgeschnitten zu werden. */}
            <FitText text={displayName} minPx={14} />
            {/* Level 3 Premium: Saison-Icon neben dem Namen */}
            {hasLevelPremium(3) && (
              <span className="text-lg" title={`Saison-Icon (${SEASON_THEME.name})`}>
                {SEASON_THEME.icon}
              </span>
            )}
          </h1>
          {userNumber !== null && <p className="text-xs font-semibold text-gold">Nummer #{userNumber}</p>}
          <p className="text-sm text-muted">
            {currentRank
              ? `Aktuell Platz ${currentRank} in der Rangliste`
              : myRank.status === "loading"
                ? "Platz wird geladen …"
                : "Noch nicht platziert"}
          </p>
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

      {profileTab === "Rang" && (
        <>
          <section className="mb-8">
            <h2 className="mb-1 font-display text-lg font-semibold text-ink">Dein Rang-Icon</h2>
            <p className="mb-3 text-xs text-muted">
              Wähle, welches Icon neben deinem Namen in Rangliste, Profil und Chat angezeigt wird.
              Ausgegraute Icons schaltest du noch frei.
            </p>
            <div className="flex flex-wrap gap-3">
              {allRankIcons.map(({ option, unlocked, hint }) => {
                const active = unlocked && option.id === activeRankIcon?.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => unlocked && setSelectedRankIconId(option.id)}
                    disabled={!unlocked}
                    aria-label={unlocked ? option.label : `${option.label} (gesperrt: ${hint})`}
                    className={`flex items-center gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-gold bg-surface-hover"
                        : unlocked
                        ? "border-edge bg-surface hover:border-muted"
                        : "cursor-not-allowed border-dashed border-edge bg-surface"
                    }`}
                  >
                    <span className={`relative ${unlocked ? "" : "opacity-40 grayscale"}`}>
                      <RankBadge option={option} size="md" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-xs font-medium ${unlocked ? "text-ink" : "text-muted"}`}>
                        {unlocked ? option.label : `🔒 ${option.kind === "sport" ? sportLabel(option.sport) : option.label}`}
                      </span>
                      {!unlocked && <span className="block text-[11px] text-muted">{hint}</span>}
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

              <div className="mb-3 flex flex-wrap gap-2">
                {sportProgressOptions.map((o) => (
                  <button
                    key={o.sport}
                    onClick={() => setRangSportTab(o.sport!)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
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

      {profileTab === "Übersicht" && (
        <>
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Deine Fotos</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
                    className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-pitch/80 text-sm text-ink"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-muted">
                  <span className="text-2xl">＋</span>
                  <span className="text-xs">Foto {index + 1}</span>
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
          Fotos werden in deinem Konto gespeichert, sobald du eingeloggt bist.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Rangpunkte</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Diese Woche" value={signedPoints(weekPoints)} accent={weekPoints >= 0 ? "action" : "ink"} />
          <StatCard label="Diese Saison" value={signedPoints(seasonPoints)} accent={seasonPoints >= 0 ? "action" : "ink"} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Jeder Tipp bringt feste Punkte plus Bonus: exakt +10, Tordifferenz +7, Tendenz +5, falsch −3. Den Bonus
          gibt es, wenn du dich gegen die anderen Tipper desselben Spiels durchsetzt. Ein einzelner Tipp kann ins
          Minus gehen, entscheidend ist, was über die Woche und die Saison zusammenkommt. Wer 2 Wochen gar nicht
          tippt, verliert 5 Punkte pro Woche.
        </p>
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
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Statistik</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Coins" value={freeStars.toLocaleString("de-DE")} accent="gold" />
          <StatCard label="Pass-XP" value={passXP.toLocaleString("de-DE")} accent="action" />
          <StatCard label="Abgegebene Tipps" value={tipsSubmitted.toLocaleString("de-DE")} accent="ink" />
          <StatCard label="Tipp-Streak" value={`🔥 ${streakCount.toLocaleString("de-DE")}`} accent="gold" />
        </div>
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
        {/* Tipps nach Sportart – stand früher unter dem Saison-Pass, gehört aber
            zur Statistik (gleiche Zählung ab Neustart wie "Abgegebene Tipps"). */}
        <p className="mb-2 mt-4 font-display text-sm font-semibold text-ink">Tipps nach Sportart</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SPORTS.map((sport) => (
            <div key={sport} className="rounded-card border border-edge bg-surface px-2 py-3 text-center">
              <div className="mb-1 text-xl">{sportIcon[sport]}</div>
              <p className="font-display text-lg font-bold text-ink">{(tipsBySport[sport] ?? 0).toLocaleString("de-DE")}</p>
              <p className="text-xs text-muted">{sportLabel(sport)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {resetDate && <>Gezählt werden deine Tipps seit dem Neustart der Rangpunkte am {resetDate}. </>}
          Genauere Statistiken (Trefferquote, Tipp-Verlauf) folgen in einem späteren Update.
        </p>
      </section>

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

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Werbefrei</h2>
        {hasAdFreeSubscription ? (
          <div className="flex items-center gap-3 rounded-card border border-gold bg-gold/10 p-4">
            <span className="text-2xl">🚫📢</span>
            <div>
              <p className="font-display text-sm font-semibold text-gold">Werbefrei aktiv</p>
              <p className="text-xs text-muted">
                Im Premium-Pass enthalten – du siehst keine Werbebanner in der App.
              </p>
            </div>
          </div>
        ) : (
          <Link
            href="/fortschritt"
            className="flex flex-col items-start gap-3 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-4 transition-colors hover:border-gold/60 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                <span className="text-lg">🚫📢</span> Werbung ausblenden
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Ist im Premium-Pass enthalten – kein separater Kauf nötig.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold">
              Premium-Pass ansehen →
            </span>
          </Link>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Meine Tipp-Historie</h2>
        <div className="flex flex-col gap-3">
          {historyTips.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              {myTips.length === 0 ? "Noch keine Tipps abgegeben." : "Noch keine Tipps seit dem Neustart der Rangpunkte."}
            </p>
          )}
          {historyTips.map((tip) => {
            const match = matches.find((m) => m.id === tip.matchId);
            if (!match) return null;
            const homeTeam = getTeam(match.homeTeamId);
            const awayTeam = getTeam(match.awayTeamId);
            if (!homeTeam || !awayTeam) return null;
            // Ergebnis als farbiges Wort (nicht nur Farbe), sobald der Tipp
            // ausgewertet ist. Offene und abgesagte Tipps bleiben ohne.
            const tier = tip.evaluated && !tip.refunded ? tip.resultTier ?? "falsch" : null;
            // 1X2 kennt nur richtig (grün) oder falsch (rot).
            const badge = !tier
              ? null
              : match.tipMode === "1x2" && tier !== "falsch"
              ? { text: "Richtig", className: TIER_BADGE.exakt.className }
              : TIER_BADGE[tier];

            return (
              <div
                key={tip.id}
                className="flex items-center justify-between gap-3 rounded-card border border-edge bg-surface px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted">
                    {sportIcon[match.sport]} {match.competition}
                    {match.matchday ? ` · Spieltag ${match.matchday}` : ""}
                  </p>
                  <p className="font-display text-sm font-semibold text-ink">
                    {matchTitle(match.sport, homeTeam.name, awayTeam.name)}
                  </p>
                  <p className="text-xs text-muted">
                    Getippt:{" "}
                    {match.tipMode === "1x2"
                      ? oneXTwoText(match.sport, tip.predictedHomeScore, tip.predictedAwayScore, homeTeam.name, awayTeam.name)
                      : scoreText(match.sport, tip.predictedHomeScore, tip.predictedAwayScore)}
                    {match.status === "finished" &&
                      ` · Endstand: ${scoreText(match.sport, match.liveHomeScore, match.liveAwayScore)}`}{" "}
                    · {new Date(tip.submittedAt).toLocaleString("de-DE")}
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
                  <span className="flex items-center gap-1 font-display font-semibold text-gold"><CoinIcon className="h-4 w-4" />{tip.stake}</span>
                </div>
              </div>
            );
          })}
        </div>
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
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => visibilityDraft.set("public")}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      visibilityDraft.value === "public"
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-muted hover:text-ink"
                    }`}
                  >
                    🌐 Öffentlich
                  </button>
                  <button
                    type="button"
                    onClick={() => visibilityDraft.set("friends")}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      visibilityDraft.value === "friends"
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-muted hover:text-ink"
                    }`}
                  >
                    🔒 Nur für Freunde
                  </button>
                <SaveButton
                  dirty={visibilityDraft.dirty}
                  saved={visibilityDraft.saved}
                  onClick={() => visibilityDraft.save((v) => setPhotoVisibility(v))}
                />
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-lg font-semibold text-ink">App</h2>
            {isRegistered && <StartPagePicker />}
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
                    <button
                      type="button"
                      role="switch"
                      aria-checked={designDraft.value}
                      aria-label="Saison-Design an oder aus"
                      onClick={() => designDraft.set(!designDraft.value)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 font-display text-sm font-semibold transition-colors ${
                        designDraft.value ? "border-gold bg-gold/15 text-gold" : "border-edge bg-pitch text-muted"
                      }`}
                    >
                      <span
                        className={`h-3 w-3 rounded-full ${designDraft.value ? "bg-gold" : "bg-muted"}`}
                        aria-hidden
                      />
                      {designDraft.value ? "An" : "Aus"}
                    </button>
                    <SaveButton
                      dirty={designDraft.dirty}
                      saved={designDraft.saved}
                      onClick={() => designDraft.save((on) => seasonDesign.setEnabled(on))}
                    />
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
