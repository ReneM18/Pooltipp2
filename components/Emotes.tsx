"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SeasonEmote, findEmote, CURRENT_SEASON, CURRENT_EMOTE_LEVEL } from "@/lib/seasons";
import { useUser } from "@/lib/UserContext";
import { EMOJI_CATEGORIES, loadRecentEmojis, rememberEmoji, searchEmojis } from "@/lib/emojiData";

// Saison-Emotes ("Sticker", Belohnung der Art "emotes" im Saison-Pass).
// Gespeichert wird ein Sticker als eigene Nachricht im Format ":id:" (z. B.
// ":herbst26-blatt:") – dafür braucht es keine neue Datenbank-Spalte. Beim
// Anzeigen wird daraus wieder das Bild. Alte Saisons bleiben in
// lib/seasons/index.ts eingetragen, damit ihre Sticker weiter angezeigt werden.

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
 * Vorschau des ausgewählten Stickers über der Textzeile: noch nicht gesendet,
 * mit ✕ wieder entfernbar. Erst der Senden-Knopf verschickt ihn.
 */
export function StickerDraft({ emote, onRemove }: { emote: SeasonEmote; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold/5 p-2">
      <EmoteSticker emote={emote} size={44} />
      <p className="min-w-0 flex-1 text-xs leading-snug text-muted">
        <span className="block font-semibold text-ink">Sticker „{emote.label}“</span>
        Mit ➤ senden – Text dazu ist optional.
      </p>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Sticker entfernen"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-edge bg-pitch text-sm text-muted transition-colors hover:border-red-400 hover:text-red-400"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * 🙂-Knopf mit Auswahl. Reiter „Emojis“: große Auswahl nach Kategorien mit
 * Suche und „Zuletzt benutzt“, Emojis werden in den Text eingefügt. Reiter
 * „Sticker“: Der gewählte Saison-Sticker kommt erst als Vorschau über die
 * Textzeile (StickerDraft) und wird erst mit dem Senden-Knopf verschickt.
 * Gesperrte Sticker zeigen ehrlich, ab welchem Level sie freigeschaltet werden.
 */
export function EmotePicker({
  onInsertEmoji,
  onPickSticker,
  disabled = false,
  placement = "above",
}: {
  onInsertEmoji: (emoji: string) => void;
  onPickSticker: (emote: SeasonEmote) => void;
  disabled?: boolean;
  placement?: "above" | "below";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"emojis" | "sticker">("emojis");
  // Breite so begrenzen, dass die Auswahl rechts nie aus dem Bildschirm ragt
  // (z. B. bei Kommentaren in einer Tipp-Karte, wo der Knopf weiter rechts sitzt).
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (!open && wrapRef.current) {
      const left = wrapRef.current.getBoundingClientRect().left;
      setMaxWidth(Math.max(260, window.innerWidth - left - 12));
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label="Emojis öffnen"
        aria-expanded={open}
        className="flex h-full min-h-[38px] items-center justify-center rounded-lg border border-edge bg-pitch px-2.5 text-lg transition-colors hover:border-gold disabled:opacity-50"
      >
        🙂
      </button>
      {open && (
        <div
          className={`absolute left-0 z-30 flex w-[21rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-card border border-edge bg-surface shadow-2xl ${
            placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
          style={{ maxWidth }}
        >
          <div className="flex gap-1 border-b border-edge p-2" role="tablist">
            {(
              [
                ["emojis", "😀 Emojis"],
                ["sticker", `${CURRENT_SEASON.theme.icon} Sticker`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => setMode(id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
                  mode === id ? "bg-gold/15 text-gold" : "text-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "emojis" ? (
            <EmojiPanel onInsertEmoji={onInsertEmoji} />
          ) : (
            <StickerPanel
              onPickSticker={(emote) => {
                onPickSticker(emote);
                setOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function EmojiPanel({ onInsertEmoji }: { onInsertEmoji: (emoji: string) => void }) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState<string>(EMOJI_CATEGORIES[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const list = loadRecentEmojis();
    setRecent(list);
    if (list.length > 0) setActive("zuletzt");
  }, []);

  const sections = [
    ...(recent.length > 0
      ? [{ id: "zuletzt", label: "Zuletzt benutzt", icon: "🕘", emojis: recent }]
      : []),
    ...EMOJI_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon, emojis: c.emojis.map((e) => e.emoji) })),
  ];
  const results = query.trim() ? searchEmojis(query) : null;

  function pick(emoji: string) {
    onInsertEmoji(emoji);
    setRecent((cur) => rememberEmoji(emoji, cur));
  }

  function jumpTo(id: string) {
    const box = scrollRef.current;
    const el = sectionRefs.current[id];
    if (!box || !el) return;
    box.scrollTo({ top: el.offsetTop - box.offsetTop, behavior: "smooth" });
    setActive(id);
  }

  function onScroll() {
    const box = scrollRef.current;
    if (!box) return;
    const top = box.scrollTop + 8;
    let current = sections[0]?.id;
    for (const sec of sections) {
      const el = sectionRefs.current[sec.id];
      if (el && el.offsetTop - box.offsetTop <= top) current = sec.id;
    }
    if (current && current !== active) setActive(current);
  }

  const grid = (emojis: string[]) => (
    <div className="grid grid-cols-8">
      {emojis.map((emoji, i) => (
        <button
          key={`${emoji}-${i}`}
          type="button"
          onClick={() => pick(emoji)}
          className="flex h-10 items-center justify-center rounded-md text-2xl leading-none transition-transform hover:scale-110 hover:bg-surface-hover"
          aria-label={`Emoji ${emoji} einfügen`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="px-2 pt-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen, z. B. Pokal"
          aria-label="Emoji suchen"
          className="w-full rounded-full border border-edge bg-pitch px-3 py-1.5 text-base text-ink outline-none placeholder:text-muted/70 focus:border-gold sm:text-sm"
        />
      </div>
      {!results && (
        <div className="flex justify-between gap-0.5 px-2 pt-2" aria-label="Kategorien">
          {sections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => jumpTo(sec.id)}
              title={sec.label}
              aria-label={sec.label}
              className={`flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border-b-2 text-lg leading-none transition-colors ${
                active === sec.id ? "border-gold bg-gold/10" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {sec.icon}
            </button>
          ))}
        </div>
      )}
      <div ref={scrollRef} onScroll={onScroll} className="h-64 overflow-y-auto overscroll-contain px-2 pb-2 pt-1">
        {results ? (
          results.length > 0 ? (
            grid(results)
          ) : (
            <p className="px-1 py-6 text-center text-sm text-muted">Kein passendes Emoji gefunden.</p>
          )
        ) : (
          sections.map((sec) => (
            <section
              key={sec.id}
              ref={(el) => {
                sectionRefs.current[sec.id] = el;
              }}
            >
              <p className="sticky top-0 z-10 bg-surface px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                {sec.label}
              </p>
              {grid(sec.emojis)}
            </section>
          ))
        )}
      </div>
    </>
  );
}

function StickerPanel({ onPickSticker }: { onPickSticker: (emote: SeasonEmote) => void }) {
  const { passHonors } = useUser();
  const ownedIds = new Set(passHonors.emotes.map((e) => e.id));
  const unlocked = CURRENT_SEASON.emotes.every((e) => ownedIds.has(e.id));
  // Ältere Saison-Sticker, die man behalten hat, stehen unter dem aktuellen Paket.
  const olderOwned = passHonors.emotes.filter((e) => !CURRENT_SEASON.emotes.some((c) => c.id === e.id));

  return (
    <div className="p-3">
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
              onClick={() => onPickSticker(emote)}
              className={`flex items-center justify-center rounded-lg p-0.5 transition-transform ${
                owned ? "hover:scale-110" : "cursor-not-allowed opacity-35 grayscale"
              }`}
              aria-label={owned ? `Sticker „${emote.label}“ auswählen` : `${emote.label} (gesperrt)`}
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
              onClick={() => onPickSticker(emote)}
              className="flex items-center justify-center rounded-lg p-0.5 hover:scale-110"
              aria-label={`Sticker „${emote.label}“ auswählen`}
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
  );
}
