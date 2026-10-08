"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { mockLeaderboard } from "@/lib/mockLeaderboard";
import { getMockUserProfile } from "@/lib/mockUsers";
import { usePlayerRankIcons } from "@/lib/playerRankIcons";
import FitText from "@/components/FitText";
import RankMeaningBadge from "@/components/RankMeaningBadge";
import { useChat } from "@/lib/ChatContext";
import { ChatIcon } from "@/components/Icons";
import { avatarHue } from "@/components/PlayerAvatar";
import { usePlayerPhoto } from "@/lib/playerPhotos";
import SeasonFrame, { OtherFrameRing } from "@/components/SeasonFrame";
import PassHonorTags, { useOtherPlayersFrames, useOtherPlayersHonors } from "@/components/PassHonors";

export default function SpielerProfilPage() {
  const params = useParams();
  const router = useRouter();
  const { authUserId, displayName, friends, friendEntries, pendingRequests, photos: myPhotos, activeRankIcon, shownPassHonors } = useUser();
  const { openChat } = useChat();
  const rankIcons = usePlayerRankIcons();

  const name = decodeURIComponent(
    Array.isArray(params.name) ? params.name[0] : params.name ?? ""
  );

  const isSelf = name === displayName;
  const isFriend = friends.includes(name);
  const isPending = pendingRequests.includes(name);
  const friendEntry = friendEntries.find((f) => f.relation === "friend" && f.name === name);
  const profile = getMockUserProfile(name);
  const leaderboardEntry = mockLeaderboard.find((e) => e.name === name);
  // Eigenes Icon = das im Profil gewählte, bei anderen aus ihren echten Rangpunkten.
  const rankIcon = isSelf ? activeRankIcon : rankIcons.byName(name);
  const hue = avatarHue(friendEntry?.id ?? name);
  const photosVisible = isSelf || isFriend || profile.photoVisibility === "public";
  // Pass-Rahmen, Titel und Abzeichen, so wie der Spieler sie zeigen will.
  const playerId = friendEntry?.id ?? rankIcons.idByName(name);
  const otherFrame = useOtherPlayersFrames(isSelf ? [] : [playerId])[playerId ?? ""];
  const otherHonors = useOtherPlayersHonors(isSelf ? [] : [playerId])[playerId ?? ""];
  const honors = isSelf ? shownPassHonors : otherHonors;
  // Profilbild (eigenes bzw. das des Spielers, wenn er es zeigen lässt).
  const avatarPhoto = usePlayerPhoto(isSelf ? authUserId : playerId);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <button
        onClick={() => router.back()}
        className="mb-5 flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        ← Zurück
      </button>

      <div className="mb-6 flex items-center gap-6">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
          {/* Eigener Rahmen wie im Profil, bei anderen ihr gewählter Rahmen
              (gleich groß wie der Kreis, damit nichts verrutscht). */}
          {isSelf ? (
            <SeasonFrame size={58}>
              <span className="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full bg-surface font-display text-2xl font-bold text-gold">
                {avatarPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPhoto} alt="Profilbild" className="h-full w-full object-cover" />
                ) : (
                  name.slice(0, 1).toUpperCase()
                )}
              </span>
            </SeasonFrame>
          ) : (
            <OtherFrameRing frame={otherFrame} size={64}>
              {(inner) =>
                avatarPhoto ? (
                  <span className="flex overflow-hidden rounded-full bg-surface" style={{ width: inner, height: inner }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarPhoto} alt={`Profilbild von ${name}`} className="h-full w-full object-cover" />
                  </span>
                ) : (
                <span
                  className="flex items-center justify-center rounded-full font-display text-2xl font-bold"
                  // Andere Spieler in ihrer festen Farbe wie im Chat und in der Rangliste.
                  style={{ width: inner, height: inner, background: `hsl(${hue} 38% 26%)`, color: `hsl(${hue} 70% 82%)` }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
                )
              }
            </OtherFrameRing>
          )}
          {/* Rang-Abzeichen in der Ecke des Profilbilds – größer als in Listen,
              weil Bild und Name hier groß sind. Bedeutung poppt bei
              Hover/Antippen auf. Ragt etwas über den Rand hinaus, damit es
              möglichst wenig vom Foto verdeckt. */}
          {rankIcon && (
            <span className="absolute -bottom-1.5 -right-3 z-10">
              <RankMeaningBadge option={rankIcon} size="profil" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
            {/* Lange Einzelwort-Namen schrumpfen statt rechts abgeschnitten zu werden. */}
            <FitText text={name} minPx={14} />
            {isSelf && <span className="shrink-0 text-sm font-medium text-muted">(Du)</span>}
          </h1>
          <p className="text-sm text-muted">
            {leaderboardEntry ? `Platz ${leaderboardEntry.rank} in der Gesamt-Rangliste` : "Noch nicht platziert"}
          </p>
          {honors && (honors.title || honors.badges.length > 0) && (
            <div className="mt-2">
              <PassHonorTags honors={honors} />
            </div>
          )}
        </div>
      </div>

      {!isSelf && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4">
          <div className="min-w-[12rem] flex-1">
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
          {!isFriend && !isPending && (
            // Namen sind nicht eindeutig – die Anfrage läuft über die Suche
            // auf der Freunde-Seite, dort steht zu jedem Namen die Nummer.
            <Link
              href={`/freunde?suche=${encodeURIComponent(name)}`}
              className="shrink-0 rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              Anfrage senden
            </Link>
          )}
          {isFriend && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {friendEntry && (
                <button
                  type="button"
                  onClick={() => openChat(friendEntry.id)}
                  className="flex items-center gap-1.5 rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
                >
                  <ChatIcon className="h-4 w-4" />
                  Schreiben
                </button>
              )}
              <Link
                href={`/duelle?gegner=${encodeURIComponent(name)}`}
                className="rounded-full bg-gold px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:opacity-90"
              >
                ⚔️ Herausfordern
              </Link>
            </div>
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
          isSelf ? (
            // Für die eigene Person zeigen wir die echten hochgeladenen
            // Fotos aus dem Profil (global im UserContext), statt der
            // dekorativen Mock-Platzhalter der anderen User.
            myPhotos.some((p) => p) ? (
              <div className="grid grid-cols-3 gap-3">
                {myPhotos.map((photo, i) =>
                  photo ? (
                    <div
                      key={i}
                      className="aspect-square overflow-hidden rounded-card border border-edge"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
                Noch keine Fotos hochgeladen.
              </p>
            )
          ) : profile.photos.length > 0 ? (
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
