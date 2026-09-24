"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { mockLeaderboard } from "@/lib/mockLeaderboard";
import RankBadge from "@/components/RankBadge";
import RankProgress from "@/components/RankProgress";
import { Sport } from "@/lib/types";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

export default function ProfilPage() {
  const {
    displayName,
    setDisplayName,
    freeStars,
    points,
    tipsSubmitted,
    rankIconOptions,
    selectedRankIconId,
    setSelectedRankIconId,
    activeRankIcon,
  } = useUser();
  const { matches, getTeam, myTips } = useAppData();
  const [nameInput, setNameInput] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [profileTab, setProfileTab] = useState<"Übersicht" | "Rang">("Übersicht");

  const sportProgressOptions = rankIconOptions.filter(
    (o) => o.kind === "sport" && o.sport && o.points !== undefined
  );
  const [rangSportTab, setRangSportTab] = useState<Sport | null>(
    sportProgressOptions[0]?.sport ?? null
  );
  const selectedProgress = sportProgressOptions.find((o) => o.sport === rangSportTab);

  const currentRank = mockLeaderboard.find((entry) => entry.isCurrentUser)?.rank;

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
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((current) => {
        const next = [...current];
        next[index] = reader.result as string;
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-8 flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-2xl font-bold text-gold">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[0]} alt="Profilbild" className="h-full w-full object-cover" />
          ) : (
            displayName.slice(0, 1).toUpperCase()
          )}
          {activeRankIcon && (
            <span className="absolute -bottom-1.5 -right-1.5">
              <RankBadge option={activeRankIcon} size="md" />
            </span>
          )}
        </div>
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
            {displayName}
          </h1>
          <p className="text-sm text-muted">
            {currentRank ? `Aktuell Platz ${currentRank} in der Rangliste` : "Noch nicht platziert"}
            {activeRankIcon && ` · ${activeRankIcon.label}`}
          </p>
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

              <div className="mb-3 flex gap-2">
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
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Fotos</h2>
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
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-pitch/80 text-xs text-ink"
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
          Fotos werden aktuell nur lokal in deinem Browser angezeigt (noch keine dauerhafte
          Speicherung ohne Backend).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Statistik</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Gratis-Sterne" value={freeStars.toLocaleString("de-DE")} accent="gold" />
          <StatCard label="Punkte" value={points.toLocaleString("de-DE")} accent="action" />
          <StatCard label="Abgegebene Tipps" value={tipsSubmitted.toLocaleString("de-DE")} accent="ink" />
        </div>
        <p className="mt-3 text-xs text-muted">
          Genauere Statistiken (Trefferquote, Tipp-Verlauf) kommen, sobald Tipps dauerhaft in
          Firestore gespeichert werden.
        </p>
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
        <p className="mt-2 text-xs text-muted">
          Weitere Einstellungen (Benachrichtigungen, Passwort, Konto löschen) kommen mit dem
          echten Login-System.
        </p>
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
