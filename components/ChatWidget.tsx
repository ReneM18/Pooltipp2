"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { getMockRankIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";
import PassHonorTags, { useOtherPlayersHonors } from "@/components/PassHonors";
import { EmotePicker, MessageBody, stickerFromText, stickerText } from "@/components/Emotes";
import { SeasonEmote } from "@/lib/seasons";

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  isMe: boolean;
  userId: string | null;
}

export default function ChatWidget() {
  const { displayName, authUserId, passHonors } = useUser();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Lädt die letzten Nachrichten einmalig und hält sie danach per Supabase
  // Realtime live aktuell – so kommen auch Nachrichten von ANDEREN Usern an,
  // ohne dass die Seite neu geladen werden muss.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(100);
      if (cancelled) return;
      if (error) {
        console.warn("Chat konnte nicht geladen werden:", error.message);
        return;
      }
      if (data) {
        setMessages(
          data.map((row) => ({
            id: row.id,
            author: row.author_name,
            text: row.text,
            isMe: row.user_id === authUserId,
            userId: row.user_id ?? null,
          }))
        );
      }
    })();

    const channel = supabase
      .channel("chat_messages_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const row = payload.new as { id: string; author_name: string; text: string; user_id: string | null };
        setMessages((current) =>
          current.some((m) => m.id === row.id)
            ? current
            : [
                ...current,
                {
                  id: row.id,
                  author: row.author_name,
                  text: row.text,
                  isMe: row.user_id === authUserId,
                  userId: row.user_id,
                },
              ]
        );
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // Titel/Abzeichen (Saison-Pass) der anderen Schreiber, nach Nutzer-ID.
  const honorsByUser = useOtherPlayersHonors(messages.filter((m) => !m.isMe).map((m) => m.userId));

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [open, messages.length]);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !authUserId) return;
    // Sticker-Code von Hand eingetippt, ohne den Sticker zu besitzen: nicht senden.
    const typedSticker = stickerFromText(text);
    if (typedSticker && !passHonors.emotes.some((em) => em.id === typedSticker.id)) return;
    setDraft("");
    sendText(text);
  }

  function handleSendSticker(emote: SeasonEmote) {
    if (!authUserId) return;
    sendText(stickerText(emote));
  }

  function sendText(text: string) {
    if (!authUserId) return;
    const id = `chat-${Date.now()}`;
    supabase
      .from("chat_messages")
      .insert({ id, user_id: authUserId, author_name: displayName, text })
      .then(({ error }) => {
        if (error) {
          console.warn("Nachricht konnte nicht gesendet werden:", error.message);
          if (!stickerFromText(text)) setDraft(text);
          return;
        }
        // Nach dem Speichern selbst anhängen, statt nur auf das Realtime-Abo
        // zu warten (sonst sieht man die eigene Nachricht nicht, falls
        // Realtime hakt). Der ID-Abgleich verhindert doppelte Zeilen.
        setMessages((current) =>
          current.some((m) => m.id === id)
            ? current
            : [...current, { id, author: displayName, text, isMe: true, userId: authUserId }]
        );
      });
  }

  return (
    <div className="fixed inset-x-4 bottom-5 z-20 flex flex-col items-end sm:inset-x-auto sm:right-5">
      {open && (
        <div className="mb-3 flex h-96 w-full max-w-80 flex-col overflow-hidden rounded-card border border-edge bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-edge bg-surface-hover px-4 py-3">
            <span className="font-display text-sm font-semibold text-ink">Community-Chat</span>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">
              ✕
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="mb-3 text-center text-xs text-muted">Noch keine Nachrichten – schreib die erste!</p>
            )}
            <div className="flex flex-col gap-2">
              {messages.map((msg) => {
                const isSticker = !!stickerFromText(msg.text);
                const honors = msg.userId ? honorsByUser[msg.userId] : undefined;
                return (
                  <div
                    key={msg.id}
                    className={`max-w-[80%] rounded-lg text-sm [overflow-wrap:anywhere] ${
                      isSticker && msg.isMe
                        ? "ml-auto"
                        : msg.isMe
                        ? "ml-auto bg-action px-3 py-2 text-pitch"
                        : "bg-surface-hover px-3 py-2 text-ink"
                    }`}
                  >
                    {!msg.isMe && (
                      <div className="mb-1">
                        <Link
                          href={`/spieler/${encodeURIComponent(msg.author)}`}
                          className="flex items-center gap-2 text-xs font-semibold text-gold hover:opacity-80"
                        >
                          <RankBadge option={getMockRankIconForName(msg.author)} size="sm" />
                          {msg.author}
                        </Link>
                        {honors && (honors.title || honors.badges.length > 0) && (
                          <div className="mt-1">
                            <PassHonorTags honors={honors} size="sm" />
                          </div>
                        )}
                      </div>
                    )}
                    <MessageBody text={msg.text} />
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-edge p-3">
            <EmotePicker
              disabled={!authUserId}
              onInsertEmoji={(emoji) => setDraft((d) => d + emoji)}
              onSendSticker={handleSendSticker}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={authUserId ? "Nachricht schreiben…" : "Melde dich an, um zu schreiben"}
              disabled={!authUserId}
              className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!authUserId}
              aria-label="Nachricht senden"
              className="rounded-lg bg-action px-3 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-50"
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-action text-2xl shadow-[0_0_20px_rgba(63,166,107,0.4)] transition-transform hover:scale-105"
        aria-label="Chat öffnen"
      >
        💬
      </button>
    </div>
  );
}
