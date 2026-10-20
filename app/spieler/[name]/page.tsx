"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabaseClient";
import SportBioCard, { SportBioTag } from "@/components/SportBioCard";
import { useSportBio } from "@/lib/sportBio";
import { ProfileRow, loadProfiles, sumPoints, toPointsBySport } from "@/lib/globalLeaderboard";
import { RivalCompare as Compare, compareRival } from "@/lib/rivals";
import { CompareTable } from "@/components/RivalCompare";
import TippTypCard from "@/components/TippTyp";
import { usePlayerRankIcons } from "@/lib/playerRankIcons";
import FitText from "@/components/FitText";
import RankMeaningBadge from "@/components/RankMeaningBadge";
import { useChat } from "@/lib/ChatContext";
import { ChatIcon } from "@/components/Icons";
import { avatarHue } from "@/components/PlayerAvatar";
import { usePlayerPhoto } from "@/lib/playerPhotos";
import SeasonFrame, { OtherFrameRing } from "@/components/SeasonFrame";
import PassHonorTags, { useOtherPlayersFrames, useOtherPlayersHonors } from "@/components/PassHonors";

// Seite eines anderen Spielers (Rene, 12.10.2026: echte Daten statt Demo).
// Die eigene Seite leitet gleich aufs richtige Profil weiter.
type Gallery = { visibility: string; allowed: boolean; photos: string[]; missing?: boolean };

export default function SpielerProfilPage() {
  const params = useParams();
  const router = useRouter();
  const { authUserId, displayName, profileLoaded, friends, friendEntries, pendingRequests, activeRankIcon, shownPassHonors } =
    useUser();
  const { openChat } = useChat();
  const rankIcons = usePlayerRankIcons();

  const name = decodeURIComponent(
    Array.isArray(params.name) ? params.name[0] : params.name ?? ""
  );

  const isSelf = !!authUserId && profileLoaded && name === displayName;
  const isFriend = friends.includes(name);
  const isPending = pendingRequests.includes(name);
  const friendEntry = friendEntries.find((f) => f.relation === "friend" && f.name === name);

  // Eigene Seite: gleich ins richtige Profil.
  useEffect(() => {
    if (isSelf) router.replace("/profil");
  }, [isSelf, router]);
  // Eigenes Icon = das im Profil gewählte, bei anderen aus ihren echten Rangpunkten.
  const rankIcon = isSelf ? activeRankIcon : rankIcons.byName(name);
  const hue = avatarHue(friendEntry?.id ?? name);
  // Pass-Rahmen, Titel und Abzeichen, so wie der Spieler sie zeigen will.
  const playerId = friendEntry?.id ?? rankIcons.idByName(name);
  const otherFrame = useOtherPlayersFrames(isSelf ? [] : [playerId])[playerId ?? ""];
  const otherHonors = useOtherPlayersHonors(isSelf ? [] : [playerId])[playerId ?? ""];
  const honors = isSelf ? shownPassHonors : otherHonors;
  // Profilbild (eigenes bzw. das des Spielers, wenn er es zeigen lässt).
  const avatarPhoto = usePlayerPhoto(isSelf ? authUserId : playerId);
  // Sport-Steckbrief: die Datenbank prüft, ob man ihn sehen darf (alle/Freunde/niemand).
  const sportBio = useSportBio(isSelf ? authUserId : playerId);

  // Platz in der Gesamt-Rangliste (gleiche Rechnung wie dort: Summe der
  // Rangpunkte, gleiche Punkte = gleicher Platz, nur Spieler mit Punkten).
  const [rows, setRows] = useState<ProfileRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadProfiles(() => cancelled).then((res) => {
      if (!cancelled && "rows" in res) setRows(res.rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const row = rows?.find((r) => r.id === playerId) ?? rows?.find((r) => r.display_name === name);
  const total = row ? sumPoints(toPointsBySport(row.rang_punkte)) : 0;
  const totals = (rows ?? []).map((r) => sumPoints(toPointsBySport(r.rang_punkte))).filter((t) => t > 0);
  const place = total > 0 ? 1 + totals.filter((t) => t > total).length : null;

  // Statistik wie beim Rivalen-Vergleich (nur, wenn er sie freigibt).
  const [compare, setCompare] = useState<Compare | null | "fehlt">(null);
  useEffect(() => {
    if (!authUserId || !playerId || isSelf) return;
    let cancelled = false;
    compareRival(playerId).then((res) => {
      if (!cancelled) setCompare(res ?? "fehlt");
    });
    return () => {
      cancelled = true;
    };
  }, [authUserId, playerId, isSelf]);

  // Echte Fotos (bis zu 3), nur wenn er sie zeigt (supabase/spielerseite.sql).
  const [gallery, setGallery] = useState<Gallery | null>(null);
  useEffect(() => {
    if (!playerId || isSelf) return;
    let cancelled = false;
    supabase.rpc("player_gallery", { p_id: playerId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setGallery({ visibility: "friends", allowed: false, photos: [], missing: true });
        return;
      }
      const g = data as Partial<Gallery>;
      setGallery({
        visibility: g.visibility === "public" ? "public" : "friends",
        allowed: !!g.allowed,
        photos: (Array.isArray(g.photos) ? g.photos : []).filter(
          (x): x is string => typeof x === "string" && x.startsWith("data:image/")
        ),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [playerId, isSelf, isFriend]);

  if (isSelf) {
    return <main className="mx-auto max-w-3xl px-5 py-8 text-sm text-muted">Weiter zu deinem Profil…</main>;
  }

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
            {rows === null
              ? "\u00a0"
              : place
                ? `Platz ${place} von ${totals.length} in der Gesamt-Rangliste · ${total.toLocaleString("de-DE")} Rangpunkte`
                : "Noch keine Rangpunkte"}
          </p>
          <SportBioTag bio={sportBio.bio} />
          {honors && (honors.title || honors.badges.length > 0) && (
            <div className="mt-2">
              <PassHonorTags honors={honors} />
            </div>
          )}
        </div>
      </div>

      <SportBioCard bio={sportBio.bio} userId={isSelf ? authUserId : playerId} name={name} photo={avatarPhoto} rankIcon={rankIcon} place={place} points={rows === null ? null : total} />

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

      {authUserId && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Statistik</h2>
          {compare === null ? (
            <p className="text-sm text-muted">Lädt…</p>
          ) : compare === "fehlt" ? (
            <p className="text-sm text-muted">Die Statistik kann gerade nicht geladen werden.</p>
          ) : !compare.other.visible ? (
            <p className="rounded-card border border-dashed border-edge bg-surface p-5 text-center text-sm text-muted">
              🔒 {name} zeigt seine Statistik nicht.
            </p>
          ) : (
            <div className="rounded-card border border-edge bg-surface p-4">
              <p className="mb-2 text-xs text-muted">Du im Vergleich mit {name} – der bessere Wert ist grün.</p>
              <CompareTable data={compare} />
            </div>
          )}
          {compare !== null && compare !== "fehlt" && compare.other.visible && playerId && (
            <TippTypCard
              userId={playerId}
              playerName={name}
              own={false}
              heading={<p className="mb-2 font-display text-sm font-semibold text-ink">Tipp-Typ</p>}
            />
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Fotos</h2>
          {gallery && !gallery.missing && (
            <span className="text-xs text-muted">
              {gallery.visibility === "public" ? "🌐 Öffentlich" : "🔒 Nur für Freunde"}
            </span>
          )}
        </div>

        {gallery === null ? (
          <p className="text-sm text-muted">Lädt…</p>
        ) : gallery.missing ? (
          <p className="text-sm text-muted">Die Fotos werden gerade freigeschaltet.</p>
        ) : !gallery.allowed ? (
          <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-edge bg-surface p-8 text-center">
            <span className="text-3xl">🔒</span>
            <p className="text-sm font-semibold text-ink">Fotos sind privat</p>
            <p className="text-xs text-muted">Sichtbar, sobald ihr befreundet seid.</p>
          </div>
        ) : gallery.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {gallery.photos.map((photo, i) => (
              <div key={i} className="aspect-square overflow-hidden rounded-card border border-edge">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Foto ${i + 1} von ${name}`} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
            Noch keine Fotos hochgeladen.
          </p>
        )}
      </section>
    </main>
  );
}
