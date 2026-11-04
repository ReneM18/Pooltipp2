"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Admin → Community → "Spielernamen": Namen eines Spielers ändern, wenn er beim
// Support anfragt (Rene, 04.11.2026). Kostet keine Coins und zählt nicht als
// seine Gratis-Änderung im Quartal. Datenbank: supabase/name-aendern.sql.
interface Player {
  id: string;
  display_name: string;
  user_number: number | null;
}

export function AdminNames() {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e?: FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setMsg(null);
    const esc = q.replace(/[\\%_*]/g, (c) => `\\${c}`);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, user_number")
      .ilike("display_name", `%${esc}%`)
      .order("display_name")
      .limit(20);
    if (error) {
      setMsg("Suche hat nicht geklappt.");
      setPlayers([]);
      return;
    }
    setPlayers((data ?? []) as Player[]);
  }

  async function grantPhoto(p: Player) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_grant_photo_change", { p_user: p.id });
    setBusy(false);
    setMsg(
      error
        ? error.code === "PGRST202"
          ? "Fehlt noch das SQL „profilbild-aendern.sql“."
          : `Nicht freigegeben: ${error.message}`
        : `✓ ${p.display_name} darf sein Profilbild jetzt einmal gratis ändern.`
    );
  }

  async function save(p: Player) {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_display_name", { p_user: p.id, p_name: name });
    setBusy(false);
    if (error) {
      setMsg(
        error.code === "PGRST202"
          ? "Fehlt noch das SQL „name-aendern.sql“."
          : `Nicht gespeichert: ${error.message}`
      );
      return;
    }
    setMsg(`✓ ${p.display_name} heißt jetzt ${name}.`);
    setPlayers((list) => list?.map((x) => (x.id === p.id ? { ...x, display_name: name } : x)) ?? null);
    setEditing(null);
  }

  return (
    <section className="rounded-card border border-edge bg-surface p-4">
      <h2 className="font-display text-lg font-semibold text-ink">Name und Profilbild</h2>
      <p className="mt-1 text-xs text-muted">
        Für Anfragen beim Support. Spieler dürfen Name und Profilbild 1× pro Quartal gratis ändern, früher nur gegen Coins. Hier
        änderst du den Namen jederzeit oder gibst eine Profilbild-Änderung frei, ohne Coins.
      </p>
      <form onSubmit={search} className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name suchen"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <button type="submit" className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-pitch">
          Suchen
        </button>
      </form>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      {players && players.length === 0 && <p className="mt-3 text-sm text-muted">Niemand gefunden.</p>}
      {players && players.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="rounded-card border border-edge bg-pitch px-3 py-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 truncate text-sm font-semibold text-ink">
                  {p.display_name}
                  {p.user_number != null && <span className="ml-1.5 text-xs font-normal text-muted">#{p.user_number}</span>}
                </p>
                {editing !== p.id && (
                  <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => grantPhoto(p)}
                    className="min-h-[36px] shrink-0 rounded-full border border-edge px-3 text-xs text-muted hover:text-ink"
                  >
                    🖼️ Bild freigeben
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p.id);
                      setNewName(p.display_name);
                    }}
                    className="min-h-[36px] shrink-0 rounded-full border border-edge px-3 text-xs text-muted hover:text-ink"
                  >
                    ✏️ Name ändern
                  </button>
                  </span>
                )}
              </div>
              {editing === p.id && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newName}
                    maxLength={40}
                    onChange={(e) => setNewName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy || !newName.trim() || newName.trim() === p.display_name}
                      onClick={() => save(p)}
                      className="min-h-[40px] rounded-full bg-gold px-4 text-sm font-semibold text-pitch disabled:opacity-50"
                    >
                      Speichern
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="min-h-[40px] rounded-full border border-edge px-4 text-sm text-muted">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
