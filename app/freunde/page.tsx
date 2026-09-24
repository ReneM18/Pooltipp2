"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { getMockRankIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";
import { TrashIcon } from "@/components/Icons";

export default function FreundePage() {
  const { friends, removeFriend, pendingRequests, sendFriendRequest } = useUser();
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    sendFriendRequest(name.trim());
    setName("");
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Freunde</h1>
        <p className="mt-1 text-sm text-muted">
          Füge Freunde hinzu, um sie in der Rangliste im Blick zu behalten.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name eingeben…"
          className="flex-1 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
        />
        <button
          type="submit"
          className="rounded-full bg-action px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Anfrage senden
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {friends.length === 0 && pendingRequests.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Freunde hinzugefügt.</p>
        )}
        {friends.map((friend, index) => (
          <div
            key={friend}
            className={`flex items-center justify-between px-4 py-3 ${
              index !== friends.length - 1 || pendingRequests.length > 0 ? "border-b border-edge" : ""
            }`}
          >
            <Link href={`/spieler/${encodeURIComponent(friend)}`} className="flex items-center gap-3 text-sm text-ink">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-xs font-semibold text-muted">
                {friend.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex items-center gap-2 hover:text-gold">
                {friend}
                <RankBadge option={getMockRankIconForName(friend)} size="sm" />
              </span>
            </Link>
            <button
              onClick={() => removeFriend(friend)}
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Entfernen
            </button>
          </div>
        ))}
        {pendingRequests.map((name, index) => (
          <div
            key={name}
            className={`flex items-center justify-between px-4 py-3 ${
              index !== pendingRequests.length - 1 ? "border-b border-edge" : ""
            }`}
          >
            <Link href={`/spieler/${encodeURIComponent(name)}`} className="flex items-center gap-3 text-sm text-muted">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-xs font-semibold text-muted">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hover:text-gold">{name}</span>
            </Link>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
              Anfrage ausstehend…
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
