"use client";

import PlayerAvatar from "./PlayerAvatar";
import { useState, useEffect, useRef, useCallback, FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { supabase } from "@/lib/supabaseClient";
import { useChat, friendlyChatError, ChatSummary, DirectMessage } from "@/lib/ChatContext";
import { usePlayerRankIcons } from "@/lib/playerRankIcons";
import RankBadge from "@/components/RankBadge";
import FitText from "@/components/FitText";
import PassHonorTags, { useOtherPlayersHonors } from "@/components/PassHonors";
import { EmotePicker, MessageBody, StickerDraft, stickerFromText, stickerText } from "@/components/Emotes";
import { SeasonEmote } from "@/lib/seasons";

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------

const MAX_LENGTH = 1000;

// Jede Person bekommt eine eigene, gleichbleibende Farbe für ihren Kreis.
function Avatar(props: { id: string; name: string; size?: number }) {
  return <PlayerAvatar {...props} />;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

// Kurze Zeitangabe für die Chat-Übersicht: "14:05", "Gestern", "28.09."
function shortTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return clockTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Gestern";
  return date.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit" });
}

// Trenner zwischen den Tagen im Gespräch: "Heute", "Gestern", "Fr., 2. Okt."
function dayLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (sameDay(date, now)) return "Heute";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Gestern";
  return date.toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" });
}

function previewText(text: string) {
  return stickerFromText(text) ? "Sticker" : text;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
    >
      {children}
    </button>
  );
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
  </svg>
);

const BubbleIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.3 9.3 0 01-3.9-.8L3 20.5l1.5-4.3A7.9 7.9 0 013 11.5 8.6 8.6 0 0112 3a8.6 8.6 0 019 8.5z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Eingabezeile (privat und Community)
// ---------------------------------------------------------------------------

function Composer({
  disabled,
  placeholder,
  onSend,
  autoFocus,
}: {
  disabled: boolean;
  placeholder: string;
  onSend: (text: string) => void | Promise<void>;
  autoFocus?: boolean;
}) {
  const { passHonors } = useUser();
  const [draft, setDraft] = useState("");
  // Ausgewählter Sticker: erst Vorschau, gesendet wird er mit dem Senden-Knopf.
  const [sticker, setSticker] = useState<SeasonEmote | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Am Handy nicht automatisch die Tastatur aufklappen.
    if (autoFocus && window.matchMedia("(min-width: 640px)").matches) inputRef.current?.focus();
  }, [autoFocus]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if ((!text && !sticker) || disabled) return;
    // Sticker-Code von Hand eingetippt, ohne den Sticker zu besitzen: nicht senden.
    const typedSticker = stickerFromText(text);
    if (typedSticker && !passHonors.emotes.some((em) => em.id === typedSticker.id)) return;
    const pickedSticker = sticker;
    setDraft("");
    setSticker(null);
    // Sticker bleibt eine eigene Nachricht (":id:"), der Text kommt danach.
    if (pickedSticker) await onSend(stickerText(pickedSticker));
    if (text) await onSend(text);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-edge bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {sticker && (
        <div className="mb-2">
          <StickerDraft emote={sticker} onRemove={() => setSticker(null)} />
        </div>
      )}
      <div className="flex items-stretch gap-2">
        <EmotePicker
          disabled={disabled}
          onInsertEmoji={(emoji) => setDraft((d) => (d + emoji).slice(0, MAX_LENGTH))}
          onPickSticker={(emote: SeasonEmote) => setSticker(emote)}
        />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={sticker ? "Text dazu (optional)" : placeholder}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          className="min-w-0 flex-1 rounded-full border border-edge bg-pitch px-4 py-2 text-base text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-gold disabled:opacity-50 sm:text-sm"
        />
        <button
          type="submit"
          disabled={disabled || (!draft.trim() && !sticker)}
          aria-label="Nachricht senden"
          className="flex w-10 shrink-0 items-center justify-center rounded-full bg-action text-pitch transition-all enabled:hover:bg-action-hover disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Übersicht: Freunde
// ---------------------------------------------------------------------------

function FriendList() {
  const { isRegistered, friendEntries, friendsLoaded } = useUser();
  const { chats, chatsLoaded, chatsError, openChat, closeChat } = useChat();
  const incoming = friendEntries.filter((f) => f.relation === "incoming").length;

  if (!isRegistered) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-action/15 text-action">
          <BubbleIcon className="h-7 w-7" />
        </span>
        <p className="text-sm font-semibold text-ink">Schreib deinen Freunden</p>
        <p className="mt-1 text-xs text-muted">Mit einem Konto kannst du Freunde hinzufügen und privat mit ihnen chatten.</p>
        <Link
          href="/registrieren"
          onClick={closeChat}
          className="mt-4 rounded-full bg-action px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Anmelden oder registrieren
        </Link>
      </div>
    );
  }

  const loading = !chatsLoaded && !chatsError;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      {chatsError && <p className="m-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{chatsError}</p>}
      {incoming > 0 && (
        <Link
          href="/freunde"
          onClick={closeChat}
          className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-ink transition-colors hover:border-gold"
        >
          <span>
            {incoming === 1 ? "1 Freundschaftsanfrage wartet" : `${incoming} Freundschaftsanfragen warten`} auf dich
          </span>
          <span className="shrink-0 font-semibold text-gold">Ansehen ›</span>
        </Link>
      )}
      {loading && <p className="p-6 text-center text-xs text-muted">Lädt…</p>}
      {chatsLoaded && chats.length === 0 && (friendsLoaded || chatsError) && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Noch keine Freunde</p>
          <p className="mt-1 text-xs text-muted">Füg Freunde mit ihrer Nummer oder ihrem Namen hinzu, dann könnt ihr hier schreiben.</p>
        </div>
      )}
      <ul className="py-1">
        {chats.map((chat) => (
          <li key={chat.friendId}>
            <ChatRow chat={chat} onOpen={() => openChat(chat.friendId)} />
          </li>
        ))}
      </ul>
      <div className="px-3 pb-4 pt-1">
        <Link
          href="/freunde"
          onClick={closeChat}
          className="flex items-center justify-center gap-2 rounded-full border border-dashed border-edge px-4 py-2.5 text-xs font-semibold text-muted transition-colors hover:border-gold/60 hover:text-ink"
        >
          <span className="text-base leading-none">+</span> Freunde finden
        </Link>
      </div>
    </div>
  );
}

function ChatRow({ chat, onOpen }: { chat: ChatSummary; onOpen: () => void }) {
  const unread = chat.unread > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover"
    >
      <Avatar id={chat.friendId} name={chat.name} size={44} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1">
            <FitText text={chat.name} className={`text-sm ${unread ? "font-bold text-ink" : "font-semibold text-ink"}`} />
          </span>
          {chat.lastAt && (
            <span className={`shrink-0 text-[11px] ${unread ? "font-semibold text-action" : "text-muted"}`}>
              {shortTime(chat.lastAt)}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-xs ${unread ? "text-ink" : "text-muted"}`}>
            {chat.lastText ? (
              <>
                {chat.lastFromMe && <span className="text-muted">Du: </span>}
                {previewText(chat.lastText)}
              </>
            ) : (
              <span className="italic">Sag Hallo 👋</span>
            )}
          </span>
          {unread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-bold text-pitch">
              {chat.unread > 99 ? "99+" : chat.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Privates Gespräch
// ---------------------------------------------------------------------------

type ShownMessage = DirectMessage & { pending?: boolean };

function Conversation({ friendId }: { friendId: string }) {
  const { authUserId, friendEntries, refreshFriends } = useUser();
  const { chats, setView, closeChat, onMessage, refreshChats } = useChat();
  const friendEntry = friendEntries.find((f) => f.id === friendId);
  const chat = chats.find((c) => c.friendId === friendId);
  const name = friendEntry?.name ?? chat?.name ?? "Freund";
  const number = friendEntry?.number ?? chat?.number;
  const stillFriends = friendEntry?.relation === "friend";

  const [messages, setMessages] = useState<ShownMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const markRead = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const { data } = await supabase.rpc("mark_chat_read", { p_other: friendId });
    if (typeof data === "number" && data > 0) refreshChats();
  }, [friendId, refreshChats]);

  const load = useCallback(async () => {
    if (!authUserId) return;
    const { data, error: loadError } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${authUserId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${authUserId})`
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (loadError) {
      setError(friendlyChatError(loadError));
    } else {
      const fresh = ((data ?? []) as DirectMessage[]).reverse();
      // Noch nicht bestätigte eigene Nachrichten behalten.
      setMessages((current) => [...fresh, ...current.filter((m) => m.pending)]);
      setError(null);
    }
    setLoaded(true);
  }, [authUserId, friendId]);

  useEffect(() => {
    setMessages([]);
    setLoaded(false);
    stickToBottomRef.current = true;
    load().then(markRead);
    // Sicherheitsnetz, falls Realtime einmal hakt.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load().then(markRead);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, markRead]);

  // Live-Nachrichten dieses Gesprächs.
  useEffect(
    () =>
      onMessage((event, row) => {
        const inThisChat =
          (row.sender_id === friendId && row.recipient_id === authUserId) ||
          (row.sender_id === authUserId && row.recipient_id === friendId);
        if (!inThisChat) return;
        setMessages((current) => {
          if (event === "UPDATE") return current.map((m) => (m.id === row.id ? { ...m, ...row } : m));
          return current.some((m) => m.id === row.id) ? current : [...current, row];
        });
        if (event === "INSERT" && row.sender_id === friendId) markRead();
      }),
    [onMessage, friendId, authUserId, markRead]
  );

  // Neue Nachrichten unten zeigen, außer man liest gerade weiter oben.
  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleScroll() {
    const el = listRef.current;
    if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(text: string) {
    if (!authUserId) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    stickToBottomRef.current = true;
    setError(null);
    setMessages((current) => [
      ...current,
      {
        id: tempId,
        sender_id: authUserId,
        recipient_id: friendId,
        text,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      },
    ]);
    const { data, error: sendError } = await supabase.rpc("send_direct_message", { p_to: friendId, p_text: text });
    const saved = Array.isArray(data) ? (data[0] as DirectMessage | undefined) : undefined;
    if (sendError || !saved) {
      setMessages((current) => current.filter((m) => m.id !== tempId));
      setError(friendlyChatError(sendError));
      return;
    }
    // Realtime kann die Nachricht schon vorher gebracht haben -> nur einmal zeigen.
    setMessages((current) =>
      current.some((m) => m.id === saved.id)
        ? current.filter((m) => m.id !== tempId)
        : current.map((m) => (m.id === tempId ? saved : m))
    );
    refreshChats();
  }

  async function block() {
    setMenuOpen(false);
    if (!confirm(`${name} blockieren? Ihr seid dann keine Freunde mehr, und ${name} kann dir nicht mehr schreiben.`)) return;
    const { error: blockError } = await supabase.rpc("block_user", { p_other: friendId });
    if (blockError) {
      setError(friendlyChatError(blockError));
      return;
    }
    await refreshFriends();
    refreshChats();
    setView({ kind: "list", tab: "friends" });
  }

  const lastOwn = [...messages].reverse().find((m) => m.sender_id === authUserId);

  return (
    <>
      <header className="flex items-center gap-1 border-b border-edge bg-surface-hover py-2 pl-1.5 pr-2">
        <IconButton label="Zurück zur Übersicht" onClick={() => setView({ kind: "list", tab: "friends" })}>
          <BackIcon />
        </IconButton>
        <Link
          href={`/spieler/${encodeURIComponent(name)}`}
          onClick={closeChat}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5 pr-1 hover:[&_.name]:text-gold"
        >
          <Avatar id={friendId} name={name} size={36} />
          <span className="min-w-0 flex-1">
            <FitText text={name} className="name text-sm font-semibold text-ink transition-colors" />
            {number !== undefined && <span className="block text-[11px] leading-tight text-muted">#{number}</span>}
          </span>
        </Link>
        <div className="relative">
          <IconButton label="Mehr" onClick={() => setMenuOpen((v) => !v)}>
            <span className="text-lg leading-none">⋯</span>
          </IconButton>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-edge bg-surface py-1 text-sm shadow-2xl">
              <Link
                href={`/spieler/${encodeURIComponent(name)}`}
                onClick={closeChat}
                className="block px-4 py-2 text-ink hover:bg-surface-hover"
              >
                Profil ansehen
              </Link>
              {stillFriends && (
                <button type="button" onClick={block} className="block w-full px-4 py-2 text-left text-red-300 hover:bg-surface-hover">
                  Blockieren
                </button>
              )}
            </div>
          )}
        </div>
        <IconButton label="Chat schließen" onClick={closeChat}>
          <CloseIcon />
        </IconButton>
      </header>

      <div
        ref={listRef}
        onScroll={handleScroll}
        onClick={() => setMenuOpen(false)}
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {!loaded && <p className="py-6 text-center text-xs text-muted">Lädt…</p>}
        {loaded && messages.length === 0 && !error && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Avatar id={friendId} name={name} size={64} />
            <p className="mt-3 text-sm font-semibold text-ink">Schreib {name} die erste Nachricht</p>
            <p className="mt-1 text-xs text-muted">Nur ihr zwei könnt diesen Chat lesen.</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const mine = msg.sender_id === authUserId;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || !sameDay(new Date(prev.created_at), new Date(msg.created_at));
          const groupedWithNext =
            next && next.sender_id === msg.sender_id && sameDay(new Date(next.created_at), new Date(msg.created_at));
          const isSticker = !!stickerFromText(msg.text);
          return (
            <div key={msg.id}>
              {newDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-surface-hover px-3 py-1 text-[11px] font-semibold text-muted">
                    {dayLabel(msg.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} ${groupedWithNext ? "mb-0.5" : "mb-2"}`}>
                <div
                  className={`max-w-[80%] text-sm [overflow-wrap:anywhere] ${
                    isSticker
                      ? ""
                      : mine
                      ? `rounded-2xl bg-action px-3 py-1.5 text-pitch ${groupedWithNext ? "" : "rounded-br-md"}`
                      : `rounded-2xl bg-surface-hover px-3 py-1.5 text-ink ${groupedWithNext ? "" : "rounded-bl-md"}`
                  } ${msg.pending ? "opacity-60" : ""}`}
                >
                  <span className="whitespace-pre-wrap">
                    <MessageBody text={msg.text} />
                  </span>
                  <span
                    className={`ml-2 inline-block translate-y-0.5 whitespace-nowrap text-[10px] ${
                      isSticker ? "block text-right text-muted" : mine ? "float-right mt-1.5 text-pitch/70" : "float-right mt-1.5 text-muted"
                    }`}
                  >
                    {clockTime(msg.created_at)}
                    {mine && <span className={msg.read_at ? "ml-1 font-bold" : "ml-1"}>{msg.pending ? "·" : msg.read_at ? "✓✓" : "✓"}</span>}
                  </span>
                </div>
              </div>
              {mine && msg.id === lastOwn?.id && msg.read_at && (
                <p className="-mt-1 mb-2 text-right text-[10px] text-muted">Gelesen {sameDay(new Date(msg.read_at), new Date()) ? clockTime(msg.read_at) : `${shortTime(msg.read_at)}, ${clockTime(msg.read_at)}`}</p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="border-t border-edge bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</p>}
      {!stillFriends && loaded && (
        <p className="border-t border-edge px-4 py-2 text-center text-xs text-muted">
          Ihr seid nicht mehr befreundet. Schreiben geht nur unter Freunden.
        </p>
      )}
      <Composer
        key={friendId}
        autoFocus
        disabled={!stillFriends}
        placeholder="Nachricht schreiben…"
        onSend={send}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Community-Chat (ein Raum für alle)
// ---------------------------------------------------------------------------

interface CommunityMessage {
  id: string;
  author: string;
  text: string;
  isMe: boolean;
  userId: string | null;
  createdAt: string | null;
}

function CommunityRoom() {
  const { displayName, authUserId } = useUser();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    type Row = { id: string; author_name: string; text: string; user_id: string | null; created_at?: string | null };
    const toMessage = (row: Row): CommunityMessage => ({
      id: row.id,
      author: row.author_name,
      text: row.text,
      isMe: !!authUserId && row.user_id === authUserId,
      userId: row.user_id ?? null,
      createdAt: row.created_at ?? null,
    });
    (async () => {
      // Die neuesten 100, alte Beispiel-Nachrichten ohne echten Absender nicht.
      const { data, error: loadError } = await supabase
        .from("chat_messages")
        .select("*")
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (loadError) {
        console.warn("Chat konnte nicht geladen werden:", loadError.message);
        return;
      }
      setMessages(((data ?? []) as Row[]).reverse().map(toMessage));
    })();

    const channel = supabase
      .channel("chat_messages_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const row = payload.new as Row;
        if (!row.user_id) return;
        setMessages((current) => (current.some((m) => m.id === row.id) ? current : [...current, toMessage(row)]));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  const rankIcons = usePlayerRankIcons();
  const honorsByUser = useOtherPlayersHonors(messages.filter((m) => !m.isMe).map((m) => m.userId));

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  async function send(text: string) {
    if (!authUserId) return;
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setError(null);
    await supabase
      .from("chat_messages")
      .insert({ id, user_id: authUserId, author_name: displayName, text })
      .then(({ error: sendError }) => {
        if (sendError) {
          console.warn("Nachricht konnte nicht gesendet werden:", sendError.message);
          setError("Nachricht konnte nicht gesendet werden. Versuch es nochmal.");
          return;
        }
        // Nach dem Speichern selbst anhängen, statt nur auf Realtime zu warten.
        setMessages((current) =>
          current.some((m) => m.id === id)
            ? current
            : [
                ...current,
                { id, author: displayName, text, isMe: true, userId: authUserId, createdAt: new Date().toISOString() },
              ]
        );
      });
  }

  return (
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-muted">Noch keine Nachrichten. Schreib die erste!</p>
        )}
        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isSticker = !!stickerFromText(msg.text);
            const honors = msg.userId ? honorsByUser[msg.userId] : undefined;
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.isMe ? "justify-end" : "justify-start"}`}>
                {!msg.isMe && msg.userId && <Avatar id={msg.userId} name={msg.author} size={28} />}
                <div
                  className={`max-w-[78%] text-sm [overflow-wrap:anywhere] ${
                    isSticker
                      ? ""
                      : msg.isMe
                      ? "rounded-2xl rounded-br-md bg-action px-3 py-1.5 text-pitch"
                      : "rounded-2xl rounded-bl-md bg-surface-hover px-3 py-1.5 text-ink"
                  }`}
                >
                  {!msg.isMe && (
                    <div className="mb-0.5">
                      <Link
                        href={`/spieler/${encodeURIComponent(msg.author)}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gold hover:opacity-80"
                      >
                        <RankBadge option={rankIcons.byId(msg.userId)} size="xs" />
                        {msg.author}
                      </Link>
                      {honors && (honors.title || honors.badges.length > 0) && (
                        <div className="mt-1">
                          <PassHonorTags honors={honors} size="sm" />
                        </div>
                      )}
                    </div>
                  )}
                  <span className="whitespace-pre-wrap">
                    <MessageBody text={msg.text} />
                  </span>
                  {msg.createdAt && (
                    <span
                      className={`ml-2 inline-block translate-y-0.5 whitespace-nowrap text-[10px] ${
                        isSticker ? "block text-right text-muted" : msg.isMe ? "float-right mt-1.5 text-pitch/70" : "float-right mt-1.5 text-muted"
                      }`}
                    >
                      {clockTime(msg.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {error && <p className="border-t border-edge bg-red-500/10 px-4 py-2 text-xs text-red-300">{error}</p>}
      <Composer
        disabled={!authUserId}
        placeholder={authUserId ? "An alle schreiben…" : "Melde dich an, um zu schreiben"}
        onSend={send}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Das Chatfenster
// ---------------------------------------------------------------------------

export default function ChatWidget() {
  const { isRegistered } = useUser();
  const { open, view, setView, closeChat, toggleChat, unreadTotal, toast, dismissToast, openChat } = useChat();

  // Am Handy füllt das Chatfenster den Bildschirm: die Seite dahinter soll
  // dann nicht mitscrollen.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape schließt das Fenster (Desktop).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeChat]);

  const tab = view.kind === "list" ? view.tab : "friends";

  return (
    <>
      {open && (
        <section
          aria-label="Chat"
          className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-surface sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[min(36rem,calc(100dvh-8rem))] sm:w-[23rem] sm:rounded-card sm:border sm:border-edge sm:shadow-[0_24px_60px_rgb(0_0_0/0.55)]"
        >
          {view.kind === "dm" ? (
            <Conversation key={view.friendId} friendId={view.friendId} />
          ) : (
            <>
              <header className="border-b border-edge bg-surface-hover px-4 pb-3 pt-3">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                    <BubbleIcon className="h-5 w-5 text-action" />
                    Chat
                  </h2>
                  <span className="-mr-2">
                    <IconButton label="Chat schließen" onClick={closeChat}>
                      <CloseIcon />
                    </IconButton>
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-full bg-pitch p-1">
                  {(
                    [
                      ["friends", "Freunde"],
                      ["community", "Community"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView({ kind: "list", tab: key })}
                      className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors ${
                        tab === key ? "bg-surface-hover text-ink shadow" : "text-muted hover:text-ink"
                      }`}
                    >
                      {label}
                      {key === "friends" && unreadTotal > 0 && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-pitch">
                          {unreadTotal > 99 ? "99+" : unreadTotal}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </header>
              {tab === "friends" ? <FriendList /> : <CommunityRoom />}
            </>
          )}
        </section>
      )}

      {/* Hinweis bei neuer Nachricht, solange das Gespräch nicht offen ist. */}
      {toast && !(open && view.kind === "dm" && view.friendId === toast.friendId) && (
        <div className="fixed bottom-[4.25rem] right-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] animate-[chatToastIn_0.25s_ease-out] sm:bottom-24 sm:right-5">
          <div className="flex items-center gap-3 rounded-card border border-action/40 bg-surface p-3 shadow-2xl">
            <button type="button" onClick={() => openChat(toast.friendId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar id={toast.friendId} name={toast.name} size={36} />
              <span className="min-w-0 flex-1">
                <FitText text={toast.name} className="text-xs font-semibold text-action" />
                <span className="block truncate text-sm text-ink">{previewText(toast.text)}</span>
              </span>
            </button>
            <button type="button" onClick={dismissToast} aria-label="Hinweis schließen" className="shrink-0 text-muted hover:text-ink">
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={toggleChat}
        className={`fixed bottom-3 right-3 z-40 h-12 w-12 items-center justify-center rounded-full bg-action text-pitch shadow-[0_0_20px_rgb(var(--c-action)/0.4)] transition-transform hover:scale-105 sm:bottom-5 sm:right-5 sm:flex sm:h-14 sm:w-14 ${
          open ? "hidden" : "flex"
        }`}
        aria-label={open ? "Chat schließen" : unreadTotal > 0 ? `Chat öffnen, ${unreadTotal} ungelesen` : "Chat öffnen"}
      >
        {open ? <CloseIcon /> : <BubbleIcon className="h-6 w-6 sm:h-7 sm:w-7" />}
        {!open && isRegistered && unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-pitch bg-red-500 px-1 text-[11px] font-bold text-white">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>
    </>
  );
}
