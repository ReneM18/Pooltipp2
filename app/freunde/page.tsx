"use client";

import { useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { getMockRankIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";
import { TrashIcon } from "@/components/Icons";

export default function FreundePage() {
  const { friends, removeFriend, pendingRequests, sendFriendRequest } = useUser();
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  // Ref statt State: greift synchron sofort, bevor React neu rendert – ein
  // State-Flag allein würde einen sehr schnellen Doppel-Klick nicht
  // zuverlässig verhindern (siehe gleiches Muster in MatchCard.tsx).
  const submittingRef = useRef(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || submittingRef.current) return;
    submittingRef.current = true;
    const ok = sendFriendRequest(name.trim());
    setError(!ok);
    if (ok) setName("");
    submittingRef.current = false;
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Freunde</h1>

      <form onSubmit={handleSubmit} className="mb-2 flex gap-3">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(false);
          }}
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
      {error && (
        <p className="mb-4 text-xs text-red-400">
          Das geht nicht – Name muss zwischen 2 und 30 Zeichen lang sein und darf nicht dein
          eigener Name oder schon in deiner Liste sein.
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-card border border-edge bg-surface">
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
              onClick={() => {
                if (confirm(`${friend} wirklich aus deiner Freundesliste entfernen?`)) {
                  removeFriend(friend);
                }
              }}
              className="flex items-center gap-1 px-1 py-1 text-xs text-muted transition-colors hover:text-red-400"
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
