"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import type { SeasonEmote } from "@/lib/seasons";
import { EmotePicker, MessageBody, StickerDraft, stickerFromText, stickerText } from "./Emotes";
import PassHonorTags, { useOtherPlayersHonors } from "./PassHonors";
import { ThumbUpIcon, TrashIcon } from "./Icons";

// Kommentare zu einer News-Meldung (Rene, 09.10.2026) – gleiche Bedienung wie
// bei den Spielen: Text, Smileys und die selbst verdienten Sticker, Daumen
// hoch, eigene löschen. Gespeichert in derselben Tabelle wie die
// Spielkommentare (match_comments) unter der Kennung "news:<id>", darum kein
// SQL nötig; Realtime kommt mit. Die Spielkarten nutzen weiter ihren eigenen
// Kommentarbereich (unverändert).
export default function CommentThread({ threadId }: { threadId: string }) {
  const { getCommentsForMatch, addComment, removeComment, toggleCommentLike } = useAppData();
  const { displayName, passHonors, shownPassHonors, authUserId, sessionChecked } = useUser();
  const isGuest = sessionChecked && !authUserId;
  const [draft, setDraft] = useState("");
  const [sticker, setSticker] = useState<SeasonEmote | null>(null);
  const submittingRef = useRef(false);
  const comments = getCommentsForMatch(threadId);
  const honorsById = useOtherPlayersHonors(comments.map((c) => (c.userId === authUserId ? null : c.userId)));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!draft.trim() && !sticker) || submittingRef.current) return;
    // Sticker-Code von Hand eingetippt, ohne den Sticker zu besitzen: nicht senden.
    const typed = stickerFromText(draft);
    if (typed && !passHonors.emotes.some((em) => em.id === typed.id)) return;
    submittingRef.current = true;
    if (sticker) addComment(threadId, displayName, stickerText(sticker));
    if (draft.trim()) addComment(threadId, displayName, draft);
    setDraft("");
    setSticker(null);
    submittingRef.current = false;
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        💬 Kommentare{comments.length > 0 ? ` (${comments.length})` : ""}
      </p>
      {comments.length === 0 ? (
        <p className="mb-3 text-sm text-muted">Noch keine Kommentare – schreib den ersten!</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2.5">
          {comments.map((comment) => {
            const liked = comment.likedBy.includes(displayName);
            const isMine = comment.author === displayName;
            const own = comment.userId && comment.userId === authUserId ? shownPassHonors : null;
            const honors = own ?? (comment.userId ? honorsById[comment.userId] : undefined);
            return (
              <div key={comment.id} className="rounded-lg border border-edge bg-pitch px-3 py-2.5">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/spieler/${encodeURIComponent(comment.author)}`}
                      className="text-xs font-semibold text-gold [overflow-wrap:anywhere] hover:opacity-80"
                    >
                      {comment.author}
                    </Link>
                    {honors && <PassHonorTags honors={honors} size="sm" />}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">
                    {new Date(comment.createdAt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mb-1.5 text-sm text-ink [overflow-wrap:anywhere]">
                  <MessageBody text={comment.text} />
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleCommentLike(comment.id, displayName)}
                    disabled={isGuest}
                    className={`flex items-center gap-1 text-xs font-semibold transition-colors disabled:cursor-default disabled:hover:text-muted ${
                      liked ? "text-gold" : "text-muted hover:text-ink"
                    }`}
                  >
                    <ThumbUpIcon className="h-3.5 w-3.5" filled={liked} />
                    {comment.likedBy.length > 0 ? comment.likedBy.length : ""}
                  </button>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => removeComment(comment.id)}
                      className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-red-400"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isGuest ? (
        <Link
          href="/registrieren"
          className="block rounded-lg border border-edge bg-pitch px-3 py-2 text-center text-sm font-semibold text-gold transition-colors hover:border-gold"
        >
          Zum Kommentieren einloggen
        </Link>
      ) : (
        <form onSubmit={handleSubmit}>
          {sticker && (
            <div className="mb-2">
              <StickerDraft emote={sticker} onRemove={() => setSticker(null)} />
            </div>
          )}
          <div className="flex gap-2">
            {/* Nach unten aufklappen: im News-Fenster (scrollt) würde es nach
                oben bei kurzen Meldungen abgeschnitten. */}
            <EmotePicker
              placement="below"
              onInsertEmoji={(emoji) => setDraft((d) => d + emoji)}
              onPickSticker={(emote) => setSticker(emote)}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={sticker ? "Text dazu (optional)" : "Kommentar schreiben…"}
              className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-base text-ink outline-none focus:border-gold sm:text-sm"
            />
            <button
              type="submit"
              aria-label="Kommentar senden"
              className="rounded-lg bg-action px-3 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              ➤
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
