"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PlayerAvatar from "./PlayerAvatar";
import { StateDot, signedPoints } from "./LiveMatch";
import { useFriendsLive, type FriendsLivePlayer, type FriendsLiveState, type FriendsLiveTable } from "@/lib/friendsLive";

// Freunde-Live (Rene, 16.10.2026: Freunde-Live): Zeile auf der Tippkarte,
// Tabelle (Matchcenter-Reiter "Freunde" und Bottom-Sheet) und Ticker.
// Ruhig wie die übrigen Live-Bausteine: Gold nur für dich und Positives,
// Rot nur als Live-Punkt.

const ALL_UP_TO = 7;

function MoveMark({ move, className = "" }: { move: number; className?: string }) {
  if (move > 0) return <span className={`text-gold ${className}`}>▲{move}</span>;
  if (move < 0) return <span className={`text-muted ${className}`}>▼{-move}</span>;
  return <span className={`text-muted/60 ${className}`}>–</span>;
}

// Gestapelte Profilbilder der Top 3.
function TopAvatars({ players }: { players: FriendsLivePlayer[] }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {players.slice(0, 3).map((p, i) => (
        <span key={p.id} className={`rounded-full ring-2 ring-pitch ${i > 0 ? "-ml-1.5" : ""}`} style={{ zIndex: 3 - i }}>
          <PlayerAvatar id={p.id} name={p.name} size={22} />
        </span>
      ))}
    </span>
  );
}

// EINE Zeile unter "Dein Tipp": "Freunde: du bist 2. von 12 ▲1" + Top 3.
// Feste Höhe, auch solange noch geladen wird – die Karte springt nicht.
export function FriendsLiveRow({ state, onOpen, className = "mt-1.5" }: { state: FriendsLiveState; onOpen: () => void; className?: string }) {
  const table = state.tables.find((t) => t.key === "friends");
  const ready = state.ready && !!table;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!ready}
      aria-haspopup="dialog"
      aria-label={ready ? `Freunde live: du bist ${table!.me.rank}. von ${table!.players.length}. Tabelle öffnen` : "Freunde live wird geladen"}
      className={`${className} flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-edge bg-pitch px-3 text-left text-[13px] transition-colors enabled:hover:border-muted/40 disabled:cursor-default`}
    >
      {ready ? (
        <>
          <span className="min-w-0 truncate text-muted">
            Freunde: du bist{" "}
            <span className="font-display font-bold text-ink">
              {table!.me.rank}.
            </span>{" "}
            von {table!.players.length}{" "}
            <MoveMark move={table!.me.move} className="text-[12px] font-semibold" />
            {table!.me.tied && <span className="text-muted/80"> · gleichauf</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <TopAvatars players={table!.players} />
            <span aria-hidden className="text-[12px] leading-none text-muted">›</span>
          </span>
        </>
      ) : (
        <span className="text-muted/70">Freunde live wird geladen …</span>
      )}
    </button>
  );
}

// Sichtbare Zeilen: bis 7 alle, sonst Top 3, "· · ·", du mit Nachbarn.
function visibleRows(players: FriendsLivePlayer[], expanded: boolean): (FriendsLivePlayer | "gap")[] {
  if (expanded || players.length <= ALL_UP_TO) return players;
  const me = players.findIndex((p) => p.isMe);
  const keep = new Set([0, 1, 2, me - 1, me, me + 1].filter((i) => i >= 0 && i < players.length));
  const out: (FriendsLivePlayer | "gap")[] = [];
  let last = -1;
  players.forEach((p, i) => {
    if (!keep.has(i)) return;
    if (i > last + 1) out.push("gap");
    out.push(p);
    last = i;
  });
  return out;
}

function PlayerRow({ player, games }: { player: FriendsLivePlayer; games: number }) {
  return (
    <li
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
        player.isMe ? "border border-gold/50 bg-gold/10" : "border border-transparent"
      }`}
    >
      <span className="w-7 shrink-0 text-right font-display text-sm font-bold tabular-nums text-ink">{player.rank}.</span>
      <PlayerAvatar id={player.id} name={player.name} size={28} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-semibold ${player.isMe ? "text-gold" : "text-ink"}`}>
          {player.isMe ? "Du" : player.name}
        </span>
        <span className="block text-[11px] leading-tight text-muted">
          {player.correct} von {games} richtig
          {player.tied && " · gleichauf"}
        </span>
      </span>
      <span className="flex shrink-0 items-baseline gap-2">
        <span className={`font-display text-sm font-bold tabular-nums ${player.isMe && player.points > 0 ? "text-gold" : "text-ink"}`}>
          {signedPoints(player.points)}
        </span>
        <MoveMark move={player.move} className="w-6 text-right text-[11px] font-semibold tabular-nums" />
      </span>
    </li>
  );
}

function TableView({ table, games }: { table: FriendsLiveTable; games: number }) {
  const [expanded, setExpanded] = useState(false);
  const rows = visibleRows(table.players, expanded);
  const hidden = table.players.length - rows.filter((r) => r !== "gap").length;
  const word = table.isLeague ? "Mitglieder" : "Freunde";
  return (
    <div>
      <ul className="flex flex-col gap-0.5">
        {rows.map((r, i) =>
          r === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="py-0.5 text-center text-xs tracking-[0.3em] text-muted/60">
              · · ·
            </li>
          ) : (
            <PlayerRow key={r.id} player={r} games={games} />
          ),
        )}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 w-full rounded-lg py-1.5 text-center text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          + {hidden} weitere {word}
        </button>
      )}
      {expanded && table.players.length > ALL_UP_TO && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1.5 w-full rounded-lg py-1.5 text-center text-xs font-semibold text-muted transition-colors hover:text-ink"
        >
          Weniger zeigen
        </button>
      )}
      {table.ticker.length > 0 && (
        <div className="mt-3 border-t border-edge pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Ticker</p>
          <ul className="flex flex-col gap-1" aria-live="polite">
            {table.ticker.map((t) => (
              <li key={t.id} className="text-[12px] leading-snug text-muted">
                {t.minute && <span className="tabular-nums">{t.minute} </span>}
                <span className="text-ink">{t.goal}</span>
                {t.change && (
                  <>
                    {" · "}
                    <span className={t.good ? "font-semibold text-gold" : "text-ink"}>{t.change}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Kopf, Reiter (Spieltag + je Tipprunde), Tabelle und Ticker.
export function FriendsLivePanel({ state, onClose }: { state: FriendsLiveState | null; onClose?: () => void }) {
  const [tab, setTab] = useState("friends");
  const tables = state?.tables ?? [];
  const table = tables.find((t) => t.key === tab) ?? tables[0] ?? null;
  const liveCount = state?.liveCount ?? 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-1.5 font-display text-base font-bold leading-tight text-ink">
            Freunde live
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
                · <StateDot state="live" /> {liveCount} {liveCount === 1 ? "Spiel" : "Spiele"} live
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">
            So steht ihr am Spieltag, wenn alles so bleibt – vorläufig, Bonus kommt nach der Wertung
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted transition-colors hover:text-ink"
          >
            ×
          </button>
        )}
      </div>

      {tables.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Tabelle">
          {tables.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={table?.key === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                table?.key === t.key ? "border-muted/50 bg-surface-hover text-ink" : "border-edge text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        {!state ? (
          <p className="py-6 text-center text-sm text-muted">Gerade läuft kein Spiel mit Live-Stand.</p>
        ) : !state.ready ? (
          <p className="py-6 text-center text-sm text-muted">Lädt…</p>
        ) : !table ? (
          <p className="py-6 text-center text-sm text-muted">Füge Freunde hinzu, um live gegen sie zu spielen.</p>
        ) : (
          <TableView key={table.key} table={table} games={table.gameCount} />
        )}
      </div>
    </div>
  );
}

// Bottom-Sheet (Handy) bzw. Fenster (ab sm), per Portal in <body>. Fragt
// solange es offen ist alle laufenden Sportarten im gemeinsamen Takt ab.
export function FriendsLiveSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useFriendsLive(open, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-pitch/80 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Freunde live"
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-card border border-edge bg-surface shadow-2xl sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-edge sm:hidden" />
        <div className="overflow-y-auto px-4 pb-[calc(1rem+var(--safe-bottom))] pt-3 sm:px-5 sm:pb-5 sm:pt-4">
          <FriendsLivePanel state={state} onClose={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
