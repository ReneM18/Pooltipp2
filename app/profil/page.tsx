"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useUser } from "@/lib/UserContext";
import { mockLeaderboard } from "@/lib/mockLeaderboard";

export default function ProfilPage() {
  const { displayName, setDisplayName, freeStars, points, tipsSubmitted } = useUser();
  const [nameInput, setNameInput] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);

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
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface font-display text-2xl font-bold text-gold">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[0]} alt="Profilbild" className="h-full w-full object-cover" />
          ) : (
            displayName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{displayName}</h1>
          <p className="text-sm text-muted">
            {currentRank ? `Aktuell Platz ${currentRank} in der Rangliste` : "Noch nicht platziert"}
          </p>
        </div>
      </div>

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
