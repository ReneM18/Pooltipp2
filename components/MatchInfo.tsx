"use client";

import { useEffect, useState } from "react";
import type { LineupPlayer, LineupTeam, MatchInfoResponse, StatTeam } from "@/lib/matchInfo";

// Aufstellung und Statistik im Matchcenter-Detail (Rene, 27.10.2026:
// Pro-Plan, "Aufstellungen oder sonstige Info"). Daten über
// /api/match-info, im Browser je Spiel kurz gemerkt (im Spiel 2 Min., sonst
// 10 Min.). Läuft das Spiel, lädt der offene Reiter alle 2 Min. nach.

const LIVE_KEEP_MS = 2 * 60 * 1000;
const KEEP_MS = 10 * 60 * 1000;
const cache = new Map<string, { body: MatchInfoResponse; at: number }>();

function cached(fixture: string, live: boolean): MatchInfoResponse | null {
  const hit = cache.get(fixture);
  return hit && Date.now() - hit.at < (live ? LIVE_KEEP_MS : KEEP_MS) ? hit.body : null;
}

export function useMatchInfo(fixture: string | null, live: boolean) {
  const [data, setData] = useState<MatchInfoResponse | null>(() => (fixture ? cached(fixture, live) : null));
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!fixture) return;
    const hit = cached(fixture, live);
    if (hit) {
      setData(hit);
      return;
    }
    let cancelled = false;
    setFailed(false);
    fetch(`/api/match-info?fixture=${encodeURIComponent(fixture)}`)
      .then((res) => res.json() as Promise<MatchInfoResponse>)
      .then((body) => {
        if (cancelled) return;
        if (!body.error && !body.lineupsError && !body.statsError) cache.set(fixture, { body, at: Date.now() });
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fixture, live, tick]);

  useEffect(() => {
    if (!fixture || !live) return;
    const t = setInterval(() => setTick((n) => n + 1), LIVE_KEEP_MS);
    return () => clearInterval(t);
  }, [fixture, live]);

  return { data, failed, retry: () => setTick((n) => n + 1) };
}

// Die beiden Mannschaften in Anzeige-Reihenfolge (links/oben zuerst) über
// den API-Namen, sonst in der Reihenfolge der API (Heim zuerst).
export function orderByTeam<T extends { team: string }>(list: T[], firstApiName: string): [T | null, T | null] {
  if (list.length === 0) return [null, null];
  const i = list.findIndex((t) => t.team === firstApiName);
  if (i === 1) return [list[1], list[0] ?? null];
  return [list[0], list[1] ?? null];
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-edge px-3 py-6 text-center text-[13px] text-muted">{children}</p>;
}

// ---------------------------------------------------------------------------
// Aufstellung: Spielfeld von oben, erste Mannschaft oben (Tor oben), zweite
// unten. Ohne Feldpositionen von der API als Liste.

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

// Spieler als kleines Trikot mit Nummer (Rene, 27.10.2026, Variante B
// "TV-Grafik"), Torhüter in Torwartfarbe, darunter der Nachname.
function PlayerDot({ p, team, x, y }: { p: LineupPlayer; team: LineupTeam; x: number; y: number }) {
  const keeper = p.pos === "G";
  const bg = (keeper ? team.keeperColor : team.color) ?? (keeper ? "e8b34c" : "2d3a35");
  const fg = team.numberColor && !keeper ? team.numberColor : "ffffff";
  return (
    <span className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${x}%`, top: `${y}%` }}>
      <svg viewBox="0 0 40 36" className="h-[26px] w-[29px] drop-shadow" aria-hidden>
        <path
          d="M13 2 L5 6 L1 15 L7 18 L9 13 L9 34 L31 34 L31 13 L33 18 L39 15 L35 6 L27 2 Q20 8 13 2Z"
          fill={`#${bg}`}
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1.3"
        />
        <text x="20" y="26" textAnchor="middle" fontFamily="var(--font-poppins), sans-serif" fontWeight="700" fontSize="12" fill={`#${fg}`}>
          {p.number ?? ""}
        </text>
      </svg>
      <span className="max-w-full truncate rounded bg-black/45 px-1 text-[10px] font-semibold leading-tight text-white">{shortName(p.name)}</span>
    </span>
  );
}

function placed(team: LineupTeam, top: boolean) {
  const rows = new Map<number, LineupPlayer[]>();
  for (const p of team.startXI) {
    if (p.row === null) continue;
    rows.set(p.row, [...(rows.get(p.row) ?? []), p]);
  }
  const maxRow = Math.max(1, ...rows.keys());
  const out: { p: LineupPlayer; x: number; y: number }[] = [];
  for (const [row, players] of rows) {
    const sorted = [...players].sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
    const depth = maxRow > 1 ? (row - 1) / (maxRow - 1) : 0;
    const y = top ? 6 + depth * 38 : 94 - depth * 38;
    sorted.forEach((p, i) => {
      const x = ((i + 1) / (sorted.length + 1)) * 100;
      // Oben schaut die Mannschaft nach unten: links und rechts tauschen.
      out.push({ p, x: top ? 100 - x : x, y });
    });
  }
  return out;
}

function TeamHead({ team, name }: { team: LineupTeam; name: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
        {team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" width={16} height={16} loading="lazy" className="h-4 w-4 shrink-0 object-contain" />
        )}
        <span className="truncate">{name}</span>
      </span>
      {team.formation && <span className="shrink-0 font-display font-bold text-gold">{team.formation}</span>}
    </div>
  );
}

function PlayerList({ players }: { players: LineupPlayer[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-[12px] text-ink">
      {players.map((p, i) => (
        <li key={`${p.name}-${i}`} className="flex gap-1.5">
          <span className="w-5 shrink-0 text-right tabular-nums text-muted">{p.number ?? ""}</span>
          <span className="min-w-0 truncate">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function LineupView({
  info,
  failed,
  onRetry,
  firstApiName,
  teamName,
  started,
}: {
  info: MatchInfoResponse | null;
  failed: boolean;
  onRetry: () => void;
  firstApiName: string;
  teamName: (apiName: string) => string;
  started: boolean;
}) {
  const lineupError = info?.error ?? info?.lineupsError;
  if (failed || lineupError)
    return (
      <Note>
        Aufstellung gerade nicht abrufbar{lineupError ? ` (${lineupError})` : ""}.{" "}
        <button type="button" onClick={onRetry} className="font-semibold text-ink underline">
          Nochmal
        </button>
      </Note>
    );
  if (!info) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  const [a, b] = orderByTeam(info.lineups, firstApiName);
  if (!a || !b || (a.startXI.length === 0 && b.startXI.length === 0))
    // Läuft das Spiel schon, kommt auch keine mehr: manche Bewerbe (z. B.
    // ÖFB-Cup) deckt der Anbieter ohne Aufstellung ab (Rene, 27.10.2026).
    return started ? (
      <Note>Für dieses Spiel liefert unser Datenanbieter keine Aufstellung. Bei den großen Ligen ist sie meist dabei.</Note>
    ) : (
      <Note>Die Aufstellungen kommen meist 20 bis 40 Minuten vor Anpfiff.</Note>
    );

  const withGrid = a.startXI.every((p) => p.row !== null) && b.startXI.every((p) => p.row !== null);
  return (
    <div className="flex flex-col gap-3">
      <TeamHead team={a} name={teamName(a.team)} />
      {withGrid ? (
        <div
          className="relative aspect-[3/4] w-full overflow-hidden rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]"
          style={{ background: "repeating-linear-gradient(180deg, #2f8a4c 0 10%, #2a7d45 10% 20%)" }}
        >
          {/* Linien: Rand, Mittellinie, Mittelkreis, Strafräume */}
          <span aria-hidden className="absolute inset-[4%] rounded-sm border-2 border-white/45" />
          <span aria-hidden className="absolute inset-x-[4%] top-1/2 h-0.5 -translate-y-1/2 bg-white/45" />
          <span aria-hidden className="absolute left-1/2 top-1/2 aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45" />
          <span aria-hidden className="absolute inset-x-[28%] top-[4%] h-[12%] border-2 border-t-0 border-white/45" />
          <span aria-hidden className="absolute inset-x-[28%] bottom-[4%] h-[12%] border-2 border-b-0 border-white/45" />
          {placed(a, true).map(({ p, x, y }, i) => (
            <PlayerDot key={`a-${i}`} p={p} team={a} x={x} y={y} />
          ))}
          {placed(b, false).map(({ p, x, y }, i) => (
            <PlayerDot key={`b-${i}`} p={p} team={b} x={x} y={y} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <PlayerList players={a.startXI} />
          <PlayerList players={b.startXI} />
        </div>
      )}
      <TeamHead team={b} name={teamName(b.team)} />
      {(a.substitutes.length > 0 || b.substitutes.length > 0 || a.coach || b.coach) && (
        <details className="rounded-lg border border-edge bg-pitch/60 px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-muted">Ersatzbank und Trainer</summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[a, b].map((t) => (
              <div key={t.team} className="min-w-0">
                <p className="mb-1 truncate text-[11px] font-semibold text-ink">{teamName(t.team)}</p>
                <PlayerList players={t.substitutes} />
                {t.coach && <p className="mt-1.5 truncate text-[11px] text-muted">Trainer: {t.coach}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Statistik: je Wert eine Zeile, links/rechts die Zahlen, darunter zwei
// Balken von der Mitte aus.

const STAT_LABELS: [string, string][] = [
  ["Ball Possession", "Ballbesitz"],
  ["expected_goals", "Erwartete Tore (xG)"],
  ["Total Shots", "Schüsse"],
  ["Shots on Goal", "Aufs Tor"],
  ["Corner Kicks", "Ecken"],
  ["Goalkeeper Saves", "Paraden"],
  ["Passes %", "Passquote"],
  ["Fouls", "Fouls"],
  ["Offsides", "Abseits"],
  ["Yellow Cards", "Gelbe Karten"],
  ["Red Cards", "Rote Karten"],
];

function num(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace("%", ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function show(value: number | string | null | undefined): string {
  return value === null || value === undefined ? "0" : String(value);
}

export function StatsView({
  info,
  failed,
  onRetry,
  firstApiName,
  started,
}: {
  info: MatchInfoResponse | null;
  failed: boolean;
  onRetry: () => void;
  firstApiName: string;
  started: boolean;
}) {
  if (!started) return <Note>Die Statistik gibt es ab Anpfiff.</Note>;
  const statError = info?.error ?? info?.statsError;
  if (failed || statError)
    return (
      <Note>
        Statistik gerade nicht abrufbar{statError ? ` (${statError})` : ""}.{" "}
        <button type="button" onClick={onRetry} className="font-semibold text-ink underline">
          Nochmal
        </button>
      </Note>
    );
  if (!info) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  const [a, b] = orderByTeam<StatTeam>(info.stats, firstApiName);
  if (!a || !b || (a.stats.length === 0 && b.stats.length === 0)) return <Note>Für dieses Spiel liefert unser Datenanbieter keine Statistik. Bei den großen Ligen ist sie meist dabei.</Note>;
  const value = (t: StatTeam, type: string) => t.stats.find((s) => s.type === type)?.value;
  const rows = STAT_LABELS.filter(([type]) => value(a, type) !== undefined || value(b, type) !== undefined);
  return (
    <div className="flex flex-col gap-3">
      {rows.map(([type, label]) => {
        const va = value(a, type);
        const vb = value(b, type);
        const na = num(va);
        const nb = num(vb);
        const max = Math.max(na, nb);
        const pa = max > 0 ? (na / max) * 100 : 0;
        const pb = max > 0 ? (nb / max) * 100 : 0;
        return (
          <div key={type}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className={`font-display font-bold tabular-nums ${na > nb ? "text-gold" : "text-ink"}`}>{show(va)}</span>
              <span className="truncate text-[12px] text-muted">{label}</span>
              <span className={`font-display font-bold tabular-nums ${nb > na ? "text-gold" : "text-ink"}`}>{show(vb)}</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="flex h-1.5 justify-end overflow-hidden rounded-full bg-edge/60">
                <span className={`h-full rounded-full ${na >= nb ? "bg-gold" : "bg-muted/60"}`} style={{ width: `${pa}%` }} />
              </span>
              <span className="flex h-1.5 overflow-hidden rounded-full bg-edge/60">
                <span className={`h-full rounded-full ${nb >= na ? "bg-gold" : "bg-muted/60"}`} style={{ width: `${pb}%` }} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
