"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SeasonEmote, findEmote, CURRENT_SEASON, CURRENT_EMOTE_LEVEL } from "@/lib/seasons";
import { useUser } from "@/lib/UserContext";

// Saison-Emotes ("Sticker", Belohnung der Art "emotes" im Saison-Pass).
// Gespeichert wird ein Sticker als eigene Nachricht im Format ":id:" (z. B.
// ":herbst26-blatt:") – dafür braucht es keine neue Datenbank-Spalte. Beim
// Anzeigen wird daraus wieder das Bild. Alte Saisons bleiben in
// lib/seasons/index.ts eingetragen, damit ihre Sticker weiter angezeigt werden.

/** Basis-Emojis, die jeder ohne Saison-Pass benutzen kann. */
export const BASE_EMOJIS = ["👍", "😂", "🔥", "⚽", "👏", "😮", "😢", "🙈"];

const STICKER_PATTERN = /^:([a-z0-9-]+):$/;

/** Liefert das Emote, wenn die GANZE Nachricht ein Sticker ist. */
export function stickerFromText(text: string): SeasonEmote | undefined {
  const match = STICKER_PATTERN.exec(text.trim());
  return match ? findEmote(match[1]) : undefined;
}

export function stickerText(emote: SeasonEmote): string {
  return `:${emote.id}:`;
}

export function EmoteSticker({ emote, size = 56 }: { emote: SeasonEmote; size?: number }) {
  const { colorFrom, colorTo } = CURRENT_SEASON.theme;
  return (
    <span
      role="img"
      aria-label={emote.label}
      title={emote.label}
      className="relative inline-flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${colorFrom}55, ${colorTo}33 70%)`,
        border: `1px solid ${colorFrom}66`,
        fontSize: size * 0.55,
        lineHeight: 1,
      }}
    >
      {emote.emoji}
      {emote.accent && (
        <span className="absolute" style={{ right: size * 0.04, bottom: size * 0.02, fontSize: size * 0.3 }}>
          {emote.accent}
        </span>
      )}
    </span>
  );
}

/** Text einer Chat-Nachricht/eines Kommentars – ein Sticker wird als Bild gezeigt. */
export function MessageBody({ text }: { text: string }) {
  const sticker = stickerFromText(text);
  if (sticker) return <EmoteSticker emote={sticker} size={56} />;
  return <>{text}</>;
}

/**
 * 🙂-Knopf mit Auswahl: Basis-Emojis werden in den Text eingefügt, Saison-
 * Sticker werden direkt als eigene Nachricht gesendet. Gesperrte Sticker
 * zeigen ehrlich, ab welchem Level sie freigeschaltet werden.
 */
export function EmotePicker({
  onInsertEmoji,
  onSendSticker,
  disabled = false,
  placement = "above",
}: {
  onInsertEmoji: (emoji: string) => void;
  onSendSticker: (emote: SeasonEmote) => void;
  disabled?: boolean;
  placement?: "above" | "below";
}) {
  const { passHonors } = useUser();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ownedIds = new Set(passHonors.emotes.map((e) => e.id));
  const unlocked = CURRENT_SEASON.emotes.every((e) => ownedIds.has(e.id));
  // Ältere Saison-Sticker, die man behalten hat, stehen unter dem aktuellen Paket.
  const olderOwned = passHonors.emotes.filter((e) => !CURRENT_SEASON.emotes.some((c) => c.id === e.id));

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Emotes öffnen"
        aria-expanded={open}
        className="flex h-full min-h-[38px] items-center justify-center rounded-lg border border-edge bg-pitch px-2.5 text-lg transition-colors hover:border-gold disabled:opacity-50"
      >
        🙂
      </button>
      {open && (
        <div
          className={`absolute left-0 z-30 w-[17rem] max-w-[calc(100vw-2.5rem)] rounded-card border border-edge bg-surface p-3 shadow-2xl ${
            placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Für alle</p>
          <div className="mb-3 grid grid-cols-8 gap-1">
            {BASE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onInsertEmoji(emoji)}
                className="flex h-8 items-center justify-center rounded-md text-xl hover:bg-surface-hover"
                aria-label={`Emoji ${emoji} einfügen`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <p className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-gold">
            <span>
              {CURRENT_SEASON.theme.icon} Paket „{CURRENT_SEASON.theme.name}“
            </span>
            {!unlocked && CURRENT_EMOTE_LEVEL && (
              <span className="whitespace-nowrap normal-case tracking-normal text-muted">
                🔒 ab Level {CURRENT_EMOTE_LEVEL.level}
              </span>
            )}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {CURRENT_SEASON.emotes.map((emote) => {
              const owned = ownedIds.has(emote.id);
              return (
                <button
                  key={emote.id}
                  type="button"
                  disabled={!owned}
                  onClick={() => {
                    onSendSticker(emote);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-center rounded-lg p-0.5 transition-transform ${
                    owned ? "hover:scale-110" : "cursor-not-allowed opacity-35 grayscale"
                  }`}
                  aria-label={owned ? `Sticker „${emote.label}“ senden` : `${emote.label} (gesperrt)`}
                >
                  <EmoteSticker emote={emote} size={48} />
                </button>
              );
            })}
          </div>
          {olderOwned.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {olderOwned.map((emote) => (
                <button
                  key={emote.id}
                  type="button"
                  onClick={() => {
                    onSendSticker(emote);
                    setOpen(false);
                  }}
                  className="flex items-center justify-center rounded-lg p-0.5 hover:scale-110"
                  aria-label={`Sticker „${emote.label}“ senden`}
                >
                  <EmoteSticker emote={emote} size={48} />
                </button>
              ))}
            </div>
          )}
          {!unlocked && (
            <p className="mt-2 text-[11px] leading-snug text-muted">
              Sammle Saison-XP (täglicher Bonus), dann schaltest du die Sticker frei.{" "}
              <Link href="/fortschritt" className="font-semibold text-gold hover:underline">
                Zum Saison-Pass
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
