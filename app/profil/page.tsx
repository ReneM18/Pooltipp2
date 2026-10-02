"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import AccountSettings from "@/components/AccountSettings";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { mockLeaderboard } from "@/lib/mockLeaderboard";
import RankBadge from "@/components/RankBadge";
import RankProgress from "@/components/RankProgress";
import SeasonFrame from "@/components/SeasonFrame";
import RankMeaningBadge from "@/components/RankMeaningBadge";
import FavoriteClubs from "@/components/FavoriteClubs";
import WelcomeBanner from "@/components/WelcomeBanner";
import FitText from "@/components/FitText";
import PassHonorTags from "@/components/PassHonors";
import { useFeedback } from "@/lib/FeedbackContext";
import { Sport } from "@/lib/types";
import { SEASON_THEME } from "@/lib/seasonTheme";
import { CURRENT_SEASON } from "@/lib/seasons";
import { xpForLevel } from "@/lib/seasonPass";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

export default function ProfilPage() {
  const {
    displayName,
    userNumber,
    setDisplayName,
    freeStars,
    passXP,
    passClaims,
    passHonors,
    tipsSubmitted,
    rankIconOptions,
    selectedRankIconId,
    setSelectedRankIconId,
    activeRankIcon,
    photoVisibility,
    setPhotoVisibility,
    photos,
    setPhoto,
    removePhoto,
    streakCount,
    hasAdFreeSubscription,
    hasPremiumPass,
    isRegistered,
    authEmail,
    authUserId,
    logout,
  } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);
  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }
  const { matches, getTeam, myTips } = useAppData();
  const { showToast, celebrate } = useFeedback();
  const [nameInput, setNameInput] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const [profileTab, setProfileTab] = useState<"Übersicht" | "Rang">("Übersicht");

  const sportProgressOptions = rankIconOptions.filter(
    (o) => o.kind === "sport" && o.sport && o.points !== undefined
  );
  const [rangSportTab, setRangSportTab] = useState<Sport | null>(
    sportProgressOptions[0]?.sport ?? null
  );
  const selectedProgress = sportProgressOptions.find((o) => o.sport === rangSportTab);

  const currentRank = mockLeaderboard.find((entry) => entry.isCurrentUser)?.rank;

  // Premium-Pass-Stufen (siehe lib/passLevels.ts): true, sobald die Premium-Spur
  // gekauft UND das jeweilige Level per Pass-XP erreicht ist.
  const hasLevelPremium = (level: number) => hasPremiumPass && passXP >= xpForLevel(level);
  const playedEarlierSeason = passClaims.some((c) => !c.startsWith(`${CURRENT_SEASON.theme.id}:`));

  const evaluatedTips = myTips.filter((t) => t.evaluated && !t.refunded);
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
            <span className="absolute -bottom-2 -right-2 rounded-full">
              <RankMeaningBadge option={activeRankIcon} size="md" />
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
            {currentRank ? `Aktuell Platz ${currentRank} in der Rangliste` : "Noch nicht platziert"}
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

      {/* Reiter: Übersicht (Fotos, Statistik, Einstellungen, Historie) vs. Rang (Icons, Fortschritt) */}
      <div className="mb-6 flex gap-2">
        {(["Übersicht", "Rang"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setProfileTab(t)}
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
          {rankIconOptions.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-1 font-display text-lg font-semibold text-ink">Dein Rang-Icon</h2>
              <p className="mb-3 text-xs text-muted">
                Wähle, welches Icon neben deinem Namen in Rangliste, Profil und Chat angezeigt wird.
              </p>
              <div className="flex flex-wrap gap-3">
                {rankIconOptions.map((option) => {
                  const active = option.id === selectedRankIconId;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedRankIconId(option.id)}
                      className={`flex items-center gap-2 rounded-card border px-3 py-2 text-left transition-colors ${
                        active
                          ? "border-gold bg-surface-hover"
                          : "border-edge bg-surface hover:border-muted"
                      }`}
                    >
                      <RankBadge option={option} size="md" />
                      <span className="text-xs font-medium text-ink">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

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
                    {o.sport}
                  </button>
                ))}
              </div>

              {selectedProgress && (
                <RankProgress sport={selectedProgress.sport!} points={selectedProgress.points!} />
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

        <div className="mb-4 flex flex-col gap-2 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Wer darf deine Fotos sehen?</p>
            <p className="text-xs text-muted">
              Gilt für dein Profil, wenn andere User dich antippen (z. B. in der Rangliste).
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setPhotoVisibility("public")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                photoVisibility === "public"
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-edge bg-pitch text-muted hover:text-ink"
              }`}
            >
              🌐 Öffentlich
            </button>
            <button
              onClick={() => setPhotoVisibility("friends")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                photoVisibility === "friends"
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-edge bg-pitch text-muted hover:text-ink"
              }`}
            >
              🔒 Nur für Freunde
            </button>
          </div>
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
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Statistik</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Gratis-Sterne" value={freeStars.toLocaleString("de-DE")} accent="gold" />
          <StatCard label="Pass-XP" value={passXP.toLocaleString("de-DE")} accent="action" />
          <StatCard label="Abgegebene Tipps" value={tipsSubmitted.toLocaleString("de-DE")} accent="ink" />
          <StatCard label="Tipp-Streak" value={`🔥 ${streakCount.toLocaleString("de-DE")}`} accent="gold" />
        </div>
        <p className="mt-3 text-xs text-muted">
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
              className="mt-4 w-full rounded-full bg-gold py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
            >
              📋 Rückblick kopieren
            </button>
          </div>
        </section>
      )}

      <FavoriteClubs />

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
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Einstellungen</h2>
        <form
          onSubmit={handleSaveName}
          className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Anzeigename</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            {saved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </form>

        {isRegistered ? (
          <>
            <div className="mt-4 flex items-center justify-between rounded-card border border-edge bg-surface p-4">
              <div>
                <p className="text-xs text-muted">Angemeldet als</p>
                <p className="text-sm font-semibold text-ink">{authEmail}</p>
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
            className="mt-4 flex items-center justify-between rounded-card border border-edge bg-surface p-4 transition-colors hover:border-gold/60"
          >
            <span className="text-sm text-muted">Noch nicht eingeloggt</span>
            <span className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold">
              Registrieren / Einloggen →
            </span>
          </Link>
        )}
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Meine Tipp-Historie</h2>
        <div className="flex flex-col gap-3">
          {myTips.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">Noch keine Tipps abgegeben.</p>
          )}
          {[...myTips].reverse().map((tip) => {
            const match = matches.find((m) => m.id === tip.matchId);
            if (!match) return null;
            const homeTeam = getTeam(match.homeTeamId);
            const awayTeam = getTeam(match.awayTeamId);
            if (!homeTeam || !awayTeam) return null;

            return (
              <div
                key={tip.id}
                className="flex items-center justify-between rounded-card border border-edge bg-surface px-5 py-4"
              >
                <div>
                  <p className="text-xs text-muted">
                    {sportIcon[match.sport]} {match.competition}
                    {match.matchday ? ` · Spieltag ${match.matchday}` : ""}
                  </p>
                  <p className="font-display text-sm font-semibold text-ink">
                    {homeTeam.name} vs {awayTeam.name}
                  </p>
                  <p className="text-xs text-muted">
                    Getippt:{" "}
                    {match.tipMode === "1x2"
                      ? tip.predictedHomeScore > tip.predictedAwayScore
                        ? "1 (Heimsieg)"
                        : tip.predictedAwayScore > tip.predictedHomeScore
                        ? "2 (Auswärtssieg)"
                        : "X (Unentschieden)"
                      : `${tip.predictedHomeScore}:${tip.predictedAwayScore}`}
                    {match.status === "finished" &&
                      ` · Endstand: ${match.liveHomeScore}:${match.liveAwayScore}`}{" "}
                    · {new Date(tip.submittedAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <span className="font-display font-semibold text-gold">⭐ {tip.stake}</span>
              </div>
            );
          })}
        </div>
      </section>
        </>
      )}
    </main>
  );
}

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
