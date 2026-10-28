"use client";

import { useEffect, useState } from "react";
import { gameResult, type LineupPlayer, type LineupTeam, type MatchInfoResponse, type MatchPreviewResponse, type PreviewGame, type PreviewTeam, type StatTeam } from "@/lib/matchInfo";

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
// Aufstellung (Rene, 28.10.2026, Variante A "Ein Team, großes Feld"): oben
// Umschalter zwischen den Teams, darunter eine Spielhälfte mit großen
// Trikots, Tor unten. Namen nie abgeschnitten, sie dürfen umbrechen. Ohne
// Feldpositionen von der API als Liste.

// Anzeigename einheitlich nur der Nachname (Rene, 28.10.2026): "N. Hauptmann"
// und "Vitalie Becker" → "Becker", Namenszusätze bleiben ("V. van Dijk" →
// "van Dijk").
const NAME_PARTICLES = new Set(["van", "von", "de", "der", "den", "da", "di", "do", "dos", "das", "del", "della", "le", "la", "ter", "ten", "zu"]);

export function playerLabel(name: string): string {
  const parts = name.trim().split(/\s+/).filter((w) => !/^\p{L}{1,2}\.$/u.test(w));
  if (parts.length === 0) return name.trim();
  let i = parts.length - 1;
  while (i > 0 && NAME_PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(" ");
}

function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Trikotfarben eines Teams. Liefert der Anbieter keine (Rene, 28.10.2026:
// beide Teams waren dunkel), bekommt das erste Team Weiß, das zweite Blau.
export function kitColors(team: LineupTeam, index: number): { shirt: string; number: string; keeper: string; keeperNumber: string } {
  const shirt = team.color ?? (index === 0 ? "f3f1ea" : "2563eb");
  const readable = (bg: string, wanted: string | null) =>
    wanted && contrast(bg, wanted) >= 2.5 ? wanted : luminance(bg) > 0.35 ? "15201b" : "ffffff";
  let keeper = team.keeperColor ?? "e8b34c";
  if (contrast(keeper, shirt) < 1.4) keeper = luminance(shirt) > 0.35 ? "2fa45a" : "e8b34c";
  return { shirt, number: readable(shirt, team.numberColor), keeper, keeperNumber: readable(keeper, null) };
}

function Shirt({ color, numberColor, number }: { color: string; numberColor: string; number: number | null }) {
  return (
    <svg viewBox="0 0 40 36" className="h-9 w-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]" aria-hidden>
      <path
        d="M13 2 L5 6 L1 15 L7 18 L9 13 L9 34 L31 34 L31 13 L33 18 L39 15 L35 6 L27 2 Q20 8 13 2Z"
        fill={`#${color}`}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.2"
      />
      <path d="M13 2 Q20 8 27 2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <text x="20" y="26" textAnchor="middle" fontFamily="var(--font-poppins), sans-serif" fontWeight="800" fontSize="12" fill={`#${numberColor}`}>
        {number ?? ""}
      </text>
    </svg>
  );
}

// Spieler auf einer Hälfte, Tor unten: Reihe 1 (Tor) unten, Sturm oben.
function placed(team: LineupTeam) {
  const rows = new Map<number, LineupPlayer[]>();
  for (const p of team.startXI) {
    if (p.row === null) continue;
    rows.set(p.row, [...(rows.get(p.row) ?? []), p]);
  }
  const maxRow = Math.max(2, ...rows.keys());
  const out: { p: LineupPlayer; x: number; y: number; perRow: number }[] = [];
  for (const [row, players] of rows) {
    const sorted = [...players].sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
    const y = 89 - ((row - 1) / (maxRow - 1)) * 73;
    sorted.forEach((p, i) => out.push({ p, x: ((i + 1) / (sorted.length + 1)) * 100, y, perRow: sorted.length }));
  }
  return out;
}

function HalfPitch({ team, index }: { team: LineupTeam; index: number }) {
  const kit = kitColors(team, index);
  const line = "border-white/50";
  return (
    <div
      className="relative aspect-[4/4.4] w-full overflow-hidden rounded-xl shadow-[inset_0_0_50px_rgba(0,0,0,0.35)]"
      style={{ background: "repeating-linear-gradient(180deg, #2f8a4c 0 12.5%, #2a7d45 12.5% 25%)" }}
    >
      {/* Linien: Rand, Mittelkreis oben angeschnitten, Strafraum, Torraum */}
      <span aria-hidden className={`absolute inset-[3%] border-2 border-t-0 ${line}`} />
      <span aria-hidden className={`absolute left-1/2 top-0 aspect-square w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${line}`} />
      <span aria-hidden className={`absolute inset-x-[22%] bottom-[3%] h-[17%] border-2 border-b-0 ${line}`} />
      <span aria-hidden className={`absolute inset-x-[36%] bottom-[3%] h-[6%] border-2 border-b-0 ${line}`} />
      {placed(team).map(({ p, x, y, perRow }, i) => {
        const keeper = p.pos === "G";
        return (
          <span
            key={i}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center"
            style={{ left: `${x}%`, top: `${y}%`, width: `min(96px, calc(${100 / perRow}% - 4px))` }}
          >
            <Shirt color={keeper ? kit.keeper : kit.shirt} numberColor={keeper ? kit.keeperNumber : kit.number} number={p.number} />
            <span className="line-clamp-2 max-w-full text-[12px] font-semibold leading-tight text-white [overflow-wrap:anywhere] [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_6px_rgba(0,0,0,0.6)]">
              {playerLabel(p.name)}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function TeamHead({ team, name }: { team: LineupTeam; name: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
        {team.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] shrink-0 object-contain" />
        )}
        <span className="min-w-0 break-words">{name}</span>
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
          <span className="min-w-0 break-words">{p.name}</span>
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
  const [selected, setSelected] = useState(0);
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

  const teams = [a, b];
  const team = teams[selected] ?? a;
  const withGrid = team.startXI.length > 0 && team.startXI.every((p) => p.row !== null);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2" role="tablist">
        {teams.map((t, i) => {
          const kit = kitColors(t, i);
          const on = i === selected;
          return (
            <button
              key={t.team}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(i)}
              className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold leading-tight transition-colors ${
                on ? "" : "border border-edge bg-pitch/60 text-muted hover:text-ink"
              }`}
              style={on ? { background: `#${kit.shirt}`, color: `#${kit.number}` } : undefined}
            >
              {!on && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/40" style={{ background: `#${kit.shirt}` }} />}
              <span className="min-w-0 break-words text-center">{teamName(t.team)}</span>
            </button>
          );
        })}
      </div>
      <TeamHead team={team} name={teamName(team.team)} />
      {withGrid ? <HalfPitch team={team} index={selected} /> : <PlayerList players={team.startXI} />}
      {team.coach && <p className="text-[12px] text-muted">Trainer: {team.coach}</p>}
      {team.substitutes.length > 0 && (
        <details className="rounded-lg border border-edge bg-pitch/60 px-3 py-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-muted">Ersatzbank</summary>
          <div className="mt-2">
            <PlayerList players={team.substitutes} />
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

// ---------------------------------------------------------------------------
// Vor dem Spiel (Rene, 28.10.2026: "mehr Statistik, zB die letzten
// Partien"): Tabelle, Form der letzten 5, direkter Vergleich, Tore pro
// Spiel. Im Browser 30 Min. gemerkt, ändert sich nur nach einem Abpfiff.

const PREVIEW_KEEP_MS = 30 * 60 * 1000;
const previewCache = new Map<string, { body: MatchPreviewResponse; at: number }>();

function cachedPreview(fixture: string | null): MatchPreviewResponse | null {
  const c = fixture ? previewCache.get(fixture) : undefined;
  return c && Date.now() - c.at < PREVIEW_KEEP_MS ? c.body : null;
}

export function useMatchPreview(fixture: string | null) {
  const [data, setData] = useState<MatchPreviewResponse | null>(() => cachedPreview(fixture));
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!fixture) return;
    const c = cachedPreview(fixture);
    if (c) {
      setData(c);
      return;
    }
    let cancelled = false;
    setFailed(false);
    setData(null);
    fetch(`/api/match-preview?fixture=${encodeURIComponent(fixture)}`)
      .then((res) => res.json() as Promise<MatchPreviewResponse>)
      .then((body) => {
        if (cancelled) return;
        if (!body.error) previewCache.set(fixture, { body, at: Date.now() });
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fixture, tick]);

  return { data, failed, retry: () => setTick((n) => n + 1) };
}

const RESULT_STYLE: Record<"S" | "U" | "N", string> = {
  S: "bg-[#2fa45a] text-white",
  U: "bg-[#6b7770] text-white",
  N: "bg-[#d64545] text-white",
};

function ResultChip({ r }: { r: "S" | "U" | "N" }) {
  return (
    <span className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${RESULT_STYLE[r]}`}>{r}</span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-edge bg-pitch/60 px-3 py-2.5">{children}</div>;
}

// Zahl links | Bezeichnung | Zahl rechts
function Row3({ left, label, right }: { left: string; label: string; right: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr_64px] items-center py-1">
      <span className="font-display text-[15px] font-bold tabular-nums text-ink">{left}</span>
      <span className="text-center text-[12px] text-muted">{label}</span>
      <span className="text-right font-display text-[15px] font-bold tabular-nums text-ink">{right}</span>
    </div>
  );
}

function shortDate(iso: string, withYear: boolean): string {
  return new Date(iso).toLocaleDateString("de-AT", {
    timeZone: "Europe/Vienna",
    day: "2-digit",
    month: "2-digit",
    ...(withYear ? { year: "2-digit" } : {}),
  });
}

function GameLine({ g, team, teamName, withYear }: { g: PreviewGame; team?: string; teamName: (apiName: string) => string; withYear?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 py-1 text-[12.5px]">
      <span className="tabular-nums text-[11.5px] text-muted">{shortDate(g.date, !!withYear)}</span>
      <span className="min-w-0 break-words text-ink">
        {teamName(g.home)} – {teamName(g.away)}
      </span>
      <span className="font-display font-bold tabular-nums text-ink">
        {g.homeGoals}:{g.awayGoals}
      </span>
      {team ? <ResultChip r={gameResult(g, team)} /> : <span />}
    </div>
  );
}

function perGame(goals: number | null, played: number | null): string {
  return goals !== null && played ? (goals / played).toLocaleString("de-AT", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "–";
}

export function PreviewView({
  info,
  failed,
  onRetry,
  firstApiName,
  teamName,
}: {
  info: MatchPreviewResponse | null;
  failed: boolean;
  onRetry: () => void;
  firstApiName: string;
  teamName: (apiName: string) => string;
}) {
  if (failed || info?.error)
    return (
      <Note>
        Form und Vergleich gerade nicht abrufbar{info?.error ? ` (${info.error})` : ""}.{" "}
        <button type="button" onClick={onRetry} className="font-semibold text-ink underline">
          Nochmal
        </button>
      </Note>
    );
  if (!info) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  const [a, b] = orderByTeam<PreviewTeam>(info.teams, firstApiName);
  if (!a || !b) return null;
  const nameA = teamName(a.team);
  const nameB = teamName(b.team);
  const withTable = a.rank !== null && b.rank !== null;
  const withForm = a.form.length > 0 || b.form.length > 0;
  const wins = (t: string) => info.h2h.filter((g) => gameResult(g, t) === "S").length;
  const [winsA, winsB] = [wins(a.team), wins(b.team)];
  const draws = info.h2h.length - winsA - winsB;
  if (!withTable && !withForm && info.h2h.length === 0)
    return <Note>Für dieses Spiel liefert unser Datenanbieter keine Form und keinen Vergleich.</Note>;

  return (
    <div className="flex flex-col gap-4">
      {withTable && (
        <div>
          <SectionTitle>Tabelle</SectionTitle>
          <Box>
            <div className="mb-1 grid grid-cols-2 gap-2 text-[12px] font-semibold text-ink">
              <span className="break-words">{nameA}</span>
              <span className="break-words text-right">{nameB}</span>
            </div>
            <Row3 left={`${a.rank}.`} label="Platz" right={`${b.rank}.`} />
            <Row3 left={String(a.points ?? "–")} label="Punkte" right={String(b.points ?? "–")} />
            <Row3 left={`${a.goalsFor ?? 0}:${a.goalsAgainst ?? 0}`} label="Tore" right={`${b.goalsFor ?? 0}:${b.goalsAgainst ?? 0}`} />
            <Row3 left={perGame(a.goalsFor, a.played)} label="Tore pro Spiel" right={perGame(b.goalsFor, b.played)} />
            <Row3 left={perGame(a.goalsAgainst, a.played)} label="Gegentore pro Spiel" right={perGame(b.goalsAgainst, b.played)} />
          </Box>
        </div>
      )}

      {withForm && (
        <div>
          <SectionTitle>Form · letzte 5 Spiele</SectionTitle>
          <Box>
            {[a, b].map((t) => (
              <div key={t.team} className="flex items-center justify-between gap-2 py-1">
                <span className="min-w-0 break-words text-[13px] font-semibold text-ink">{teamName(t.team)}</span>
                <span className="flex gap-1">
                  {t.form.map((g) => (
                    <ResultChip key={g.date} r={gameResult(g, t.team)} />
                  ))}
                </span>
              </div>
            ))}
            <p className="mt-0.5 text-[11px] text-muted">S = Sieg, U = Unentschieden, N = Niederlage, neuestes zuerst</p>
            {[a, b].map((t) =>
              t.form.length > 0 ? (
                <details key={t.team} className="mt-2 border-t border-edge pt-2">
                  <summary className="cursor-pointer text-[12px] font-semibold text-muted">Spiele von {teamName(t.team)}</summary>
                  <div className="mt-1">
                    {t.form.map((g) => (
                      <GameLine key={g.date} g={g} team={t.team} teamName={teamName} />
                    ))}
                  </div>
                </details>
              ) : null,
            )}
          </Box>
        </div>
      )}

      {info.h2h.length > 0 && (
        <div>
          <SectionTitle>Direkter Vergleich · letzte {info.h2h.length}</SectionTitle>
          <Box>
            <div className="flex h-7 overflow-hidden rounded-md text-[13px] font-bold">
              {winsA > 0 && (
                <span className="flex items-center justify-center bg-gold text-pitch" style={{ flex: winsA }}>
                  {winsA}
                </span>
              )}
              {draws > 0 && (
                <span className="flex items-center justify-center bg-[#5b6a63] text-white" style={{ flex: draws }}>
                  {draws}
                </span>
              )}
              {winsB > 0 && (
                <span className="flex items-center justify-center bg-[#2563eb] text-white" style={{ flex: winsB }}>
                  {winsB}
                </span>
              )}
            </div>
            <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
              <span>Siege {nameA}</span>
              <span>Remis</span>
              <span className="text-right">Siege {nameB}</span>
            </div>
            <div className="mt-2 border-t border-edge pt-1">
              {info.h2h.map((g) => (
                <GameLine key={g.date} g={g} teamName={teamName} withYear />
              ))}
            </div>
          </Box>
        </div>
      )}
    </div>
  );
}
