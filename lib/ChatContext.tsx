"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/UserContext";

// Private Nachrichten unter Freunden (supabase/chat.sql). Der Chat hält hier
// zentral fest, ob das Chatfenster offen ist und mit wem man gerade schreibt –
// so kann jede Seite (z. B. die Freundesliste) per openChat(id) direkt ein
// Gespräch aufmachen.

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: string;
  read_at: string | null;
}

export interface ChatSummary {
  friendId: string;
  name: string;
  number: number;
  lastText: string | null;
  lastAt: string | null;
  lastFromMe: boolean;
  unread: number;
}

export type ChatView = { kind: "list"; tab: "friends" | "community" } | { kind: "dm"; friendId: string };

export interface ChatToast {
  key: number;
  friendId: string;
  name: string;
  text: string;
}

type MessageListener = (event: "INSERT" | "UPDATE", row: DirectMessage) => void;

interface ChatContextValue {
  open: boolean;
  view: ChatView;
  setView: (view: ChatView) => void;
  openChat: (friendId?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  chats: ChatSummary[];
  chatsLoaded: boolean;
  chatsError: string | null;
  unreadTotal: number;
  refreshChats: () => void;
  toast: ChatToast | null;
  dismissToast: () => void;
  /** Hört auf neue/geänderte private Nachrichten (für das offene Gespräch). */
  onMessage: (listener: MessageListener) => () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// Datenbank-Fehler in einfache Sätze übersetzen.
export function friendlyChatError(error: { code?: string; message?: string } | null | undefined): string {
  const msg = error?.message ?? "";
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42P01" || /does not exist|schema cache/i.test(msg)) {
    return "Der Chat ist noch nicht eingerichtet (chat.sql fehlt in Supabase).";
  }
  // Eigene Meldungen aus chat.sql sind schon auf Deutsch.
  if (/^(Du |Die Nachricht|Bitte zuerst|Mit diesem)/.test(msg)) return msg;
  return "Das hat gerade nicht geklappt. Prüf deine Verbindung und versuch es nochmal.";
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { authUserId, isRegistered, friendEntries } = useUser();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ChatView>({ kind: "list", tab: "friends" });
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [toast, setToast] = useState<ChatToast | null>(null);

  const listenersRef = useRef(new Set<MessageListener>());
  const requestRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Aktueller Stand für das Realtime-Abo (das nur einmal pro Login entsteht).
  const stateRef = useRef({ open, view, chats, friendEntries });
  stateRef.current = { open, view, chats, friendEntries };

  const loadChats = useCallback(async () => {
    if (!authUserId || !isRegistered) return;
    const requestId = ++requestRef.current;
    const { data, error } = await supabase.rpc("my_chats");
    if (requestId !== requestRef.current) return;
    if (error) {
      setChatsError(friendlyChatError(error));
    } else {
      setChatsError(null);
      setChats(
        (
          (data ?? []) as {
            other_id: string;
            display_name: string;
            user_number: number;
            last_text: string | null;
            last_at: string | null;
            last_from_me: boolean | null;
            unread: number;
          }[]
        ).map((r) => ({
          friendId: r.other_id,
          name: r.display_name,
          number: r.user_number,
          lastText: r.last_text,
          lastAt: r.last_at,
          lastFromMe: !!r.last_from_me,
          unread: r.unread ?? 0,
        }))
      );
    }
    setChatsLoaded(true);
  }, [authUserId, isRegistered]);

  // Mehrere Ereignisse kurz hintereinander -> nur einmal nachladen.
  const refreshChats = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadChats();
    }, 250);
  }, [loadChats]);

  // Beim Login/Logout neu aufsetzen; die Freundesliste ändert die Übersicht.
  const friendKey = friendEntries
    .filter((f) => f.relation === "friend")
    .map((f) => `${f.id}:${f.name}`)
    .join(",");
  useEffect(() => {
    if (!authUserId || !isRegistered) {
      requestRef.current++;
      setChats([]);
      setChatsLoaded(false);
      setChatsError(null);
      setToast(null);
      return;
    }
    loadChats();
  }, [authUserId, isRegistered, friendKey, loadChats]);

  // Live: neue Nachrichten und "gelesen"-Häkchen. Supabase schickt nur
  // Nachrichten, die man laut RLS sehen darf (eigene Gespräche).
  useEffect(() => {
    if (!authUserId || !isRegistered) return;
    const channel = supabase
      .channel(`direct-messages-${authUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        const row = payload.new as DirectMessage;
        if (!row?.id || (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE")) return;
        if (row.sender_id !== authUserId && row.recipient_id !== authUserId) return;
        listenersRef.current.forEach((listener) => listener(payload.eventType as "INSERT" | "UPDATE", row));
        if (payload.eventType === "INSERT" && row.recipient_id === authUserId) {
          const { open: isOpen, view: currentView, chats: currentChats, friendEntries: currentFriends } = stateRef.current;
          const looking =
            isOpen && currentView.kind === "dm" && currentView.friendId === row.sender_id && document.visibilityState === "visible";
          if (!looking) {
            const name =
              currentChats.find((c) => c.friendId === row.sender_id)?.name ??
              currentFriends.find((f) => f.id === row.sender_id)?.name ??
              "Neue Nachricht";
            setToast({ key: Date.now(), friendId: row.sender_id, name, text: row.text });
          }
        }
        refreshChats();
      })
      .subscribe();
    // Falls Realtime einmal hakt: die Übersicht trotzdem regelmäßig auffrischen.
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") loadChats();
    }, 60000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [authUserId, isRegistered, refreshChats, loadChats]);

  // Hinweis-Blase verschwindet nach ein paar Sekunden von selbst.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const openChat = useCallback((friendId?: string) => {
    setView(friendId ? { kind: "dm", friendId } : { kind: "list", tab: "friends" });
    setOpen(true);
    setToast(null);
  }, []);

  const closeChat = useCallback(() => setOpen(false), []);
  const toggleChat = useCallback(() => {
    setOpen((current) => !current);
    setToast(null);
  }, []);

  const onMessage = useCallback((listener: MessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const unreadTotal = useMemo(() => chats.reduce((sum, c) => sum + c.unread, 0), [chats]);

  const value: ChatContextValue = {
    open,
    view,
    setView,
    openChat,
    closeChat,
    toggleChat,
    chats,
    chatsLoaded,
    chatsError,
    unreadTotal,
    refreshChats,
    toast,
    dismissToast: () => setToast(null),
    onMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat muss innerhalb von ChatProvider verwendet werden");
  return ctx;
}
