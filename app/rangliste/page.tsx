"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FitText from "@/components/FitText";
import { SPORTS, Sport } from "@/lib/types";
import { getChosenIconForPoints, getSportRankIcon, RankIconOption } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";
import ClubLeaderboard from "@/components/ClubLeaderboard";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { getCurrentWeekWindow, sumWeeklyRangDelta } from "@/lib/weeklyLeaderboard";
import { GlobalPlayer, sumPoints, useGlobalLeaderboard } from "@/lib/globalLeaderboard";

const sportIcon: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

type ViewTab = "Gesamt" | "Spieltag" | "Vereine" | Sport;

const TABS: ViewTab[] = ["Gesamt", "Spieltag", ...SPORTS, "Vereine"];

// Ab so vielen Spielern wird nur die Spitze gezeigt (plus die eigene Zeile,
// falls man weiter hinten steht), damit die Seite nicht endlos lang wird.
const MAX_ROWS = 100;

interface RowEntry {
  id: string;
  rank: number;
  name: string;
  points: number;
  icon: RankIconOption | null;
  isCurrentUser: boolean;
}

export default function RanglistePage() {
  const [tab, setTab] = useState<ViewTab>("Gesamt");
  const { rangPunkte, displayName, authUserId, profileLoaded, selectedRankIconId } = useUser();
  const { myTips } = useAppData();

  // Spieltags-Rangliste: nur die Rangpunkte-Änderung aus dieser Kalenderwoche
  // zählt, mit Countdown bis zum Reset – siehe lib/weeklyLeaderboard.ts.
  // useMemo, damit das Zeitfenster nicht bei jedem Rendern neu entsteht und
  // die Daten nicht ständig neu geladen werden.
  const weekWindow = useMemo(() => getCurrentWeekWindow(), []);
  const { players, weeklyByUser, loading, failed, error, retry } = useGlobalLeaderboard(weekWindow);

  // Echte Spieler aus der Datenbank. Die eigene Zeile wird mit den Live-
  // Werten aus dem Browser überschrieben (Name + Punkte), damit man nach
  // einer Auswertung oder Namensänderung sofort den aktuellen Stand sieht,
  // auch bevor die Datenbank ihn zurückliefert.
  const allPlayers: GlobalPlayer[] = useMemo(() => {
    // Vor dem Laden des eigenen Profils sind Name/Punkte im Browser noch
    // Startwerte – dann lieber den Datenbank-Stand zeigen.
    if (!authUserId || !profileLoaded) return players;
    const me: GlobalPlayer = {
      id: authUserId,
      name: displayName,
      pointsBySport: { ...rangPunkte },
      total: sumPoints(rangPunkte),
      rankIconId: selectedRankIconId,
    };
    const others = players.filter((p) => p.id !== authUserId);
    return [...others, me];
  }, [players, authUserId, profileLoaded, displayName, rangPunkte, selectedRankIconId]);

  const ranked: RowEntry[] = useMemo(() => {
    let rows: Omit<RowEntry, "rank">[];
    if (tab === "Spieltag") {
      rows = allPlayers
        .filter((p) => weeklyByUser.has(p.id) || p.id === authUserId)
        .map((p) => ({
          id: p.id,
          name: p.name,
          points: p.id === authUserId ? sumWeeklyRangDelta(myTips, weekWindow) : weeklyByUser.get(p.id) ?? 0,
          icon: getChosenIconForPoints(p.pointsBySport, p.rankIconId, `-${p.id}`),
          isCurrentUser: p.id === authUserId,
        }));
    } else if (tab === "Gesamt") {
      rows = allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.total,
        icon: getChosenIconForPoints(p.pointsBySport, p.rankIconId, `-${p.id}`),
        isCurrentUser: p.id === authUserId,
      }));
    } else if (tab === "Vereine") {
      rows = [];
    } else {
      const sport = tab;
      rows = allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        points: p.pointsBySport[sport],
        icon: getSportRankIcon(sport, p.pointsBySport[sport], `-${p.id}`),
        isCurrentUser: p.id === authUserId,
      }));
    }
    // Gleichstand: alphabetisch, damit die Reihenfolge stabil bleibt.
    // Gleiche Punkte bekommen den gleichen Platz (1, 2, 2, 4 …).
    const sorted = rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "de"));
    let lastPoints: number | null = null;
    let lastRank = 0;
    return sorted.map((row, index) => {
      const rank = row.points === lastPoints ? lastRank : index + 1;
      lastPoints = row.points;
      lastRank = rank;
      return { ...row, rank };
    });
  }, [tab, allPlayers, weeklyByUser, authUserId, myTips, weekWindow]);

  const entries: RowEntry[] = useMemo(() => {
    if (ranked.length <= MAX_ROWS) return ranked;
    const top = ranked.slice(0, MAX_ROWS);
    const me = ranked.find((r) => r.isCurrentUser);
    return me && !top.includes(me) ? [...top, me] : top;
  }, [ranked]);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-4xl px-5 py-8">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Rangliste</h1>
        {tab === "Spieltag" ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            Zählt nur Punkte dieser Woche · <WeeklyCountdown target={weekWindow.end.getTime()} />
          </p>
        ) : tab === "Vereine" ? (
          <p className="mt-0.5 text-xs text-muted">Herzensvereine im Vergleich, eine Tabelle pro Sportart</p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted">
              {loading ? "Lädt…" : failed ? "\u00a0" : `${ranked.length} Spieler`}
            </p>
            <p className="mt-1 text-xs text-muted">
              Je weiter oben du stehst, desto weniger Bonus gibt ein Sieg und desto mehr kostet eine Niederlage.
            </p>
          </>
        )}
      </div>

      {/* Tab-Umschalter: Gesamt + Spieltag + je Sportart */}
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-surface text-muted hover:text-ink"
            }`}
          >
            {t === "Spieltag" && <span aria-hidden>⏱️</span>}
            {t === "Vereine" && <span aria-hidden>🛡️</span>}
            {t !== "Gesamt" && t !== "Spieltag" && t !== "Vereine" && <span>{sportIcon[t as Sport]}</span>}
            {t}
          </button>
        ))}
      </div>

      {tab === "Vereine" ? (
        <ClubLeaderboard />
      ) : loading ? (
        <LoadingRows />
      ) : failed ? (
        <EmptyState
          title="Rangliste gerade nicht erreichbar"
          text="Die Daten konnten nicht geladen werden. Bitte versuch es gleich noch einmal."
          detail={error ?? undefined}
          onRetry={retry}
        />
      ) : entries.length === 0 ? (
        tab === "Spieltag" ? (
          <EmptyState
            title="Diese Woche noch keine Punkte"
            text="Sobald die ersten Tipps dieser Woche ausgewertet sind, erscheint hier die Wochen-Rangliste."
            showTipLink
          />
        ) : (
          <EmptyState
            title="Noch keine Spieler in der Rangliste"
            text="Registriere dich, gib deine ersten Tipps ab und sei der Erste ganz oben."
            showRegisterLink={!authUserId}
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-card border border-edge bg-surface">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between px-3 py-4 sm:px-5 ${
                  index !== entries.length - 1 ? "border-b border-edge" : ""
                } ${entry.isCurrentUser ? "bg-surface-hover" : podiumRowClass(entry.rank)}`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <RankNumber rank={entry.rank} />
                  <NameAvatar name={entry.name} rank={entry.rank} />
                  <RankBadge option={entry.icon} size="sm" />
                  {entry.isCurrentUser ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <FitText
                        text={entry.name}
                        className="font-display text-base font-semibold leading-tight text-gold"
                      />
                      <span className="shrink-0 text-xs font-medium text-muted">(Du)</span>
                    </span>
                  ) : (
                    <Link
                      href={`/spieler/${encodeURIComponent(entry.name)}`}
                      className="min-w-0 flex-1 font-display text-base font-semibold leading-tight text-ink transition-colors hover:text-gold"
                    >
                      <FitText text={entry.name} />
                    </Link>
                  )}
                </div>
                <span className="ml-2 shrink-0 font-display text-base font-semibold text-ink">
                  {entry.points.toLocaleString("de-DE")}
                </span>
              </div>
            ))}
          </div>
          {tab !== "Spieltag" && ranked.length < 5 && <FewPlayersHint />}
        </>
      )}
    </main>
  );
}

function LoadingRows() {
  return (
    <div className="overflow-hidden rounded-card border border-edge bg-surface" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`flex items-center gap-3 px-5 py-4 ${i !== 2 ? "border-b border-edge" : ""}`}>
          <span className="h-7 w-7 animate-pulse rounded-full bg-surface-hover" />
          <span className="h-9 w-9 animate-pulse rounded-full bg-surface-hover" />
          <span className="h-4 w-32 animate-pulse rounded bg-surface-hover" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  text,
  showRegisterLink,
  showTipLink,
  detail,
  onRetry,
}: {
  title: string;
  text: string;
  showRegisterLink?: boolean;
  showTipLink?: boolean;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-card border border-edge bg-surface px-6 py-10 text-center">
      <p className="mb-2 text-3xl" aria-hidden>
        🏆
      </p>
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mb-5 max-w-sm text-sm text-muted">{text}</p>
      {showRegisterLink && (
        <Link
          href="/registrieren?modus=registrieren"
          className="inline-block rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Jetzt registrieren
        </Link>
      )}
      {showTipLink && (
        <Link
          href="/"
          className="inline-block rounded-full border border-gold px-5 py-2 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch"
        >
          Zu den Spielen
        </Link>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-block rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Nochmal versuchen
        </button>
      )}
      {detail && <p className="mx-auto mt-4 max-w-sm break-words text-[11px] text-muted/70">Technische Info: {detail}</p>}
    </div>
  );
}

// Solange erst wenige Leute mitspielen, wirkt die Liste leer – ein kurzer
// Hinweis mit Einladen-Knopf statt erfundener Mitspieler.
function FewPlayersHint() {
  const [copied, setCopied] = useState(false);

  async function invite() {
    const url = window.location.origin;
    const text = "Tipp mit mir auf PoolTipp, mal sehen wer in der Rangliste vorne liegt!";
    if ("share" in navigator) {
      try {
        await navigator.share({ title: "PoolTipp", text, url });
        return;
      } catch {
        // abgebrochen oder nicht verfügbar -> Link kopieren
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage nicht verfügbar – ignorieren
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3 rounded-card border border-dashed border-edge px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
      <p className="text-sm text-muted">Noch ist hier wenig los. Lade Freunde ein, dann wird es spannend.</p>
      <button
        onClick={invite}
        className="shrink-0 rounded-full border border-gold px-4 py-2 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch"
      >
        {copied ? "Link kopiert ✓" : "Freunde einladen"}
      </button>
    </div>
  );
}

function RankNumber({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center font-display text-sm text-muted">
      {medal ?? rank}
    </span>
  );
}

// Dezente Podium-Färbung für die ersten drei Plätze, damit sie auf einen
// Blick auffallen, statt sich nur durch die Medaille zu unterscheiden.
function podiumRowClass(rank: number): string {
  if (rank === 1) return "bg-gold/[0.06]";
  if (rank === 2) return "bg-ink/[0.03]";
  if (rank === 3) return "bg-[#CD7F32]/[0.06]";
  return "";
}

const PODIUM_RING: Record<number, string> = {
  1: "ring-2 ring-gold",
  2: "ring-2 ring-muted/60",
  3: "ring-2 ring-[#CD7F32]/70",
};

// Countdown bis zum wöchentlichen Reset der Spieltags-Rangliste (Montag
// 00:00). Eigene, kleine Komponente statt components/Countdown.tsx, weil
// deren Text ("noch 3 Std. …", "Tipps geschlossen") auf Tipp-Fristen
// zugeschnitten ist, nicht auf einen Ranglisten-Reset.
function WeeklyCountdown({ target }: { target: number }) {
  // null statt sofort Date.now() zu verrechnen: vermeidet einen Hydration-
  // Fehler, weil Server und Browser nie exakt dieselbe Uhrzeit haben (siehe
  // components/Countdown.tsx für die ausführliche Erklärung).
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(target - Date.now());
    const interval = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining === null) return <span className="opacity-0">&nbsp;</span>;
  if (remaining <= 0) return <span>wird gerade zurückgesetzt…</span>;
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return <span>endet in {days}T {hours}h</span>;
  if (hours > 0) return <span>endet in {hours}h {minutes}m</span>;
  return <span>endet in {minutes}m</span>;
}

function NameAvatar({ name, rank }: { name: string; rank: number }) {
  const ring = PODIUM_RING[rank] ?? "";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-xs font-semibold text-muted ${ring}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
