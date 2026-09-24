"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { getMockRankIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";

interface ChatMessage {
  id: string;
  author: string;
  text: string;
  isMe: boolean;
}

const initialMessages: ChatMessage[] = [
  { id: "m1", author: "Marco T.", text: "Wer tippt heute auf Bayern?", isMe: false },
  { id: "m2", author: "Sabine K.", text: "Ich setz alles auf ein 2:1 😄", isMe: false },
];

export default function ChatWidget() {
  const { displayName } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");

  function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages((current) => [
      ...current,
      { id: `me-${Date.now()}`, author: displayName, text: draft.trim(), isMe: true },
    ]);
    setDraft("");
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

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <p className="mb-3 text-center text-xs text-muted">
              Live-Chat mit anderen Usern kommt mit der Backend-Anbindung. Bis dahin: eine
              Vorschau der Oberfläche.
            </p>
            <div className="flex flex-col gap-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.isMe
                      ? "ml-auto bg-action text-pitch"
                      : "bg-surface-hover text-ink"
                  }`}
                >
                  {!msg.isMe && (
                    <Link
                      href={`/spieler/${encodeURIComponent(msg.author)}`}
                      className="mb-1 flex items-center gap-2 text-xs font-semibold text-gold hover:opacity-80"
                    >
                      <RankBadge option={getMockRankIconForName(msg.author)} size="sm" />
                      {msg.author}
                    </Link>
                  )}
                  {msg.text}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-edge p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nachricht schreiben…"
              className="flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
            <button
              type="submit"
              className="rounded-lg bg-action px-3 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
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
