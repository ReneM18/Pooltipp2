"use client";

import EmptyState from "@/components/EmptyState";
import { useEffect, useRef, useState, FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useUser, FriendEntry, PlayerSearchResult } from "@/lib/UserContext";
import FitText from "@/components/FitText";
import { TrashIcon, ChatIcon } from "@/components/Icons";
import { useChat } from "@/lib/ChatContext";
import { supabase } from "@/lib/supabaseClient";

const PRIMARY_BTN =
  "shrink-0 whitespace-nowrap rounded-full bg-action px-4 py-2 font-display text-xs font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BTN =
  "shrink-0 whitespace-nowrap rounded-full border border-edge px-4 py-2 text-xs font-semibold text-muted transition-colors enabled:hover:border-red-400/60 enabled:hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50";

// Eine Zeile mit Person (Initiale, Name, Nummer) und Knöpfen rechts. Wird es
// am Handy zu eng, rutschen die Knöpfe in eine eigene Zeile – der Name wird
// nie abgeschnitten.
function PersonRow({
  name,
  number,
  link,
  muted,
  children,
}: {
  name: string;
  number: number;
  link?: boolean;
  muted?: boolean;
  children?: ReactNode;
}) {
  const person = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-xs font-semibold text-muted">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <FitText text={name} className={`text-sm font-semibold ${muted ? "text-muted" : "text-ink"}`} />
        <span className="block text-xs text-muted">#{number}</span>
      </span>
    </>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      {link ? (
        <Link
          href={`/spieler/${encodeURIComponent(name)}`}
          className="flex min-w-[10rem] flex-1 items-center gap-3 hover:[&_span]:text-gold"
        >
          {person}
        </Link>
      ) : (
        <div className="flex min-w-[10rem] flex-1 items-center gap-3">{person}</div>
      )}
      {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="divide-y divide-edge overflow-hidden rounded-card border border-edge bg-surface">{children}</div>
    </section>
  );
}

export default function FreundePage() {
  const {
    isRegistered,
    userNumber,
    friendEntries,
    friendsLoaded,
    friendsError,
    searchPlayers,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
  } = useUser();
  const { openChat, chats } = useChat();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerSearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Personen-ID, für die gerade ein Knopf gedrückt wurde – verhindert
  // Doppel-Klicks, solange die Datenbank noch antwortet.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Blockierte Spieler (chat.sql) – hier kann man die Blockierung aufheben.
  const [blocked, setBlocked] = useState<{ id: string; name: string; number: number }[]>([]);

  async function loadBlocked() {
    const { data, error } = await supabase.rpc("my_blocked");
    if (error) return; // chat.sql noch nicht ausgeführt: einfach nichts zeigen
    setBlocked(
      ((data ?? []) as { other_id: string; display_name: string; user_number: number }[]).map((b) => ({
        id: b.other_id,
        name: b.display_name,
        number: b.user_number,
      }))
    );
  }

  // Nach Freundschafts-Änderungen (z. B. Blockieren im Chat) neu laden.
  useEffect(() => {
    if (isRegistered) loadBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegistered, friendEntries]);
  const searchRequestRef = useRef(0);

  async function runSearch(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const requestId = ++searchRequestRef.current;
    setSearching(true);
    setSearchError(null);
    const { results: found, error } = await searchPlayers(trimmed);
    if (requestId !== searchRequestRef.current) return;
    setSearching(false);
    setSearchError(error);
    setResults(error ? null : found);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  // Vom Spieler-Profil aus verlinkt: /freunde?suche=Name sucht gleich los.
  const startedFromLinkRef = useRef(false);
  useEffect(() => {
    if (!isRegistered || startedFromLinkRef.current) return;
    const preset = new URLSearchParams(window.location.search).get("suche");
    if (!preset) return;
    startedFromLinkRef.current = true;
    setQuery(preset);
    runSearch(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRegistered]);

  // Nach einer Aktion den Stand in den Suchergebnissen gleich mitziehen.
  useEffect(() => {
    setResults((current) =>
      current
        ? current.map((r) => ({ ...r, relation: friendEntries.find((f) => f.id === r.id)?.relation ?? "none" }))
        : current
    );
  }, [friendEntries]);

  async function act(id: string, action: () => Promise<string | null>) {
    if (busyId) return;
    setBusyId(id);
    setActionError(null);
    const error = await action();
    setBusyId(null);
    if (error) setActionError(error);
  }

  async function copyNumber() {
    if (userNumber === null) return;
    try {
      await navigator.clipboard.writeText(`#${userNumber}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Kopieren nicht erlaubt (z. B. alter Browser) – Nummer steht ja da.
    }
  }

  if (!isRegistered) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-8 lg:max-w-4xl">
        <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Freunde</h1>
        <div className="rounded-card border border-edge bg-surface p-5 text-center">
          <p className="text-sm text-ink">Für Freunde brauchst du ein Konto.</p>
          <p className="mt-1 text-xs text-muted">
            Nach dem Anmelden bekommst du deine eigene Nummer und kannst andere Spieler mit Nummer oder Name finden.
          </p>
          <Link
            href="/registrieren"
            className="mt-4 inline-block rounded-full bg-action px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Anmelden oder registrieren
          </Link>
        </div>
      </main>
    );
  }

  const incoming = friendEntries.filter((f) => f.relation === "incoming");
  const accepted = friendEntries.filter((f) => f.relation === "friend");
  const outgoing = friendEntries.filter((f) => f.relation === "outgoing");

  function resultActions(r: PlayerSearchResult) {
    const busy = busyId === r.id;
    if (r.relation === "friend") return <span className="text-xs font-semibold text-action">Befreundet ✓</span>;
    if (r.relation === "outgoing") return <span className="text-xs text-muted">Anfrage gesendet</span>;
    if (r.relation === "incoming") {
      return (
        <button className={PRIMARY_BTN} disabled={busy} onClick={() => act(r.id, () => respondFriendRequest(r.id, true))}>
          Annehmen
        </button>
      );
    }
    return (
      <button className={PRIMARY_BTN} disabled={busy} onClick={() => act(r.id, () => sendFriendRequest(r.id))}>
        {busy ? "…" : "Anfrage senden"}
      </button>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:max-w-4xl">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Freunde</h1>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-surface p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">Deine Nummer</p>
          <p className="font-display text-2xl font-bold text-gold">{userNumber !== null ? `#${userNumber}` : "–"}</p>
          <p className="text-xs text-muted">Gib sie weiter, damit dich Freunde finden.</p>
        </div>
        {userNumber !== null && (
          <button
            type="button"
            onClick={copyNumber}
            className="shrink-0 rounded-full border border-edge px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-gold/60 hover:text-ink"
          >
            {copied ? "Kopiert ✓" : "Nummer kopieren"}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nummer oder Name, z. B. #1002"
          inputMode="search"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-4 py-2.5 text-base text-ink outline-none focus:border-gold sm:text-sm"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="shrink-0 whitespace-nowrap rounded-full bg-action px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:opacity-60"
        >
          {searching ? "…" : "Suchen"}
        </button>
      </form>
      <p className="mt-1.5 text-xs text-muted">Andere sehen nur deinen Namen und deine Nummer, nie deine E-Mail.</p>

      {searchError && <p className="mt-3 text-sm text-red-400">{searchError}</p>}
      {results && (
        <div className="mt-3 divide-y divide-edge overflow-hidden rounded-card border border-edge bg-surface">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted">
              Niemand gefunden. Bei Namen mindestens 2 Buchstaben eingeben, oder die Nummer mit oder ohne # .
            </p>
          ) : (
            results.map((r) => (
              <PersonRow key={r.id} name={r.name} number={r.number}>
                {resultActions(r)}
              </PersonRow>
            ))
          )}
        </div>
      )}

      {actionError && <p className="mt-4 text-sm text-red-400">{actionError}</p>}
      {friendsError && <p className="mt-4 text-sm text-red-400">{friendsError}</p>}

      {incoming.length > 0 && (
        <Section title={`Anfragen an dich (${incoming.length})`}>
          {incoming.map((f: FriendEntry) => (
            <PersonRow key={f.id} name={f.name} number={f.number}>
              <button
                className={PRIMARY_BTN}
                disabled={busyId === f.id}
                onClick={() => act(f.id, () => respondFriendRequest(f.id, true))}
              >
                Annehmen
              </button>
              <button
                className={SECONDARY_BTN}
                disabled={busyId === f.id}
                onClick={() => act(f.id, () => respondFriendRequest(f.id, false))}
              >
                Ablehnen
              </button>
            </PersonRow>
          ))}
        </Section>
      )}

      <Section title={`Deine Freunde${accepted.length ? ` (${accepted.length})` : ""}`}>
        {accepted.length === 0 ? (
          friendsLoaded ? (
            <EmptyState
              emoji="👋"
              title="Noch keine Freunde"
              text="Gib deine Nummer weiter oder such oben nach Nummer oder Name."
              className="rounded-none border-none"
            />
          ) : (
            <p className="p-4 text-sm text-muted">Lädt…</p>
          )
        ) : (
          accepted.map((f) => (
            <PersonRow key={f.id} name={f.name} number={f.number} link>
              <button onClick={() => openChat(f.id)} className={`${PRIMARY_BTN} relative flex items-center gap-1.5 !px-3.5`}>
                <ChatIcon className="h-3.5 w-3.5" />
                Schreiben
                {(chats.find((c) => c.friendId === f.id)?.unread ?? 0) > 0 && (
                  <span className="absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-red-500 px-1 text-[10px] font-bold text-white">
                    {chats.find((c) => c.friendId === f.id)?.unread}
                  </span>
                )}
              </button>
              <button
                aria-label={`${f.name} entfernen`}
                title="Entfernen"
                disabled={busyId === f.id}
                onClick={() => {
                  if (confirm(`${f.name} wirklich aus deiner Freundesliste entfernen?`)) {
                    act(f.id, () => removeFriend(f.id));
                  }
                }}
                className="flex items-center gap-1 p-2 sm:px-1 sm:py-1 text-xs text-muted transition-colors hover:text-red-400 disabled:opacity-50"
              >
                <TrashIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Entfernen</span>
              </button>
            </PersonRow>
          ))
        )}
      </Section>

      {outgoing.length > 0 && (
        <Section title="Gesendete Anfragen">
          {outgoing.map((f) => (
            <PersonRow key={f.id} name={f.name} number={f.number} muted>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
                wartet
              </span>
              <button
                className={SECONDARY_BTN}
                disabled={busyId === f.id}
                onClick={() => act(f.id, () => removeFriend(f.id))}
              >
                Zurückziehen
              </button>
            </PersonRow>
          ))}
        </Section>
      )}
      {blocked.length > 0 && (
        <Section title="Blockiert">
          {blocked.map((b) => (
            <PersonRow key={b.id} name={b.name} number={b.number} muted>
              <button
                className={SECONDARY_BTN}
                disabled={busyId === b.id}
                onClick={() =>
                  act(b.id, async () => {
                    const { error } = await supabase.rpc("unblock_user", { p_other: b.id });
                    if (error) return "Das hat gerade nicht geklappt. Versuch es nochmal.";
                    await loadBlocked();
                    return null;
                  })
                }
              >
                Freigeben
              </button>
            </PersonRow>
          ))}
        </Section>
      )}
    </main>
  );
}
