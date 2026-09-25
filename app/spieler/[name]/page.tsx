"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { mockLeaderboard } from "@/lib/mockLeaderboard";
import { getMockUserProfile } from "@/lib/mockUsers";
import { getIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";

export default function SpielerProfilPage() {
  const params = useParams();
  const router = useRouter();
  const { displayName, friends, pendingRequests, sendFriendRequest } = useUser();

  const name = decodeURIComponent(
    Array.isArray(params.name) ? params.name[0] : params.name ?? ""
  );

  const isSelf = name === displayName;
  const isFriend = friends.includes(name);
  const isPending = pendingRequests.includes(name);
  const profile = getMockUserProfile(name);
  const leaderboardEntry = mockLeaderboard.find((e) => e.name === name);
  const rankIcon = getIconForName(name);
  const photosVisible = isSelf || isFriend || profile.photoVisibility === "public";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        ← Zurück
      </button>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface font-display text-2xl font-bold text-gold">
          {name.slice(0, 1).toUpperCase()}
          {rankIcon && (
            <span className="absolute -bottom-2 -right-2 rounded-full ring-[3px] ring-pitch">
              <RankBadge option={rankIcon} size="md" />
            </span>
          )}
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">
            {name}
            {isSelf && <span className="ml-2 text-sm font-medium text-muted">(Du)</span>}
          </h1>
          <p className="text-sm text-muted">
            {leaderboardEntry ? `Platz ${leaderboardEntry.rank} in der Gesamt-Rangliste` : "Noch nicht platziert"}
          </p>
          {/* Rang-Icon groß & deutlich als Abzeichen zeigen, statt nur als
              winziges Eck-Icon – damit andere auf einen Blick sehen, welchen
              Rang jemand erreicht hat. */}
          {rankIcon && (
            <span
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 font-display text-xs font-bold"
              style={{
                background: `linear-gradient(135deg, ${rankIcon.colorFrom}, ${rankIcon.colorTo})`,
                color: rankIcon.colorText,
              }}
            >
              <span className="text-sm">{rankIcon.icon}</span>
              {rankIcon.label}
              {rankIcon.title && <span className="opacity-80">· {rankIcon.title}</span>}
            </span>
          )}
        </div>
      </div>

      {!isSelf && (
        <div className="mb-6 flex items-center justify-between rounded-card border border-edge bg-surface p-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              {isFriend ? "Ihr seid befreundet" : isPending ? "Anfrage gesendet" : "Noch nicht befreundet"}
            </p>
            <p className="text-xs text-muted">
              {isFriend
                ? "Ihr könnt gegenseitig eure privaten Fotos sehen."
                : isPending
                ? "Wartet auf Bestätigung durch die andere Person."
                : "Freundschaftsanfrage senden, um private Fotos freizuschalten."}
            </p>
          </div>
          {!isFriend && (
            <button
              onClick={() => sendFriendRequest(name)}
              disabled={isPending}
              className="shrink-0 rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Ausstehend…" : "Anfrage senden"}
            </button>
          )}
        </div>
      )}

      {profile.bio && <p className="mb-6 text-sm text-muted">{profile.bio}</p>}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Fotos</h2>
          {!isSelf && (
            <span className="text-xs text-muted">
              {profile.photoVisibility === "public" ? "🌐 Öffentlich" : "🔒 Nur für Freunde"}
            </span>
          )}
        </div>

        {photosVisible ? (
          profile.photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {profile.photos.map((photo, i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center rounded-card border border-edge text-4xl"
                  style={{
                    background: `linear-gradient(135deg, ${photo.from}, ${photo.to})`,
                  }}
                >
                  {photo.emoji}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
              Noch keine Fotos hochgeladen.
            </p>
          )
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-edge bg-surface p-8 text-center">
            <span className="text-3xl">🔒</span>
            <p className="text-sm font-semibold text-ink">Fotos sind privat</p>
            <p className="text-xs text-muted">
              Sichtbar, sobald {name} deine Freundschaftsanfrage angenommen hat.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
