"use client";

import { useState, FormEvent } from "react";
import { useUser } from "@/lib/UserContext";

export default function FreundePage() {
  const { friends, addFriend, removeFriend } = useUser();
  const [name, setName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addFriend(name.trim());
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
          Hinzufügen
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {friends.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Freunde hinzugefügt.</p>
        )}
        {friends.map((friend, index) => (
          <div
            key={friend}
            className={`flex items-center justify-between px-4 py-3 ${
              index !== friends.length - 1 ? "border-b border-edge" : ""
            }`}
          >
            <span className="flex items-center gap-3 text-sm text-ink">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover font-display text-xs font-semibold text-muted">
                {friend.slice(0, 1).toUpperCase()}
              </span>
              {friend}
            </span>
            <button
              onClick={() => removeFriend(friend)}
              className="text-xs text-muted hover:text-ink"
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
