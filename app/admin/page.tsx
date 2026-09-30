"use client";

import { useState, FormEvent } from "react";
import { useAppData, NewsItem } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useDuels } from "@/lib/DuelsContext";
import { useTournaments } from "@/lib/TournamentContext";
import { Tournament } from "@/lib/tournamentTypes";
import { getTournamentStatus } from "@/lib/tournamentLeaderboard";
import { Sport, SPORTS, JerseyStyle, JERSEY_STYLES, Match, MatchStatus, TipMode, Team } from "@/lib/types";
import { COUNTRIES, flagEmoji } from "@/lib/flags";
import TeamBadge from "@/components/TeamBadge";
import { useFeedback } from "@/lib/FeedbackContext";

// Einfacher Zugriffsschutz fürs MVP – KEINE echte Sicherheit.
// Sobald der richtige Login (Firebase Auth) steht, ersetzt der diese PIN
// durch eine echte Rechteprüfung (z. B. "ist dieser User Admin?").
const ADMIN_PIN = "1805";

type AdminTab = "spiele" | "teams" | "turniere" | "news";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  // "Spiele" ist bewusst der Start-Tab: das wird im Alltag am häufigsten
  // gebraucht und soll sofort sichtbar sein, ohne erst scrollen zu müssen.
  const [tab, setTab] = useState<AdminTab>("spiele");
  const { teams, matches, newsItems } = useAppData();
  const { tournaments } = useTournaments();

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  const tabs: { id: AdminTab; label: string; icon: string; count: number }[] = [
    { id: "spiele", label: "Spiele", icon: "⚽", count: matches.length },
    { id: "teams", label: "Teams", icon: "🛡️", count: teams.length },
    { id: "turniere", label: "Turniere", icon: "🏆", count: tournaments.length },
    { id: "news", label: "News", icon: "📰", count: newsItems.length },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:max-w-6xl">
      <h1 className="mb-1 font-display text-3xl font-bold text-ink">Admin-Bereich</h1>
      <p className="mb-6 text-sm text-muted">
        Teams, Spiele, Turniere und News anlegen. Änderungen gelten nur für diese
        Browser-Sitzung, solange Firestore noch nicht angebunden ist.
      </p>

      {/* Klar getrennte Bereiche statt alles untereinander gestapelt – ein
          Klick auf einen Reiter zeigt nur noch genau diesen Bereich, auf
          voller Breite. */}
      <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-2 rounded-card border px-4 py-3.5 font-display text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-surface text-muted hover:border-gold/40 hover:text-ink"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                tab === t.id ? "bg-gold/20 text-gold" : "bg-surface-hover text-muted"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div>
        {tab === "spiele" && <MatchManager />}
        {tab === "teams" && <TeamManager />}
        {tab === "turniere" && <TournamentManager />}
        {tab === "news" && <NewsManager />}
      </div>
    </main>
  );
}

function NewsManager() {
  const { newsItems, addNews, updateNews, removeNews } = useAppData();
  const { showToast } = useFeedback();
  const [text, setText] = useState("");
  const [sport, setSport] = useState<Sport | "">("");
  const [article, setArticle] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (!confirm(`Headline „${text.trim()}" veröffentlichen?`)) return;
    addNews(text.trim(), sport || null, article.trim() || null);
    setText("");
    setSport("");
    setArticle("");
    showToast("✓ Headline veröffentlicht.", "success");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">News-Ticker</h2>
      <p className="mb-3 text-xs text-muted">
        Die Headline läuft oben im Laufband durch. Tippt ein User sie an, öffnet sich der
        Artikeltext (falls vorhanden). Wählst du eine Sportart aus, wird deren Icon automatisch
        vor die Headline gesetzt.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Headline</label>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="z. B. Bayern gewinnt Topspiel 3:1"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Sportart (optional)</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport | "")}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">Allgemein (kein Icon)</option>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {sportIcon[s]} {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted">
            Artikeltext (optional – ohne bleibt die Headline beim Antippen ohne Detailansicht)
          </label>
          <textarea
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            rows={4}
            placeholder="Ausführlicher Text, der sich öffnet, wenn ein User auf die Headline tippt…"
            className="w-full resize-y rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>

        <button
          type="submit"
          className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Veröffentlichen
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {newsItems.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine News angelegt.</p>
        )}
        {newsItems.map((item, index) => (
          <NewsItemRow
            key={item.id}
            item={item}
            isLast={index === newsItems.length - 1}
            onSave={updateNews}
            onRemove={removeNews}
          />
        ))}
      </div>
    </section>
  );
}

function NewsItemRow({
  item,
  isLast,
  onSave,
  onRemove,
}: {
  item: NewsItem;
  isLast: boolean;
  onSave: (id: string, text: string, sport: Sport | null, article: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const { showToast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [sport, setSport] = useState<Sport | "">(item.sport ?? "");
  const [article, setArticle] = useState(item.article ?? "");

  function handleSave() {
    if (!text.trim()) return;
    if (!confirm("Änderungen an dieser Headline speichern?")) return;
    onSave(item.id, text.trim(), sport || null, article.trim() || null);
    setEditing(false);
    showToast("✓ Änderungen gespeichert.", "success");
  }

  function handleCancel() {
    setText(item.text);
    setSport(item.sport ?? "");
    setArticle(item.article ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={`flex flex-col gap-2 px-4 py-3 ${!isLast ? "border-b border-edge" : ""}`}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value as Sport | "")}
            className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            <option value="">Allgemein (kein Icon)</option>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {sportIcon[s]} {s}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={article}
          onChange={(e) => setArticle(e.target.value)}
          rows={4}
          placeholder="Artikeltext (optional)"
          className="w-full resize-y rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="rounded-full bg-action px-4 py-1.5 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Speichern
          </button>
          <button
            onClick={handleCancel}
            className="rounded-full border border-edge px-4 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 ${
        !isLast ? "border-b border-edge" : ""
      }`}
    >
      <span className="flex items-center gap-2 text-sm text-ink">
        {item.sport && <span>{sportIcon[item.sport]}</span>}
        {item.text}
        {item.article && (
          <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-muted">
            Artikel
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-gold">
          Bearbeiten
        </button>
        <button
          onClick={() => {
            if (confirm("Diese Headline wirklich entfernen?")) {
              onRemove(item.id);
              showToast("✓ Headline entfernt.", "info");
            }
          }}
          className="text-xs text-muted hover:text-ink"
        >
          Entfernen
        </button>
      </span>
    </div>
  );
}

const sportIcon: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-5 py-24 text-center">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Admin-Zugang</h1>
      <p className="mb-6 text-sm text-muted">Bitte PIN eingeben.</p>
      <form onSubmit={handleSubmit} className="w-full">
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          className="mb-3 w-full rounded-lg border border-edge bg-surface px-4 py-2.5 text-center font-display text-lg tracking-widest text-ink outline-none focus:border-gold"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-red-400">Falsche PIN.</p>}
        <button
          type="submit"
          className="w-full rounded-full bg-action py-2.5 font-display font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Entsperren
        </button>
      </form>
    </main>
  );
}

function TeamManager() {
  const { teams, addTeam, removeTeam } = useAppData();
  const { showToast } = useFeedback();
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("Fußball");
  const [countryCode, setCountryCode] = useState(COUNTRIES[0].code);
  const [primaryColor, setPrimaryColor] = useState("#3FA66B");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [jerseyStyle, setJerseyStyle] = useState<JerseyStyle>("solid");
  const [isNationalTeam, setIsNationalTeam] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!confirm(`Team "${name.trim()}" anlegen?`)) return;
    addTeam({
      name: name.trim(),
      sport,
      countryCode,
      primaryColor,
      secondaryColor,
      jerseyStyle,
      isNationalTeam,
    });
    setName("");
    showToast(`✓ Team "${name.trim()}" angelegt.`, "success");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Teams</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Teamname</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Kansas City Chiefs"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Sportart</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Land</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {flagEmoji(c.code)} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex w-fit items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={isNationalTeam}
            onChange={(e) => setIsNationalTeam(e.target.checked)}
            className="h-4 w-4 accent-action"
          />
          Nationalmannschaft (Icon zeigt automatisch die Landesflagge statt Trikot/Helm)
        </label>

        <div className="flex flex-wrap items-end gap-4">
          {!isNationalTeam && (
            <>
              <div>
                <label className="mb-1 block text-xs text-muted">
                  {sport === "NFL" ? "Helmfarbe" : "Trikotfarbe"}
                </label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-edge bg-pitch p-1"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">
                  {sport === "NFL" ? "Streifen-/Gitterfarbe" : "Kragen-/Saumfarbe"}
                </label>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-9 w-14 cursor-pointer rounded-lg border border-edge bg-pitch p-1"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-edge bg-pitch px-3 py-2">
            <TeamBadge
              sport={sport}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              jerseyStyle={jerseyStyle}
              isNationalTeam={isNationalTeam}
              countryCode={countryCode}
              size={32}
            />
            <span className="text-xs text-muted">Vorschau</span>
          </div>

          {!isNationalTeam && sport === "Fußball" && (
            <div>
              <label className="mb-1 block text-xs text-muted">Trikot-Stil</label>
              <select
                value={jerseyStyle}
                onChange={(e) => setJerseyStyle(e.target.value as JerseyStyle)}
                className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {JERSEY_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="ml-auto rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Team anlegen
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {teams.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Teams angelegt.</p>
        )}
        {teams.map((team, index) => (
          <div
            key={team.id}
            className={`flex flex-wrap items-center justify-between gap-y-1.5 px-4 py-3 ${
              index !== teams.length - 1 ? "border-b border-edge" : ""
            }`}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink">
              <TeamBadge
                sport={team.sport}
                primaryColor={team.primaryColor}
                secondaryColor={team.secondaryColor}
                jerseyStyle={team.jerseyStyle}
                isNationalTeam={team.isNationalTeam}
                countryCode={team.countryCode}
                size={28}
              />
              {!team.isNationalTeam && <span>{flagEmoji(team.countryCode)}</span>}
              <span className="font-medium">{team.name}</span>
              <span className="text-xs text-muted">
                · {team.sport}
                {team.isNationalTeam ? " · Nationalmannschaft" : ""}
              </span>
            </span>
            <button
              onClick={() => {
                if (confirm(`Team "${team.name}" wirklich entfernen?`)) {
                  removeTeam(team.id);
                  showToast(`✓ Team "${team.name}" entfernt.`, "info");
                }
              }}
              className="text-xs text-muted hover:text-ink"
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchManager() {
  const {
    teams,
    matches,
    addMatch,
    removeMatch,
    getTeam,
    updateMatchScore,
    updateMatchDetails,
    setSummaryVideo,
    setTvChannel,
    setTipMode,
    setBonusQuestion,
    setBonusQuestionAnswer,
  } = useAppData();
  const {
    evaluateMatchForCurrentUser,
    correctMatchEvaluationForCurrentUser,
    evaluateBonusAnswerForCurrentUser,
  } = useUser();
  const { resolveDuelsForMatch } = useDuels();
  const { showToast } = useFeedback();

  function handleBonusAnswer(matchId: string, correctOptionIndex: number) {
    setBonusQuestionAnswer(matchId, correctOptionIndex);
    evaluateBonusAnswerForCurrentUser(matchId);
  }

  // Sobald ein Spiel hier auf "Beendet" gesetzt wird, löst das direkt die
  // PoolScore-Auswertung des eigenen Tipps aus (Rangliste-Punkte, Sterne,
  // Prozent-Vergleich) – siehe UserContext.evaluateMatchForCurrentUser.
  // War das Spiel schon vorher "Beendet" und der Endstand wird jetzt nur
  // NACHTRÄGLICH korrigiert (z. B. Tippfehler beim ersten Eintragen), läuft
  // stattdessen die Korrektur-Variante: die macht die alte Punkte-/
  // Sterne-Gutschrift rückgängig, bevor sie die neue anwendet – sonst bliebe
  // entweder der falsche Stand stehen oder es würde doppelt gutgeschrieben.
  function handleScoreUpdate(
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
    status: MatchStatus
  ) {
    const match = matches.find((m) => m.id === matchId);
    const wasFinished = match?.status === "finished";
    const scoreChanged =
      homeScore !== match?.liveHomeScore || awayScore !== match?.liveAwayScore;
    updateMatchScore(matchId, homeScore, awayScore, status);
    if (status === "finished" && match && homeScore !== null && awayScore !== null) {
      if (!wasFinished) {
        evaluateMatchForCurrentUser(matchId, match.sport, homeScore, awayScore);
      } else if (scoreChanged) {
        correctMatchEvaluationForCurrentUser(matchId, match.sport, homeScore, awayScore);
      }
      // Löst auch offene Kopf-an-Kopf-Duelle zu diesem Spiel aus – tut
      // nichts, wenn es keine gibt oder sie schon ausgewertet sind.
      resolveDuelsForMatch(matchId, homeScore, awayScore);
    }
  }

  const [sport, setSport] = useState<Sport>("Fußball");
  const [competition, setCompetition] = useState("");
  const [matchday, setMatchday] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [tipDeadline, setTipDeadline] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [fixedStake, setFixedStake] = useState("20");
  const [tvChannel, setTvChannelInput] = useState("");
  const [tipMode, setTipModeInput] = useState<TipMode>("score");

  const teamsForSport = teams.filter((t) => t.sport === sport);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!competition.trim() || !kickoff || !tipDeadline || !homeTeamId || !awayTeamId) return;
    if (homeTeamId === awayTeamId) return;
    const stakeValue = Number(fixedStake);
    if (!stakeValue || stakeValue < 1) return;

    const homeName = getTeam(homeTeamId)?.name ?? "?";
    const awayName = getTeam(awayTeamId)?.name ?? "?";
    if (!confirm(`Spiel "${homeName} vs ${awayName}" (${competition.trim()}) anlegen?`)) return;

    addMatch({
      sport,
      competition: competition.trim(),
      matchday: matchday ? Number(matchday) : undefined,
      kickoff: new Date(kickoff).toISOString(),
      tipDeadline: new Date(tipDeadline).toISOString(),
      homeTeamId,
      awayTeamId,
      fixedStake: stakeValue,
      status: "upcoming",
      liveHomeScore: null,
      liveAwayScore: null,
      summaryVideoUrl: null,
      tvChannel: tvChannel.trim() || null,
      tipMode,
    });

    setCompetition("");
    setMatchday("");
    setKickoff("");
    setTipDeadline("");
    setHomeTeamId("");
    setAwayTeamId("");
    setFixedStake("20");
    setTvChannelInput("");
    setTipModeInput("score");
    showToast(`✓ Spiel "${homeName} vs ${awayName}" angelegt.`, "success");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Spiele</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Sportart</label>
            <select
              value={sport}
              onChange={(e) => {
                setSport(e.target.value as Sport);
                setHomeTeamId("");
                setAwayTeamId("");
              }}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Wettbewerb</label>
            <input
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="z. B. Bundesliga"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Spieltag (optional)</label>
            <input
              type="number"
              value={matchday}
              onChange={(e) => setMatchday(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Einsatz (Sterne, für alle User fest)</label>
            <input
              type="number"
              min={1}
              value={fixedStake}
              onChange={(e) => setFixedStake(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Heimteam</label>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">Auswählen…</option>
              {teamsForSport.map((t) => (
                <option key={t.id} value={t.id}>
                  {flagEmoji(t.countryCode)} {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Auswärtsteam</label>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">Auswählen…</option>
              {teamsForSport.map((t) => (
                <option key={t.id} value={t.id}>
                  {flagEmoji(t.countryCode)} {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Anpfiff</label>
            <input
              type="datetime-local"
              value={kickoff}
              onChange={(e) => {
                setKickoff(e.target.value);
                // Vorschlag: Tippschluss = Anpfiff, falls noch nicht gesetzt
                if (!tipDeadline) setTipDeadline(e.target.value);
              }}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Tippschluss (ab dann kein Tipp mehr möglich)</label>
            <input
              type="datetime-local"
              value={tipDeadline}
              onChange={(e) => setTipDeadline(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">TV-Sender (optional)</label>
            <input
              value={tvChannel}
              onChange={(e) => setTvChannelInput(e.target.value)}
              placeholder="z. B. Sky, DAZN, ORF1"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Tipp-Art</label>
            <select
              value={tipMode}
              onChange={(e) => setTipModeInput(e.target.value as TipMode)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="score">Ergebnis-Tipp (z. B. 2:1)</option>
              <option value="1x2">1X2 (Heimsieg / Unentschieden / Auswärtssieg)</option>
            </select>
          </div>
        </div>

        {teamsForSport.length < 2 && (
          <p className="text-xs text-muted">
            Für {sport} brauchst du zuerst mindestens zwei Teams (siehe oben).
          </p>
        )}

        <button
          type="submit"
          disabled={teamsForSport.length < 2}
          className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          Spiel anlegen
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {matches.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Spiele angelegt.</p>
        )}
        {matches.map((match, index) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          return (
            <div
              key={match.id}
              className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                index !== matches.length - 1 ? "border-b border-edge" : ""
              }`}
            >
              <span className="flex items-center gap-2 text-sm text-ink">
                {home && (
                  <TeamBadge
                    sport={home.sport}
                    primaryColor={home.primaryColor}
                    secondaryColor={home.secondaryColor}
                    jerseyStyle={home.jerseyStyle}
                    isNationalTeam={home.isNationalTeam}
                    countryCode={home.countryCode}
                    size={22}
                  />
                )}
                <span>
                  {match.competition}: {home?.name ?? "?"} vs {away?.name ?? "?"}
                </span>
                {away && (
                  <TeamBadge
                    sport={away.sport}
                    primaryColor={away.primaryColor}
                    secondaryColor={away.secondaryColor}
                    jerseyStyle={away.jerseyStyle}
                    isNationalTeam={away.isNationalTeam}
                    countryCode={away.countryCode}
                    flip
                    size={22}
                  />
                )}
                <span className="text-xs text-muted">
                  ({new Date(match.kickoff).toLocaleString("de-DE")}) · ⭐ {match.fixedStake}
                </span>
              </span>

              <div className="flex flex-wrap items-center gap-2">
                <MatchDetailsEditor match={match} teams={teams} onSave={updateMatchDetails} />
                <TipModeEditor match={match} onSave={setTipMode} />
                <LiveScoreEditor match={match} onUpdate={handleScoreUpdate} />
                <TvChannelEditor match={match} onSave={setTvChannel} />
                <VideoLinkEditor match={match} onSave={setSummaryVideo} />
                <BonusQuestionEditor match={match} onSave={setBonusQuestion} onSetAnswer={handleBonusAnswer} />
                <button
                  onClick={() => {
                    if (confirm(`Spiel "${home?.name ?? "?"} vs ${away?.name ?? "?"}" wirklich entfernen?`)) {
                      removeMatch(match.id);
                      showToast("✓ Spiel entfernt.", "info");
                    }
                  }}
                  className="text-xs text-muted hover:text-ink"
                >
                  Entfernen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Wandelt eine gespeicherte ISO-Zeit in das Format um, das
// <input type="datetime-local"> erwartet (lokale Zeit im Browser, ohne
// Zeitzone) – nötig, damit der Bearbeiten-Dialog mit dem bisherigen
// Anpfiff/Tippschluss vorausgefüllt ist statt leer zu starten.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

// Bearbeiten der Stammdaten eines bereits angelegten Spiels – vorher ließ
// sich ein Spiel nach dem Anlegen nur noch entfernen, nie mehr korrigieren
// (z. B. falscher Termin, Tippschluss in der Vergangenheit, Tippfehler bei
// den Teams).
function MatchDetailsEditor({
  match,
  teams,
  onSave,
}: {
  match: Match;
  teams: Team[];
  onSave: (
    matchId: string,
    updates: {
      competition: string;
      matchday?: number;
      kickoff: string;
      tipDeadline: string;
      homeTeamId: string;
      awayTeamId: string;
      fixedStake: number;
    }
  ) => void;
}) {
  const { showToast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [competition, setCompetition] = useState(match.competition);
  const [matchday, setMatchday] = useState(match.matchday ? String(match.matchday) : "");
  const [kickoff, setKickoff] = useState(() => toLocalInputValue(match.kickoff));
  const [tipDeadline, setTipDeadline] = useState(() => toLocalInputValue(match.tipDeadline));
  const [homeTeamId, setHomeTeamId] = useState(match.homeTeamId);
  const [awayTeamId, setAwayTeamId] = useState(match.awayTeamId);
  const [fixedStake, setFixedStake] = useState(String(match.fixedStake));

  const teamsForSport = teams.filter((t) => t.sport === match.sport);

  function handleSave() {
    if (!competition.trim() || !kickoff || !tipDeadline || !homeTeamId || !awayTeamId) return;
    if (homeTeamId === awayTeamId) return;
    const stakeValue = Number(fixedStake);
    if (!stakeValue || stakeValue < 1) return;
    if (!confirm("Spieldaten wirklich ändern?")) return;

    onSave(match.id, {
      competition: competition.trim(),
      matchday: matchday ? Number(matchday) : undefined,
      kickoff: new Date(kickoff).toISOString(),
      tipDeadline: new Date(tipDeadline).toISOString(),
      homeTeamId,
      awayTeamId,
      fixedStake: stakeValue,
    });
    setEditing(false);
    showToast("✓ Spieldaten gespeichert.", "success");
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setEditing((v) => !v)}
        className="rounded-lg bg-surface-hover px-2 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
      >
        Bearbeiten
      </button>

      {editing && (
        <div className="w-full rounded-lg border border-edge bg-pitch p-3">
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Wettbewerb</label>
              <input
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Spieltag (optional)</label>
              <input
                type="number"
                value={matchday}
                onChange={(e) => setMatchday(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Einsatz (Sterne)</label>
              <input
                type="number"
                min={1}
                value={fixedStake}
                onChange={(e) => setFixedStake(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Heimteam</label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              >
                {teamsForSport.map((t) => (
                  <option key={t.id} value={t.id}>
                    {flagEmoji(t.countryCode)} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Auswärtsteam</label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              >
                {teamsForSport.map((t) => (
                  <option key={t.id} value={t.id}>
                    {flagEmoji(t.countryCode)} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Anpfiff</label>
              <input
                type="datetime-local"
                value={kickoff}
                onChange={(e) => setKickoff(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Tippschluss</label>
              <input
                type="datetime-local"
                value={tipDeadline}
                onChange={(e) => setTipDeadline(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              Speichern
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-edge px-3 py-1 text-xs text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TipModeEditor({
  match,
  onSave,
}: {
  match: Match;
  onSave: (matchId: string, mode: TipMode) => void;
}) {
  const { showToast } = useFeedback();
  const [mode, setMode] = useState<TipMode>(match.tipMode);

  function handleSave() {
    if (mode === match.tipMode) return;
    if (!confirm("Tipp-Art für dieses Spiel wirklich ändern?")) return;
    onSave(match.id, mode);
    showToast("✓ Tipp-Art gespeichert.", "success");
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as TipMode)}
        className="rounded-lg border border-edge bg-pitch px-2 py-1 text-xs text-ink outline-none focus:border-gold"
        title="Tipp-Art für dieses Spiel"
      >
        <option value="score">Ergebnis-Tipp</option>
        <option value="1x2">1X2</option>
      </select>
      {mode !== match.tipMode && (
        <button
          onClick={handleSave}
          className="rounded-lg bg-surface-hover px-2 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
        >
          Speichern
        </button>
      )}
    </div>
  );
}

function TvChannelEditor({
  match,
  onSave,
}: {
  match: Match;
  onSave: (matchId: string, channel: string) => void;
}) {
  const { showToast } = useFeedback();
  const [channel, setChannel] = useState(match.tvChannel ?? "");

  function handleSave() {
    onSave(match.id, channel.trim());
    showToast("✓ TV-Sender gespeichert.", "success");
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
        placeholder="TV-Sender"
        className="w-32 rounded-lg border border-edge bg-pitch px-2 py-1 text-xs text-ink outline-none focus:border-gold"
      />
      <button
        onClick={handleSave}
        className="rounded-lg bg-surface-hover px-2 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
      >
        Speichern
      </button>
    </div>
  );
}

function VideoLinkEditor({
  match,
  onSave,
}: {
  match: Match;
  onSave: (matchId: string, url: string) => void;
}) {
  const { showToast } = useFeedback();
  const [url, setUrl] = useState(match.summaryVideoUrl ?? "");

  function handleSave() {
    onSave(match.id, url.trim());
    showToast("✓ Video-Link gespeichert.", "success");
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="YouTube-Link zur Zusammenfassung"
        className="w-48 rounded-lg border border-edge bg-pitch px-2 py-1 text-xs text-ink outline-none focus:border-gold"
      />
      <button
        onClick={handleSave}
        className="rounded-lg bg-surface-hover px-2 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
      >
        Speichern
      </button>
    </div>
  );
}

// Bonusfrage: Anlegen/Bearbeiten der Frage+Optionen UND separat das Setzen
// der richtigen Antwort (die steht oft erst nach Anlegen der Frage fest,
// manchmal schon vor Spielende) – deshalb zwei getrennte Aktionen in einem
// Editor statt in der Spiel-Anlegen-Form, wo der richtige Zeitpunkt für
// beides noch nicht feststeht.
function BonusQuestionEditor({
  match,
  onSave,
  onSetAnswer,
}: {
  match: Match;
  onSave: (matchId: string, question: string | null, options: string[], bonusStars: number) => void;
  onSetAnswer: (matchId: string, correctOptionIndex: number) => void;
}) {
  const { showToast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [question, setQuestionText] = useState(match.bonusQuestion?.question ?? "");
  const [optionsText, setOptionsText] = useState(match.bonusQuestion?.options.join(", ") ?? "");
  const [bonusStars, setBonusStars] = useState(String(match.bonusQuestion?.bonusStars ?? 10));
  const [answerIndex, setAnswerIndex] = useState(match.bonusQuestion?.correctOptionIndex ?? 0);

  function handleSave() {
    const options = optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (!question.trim() || options.length < 2) return;
    if (!confirm("Bonusfrage speichern?")) return;
    onSave(match.id, question.trim(), options, Math.max(1, Number(bonusStars) || 10));
    showToast("✓ Bonusfrage gespeichert.", "success");
  }

  function handleRemove() {
    if (!confirm("Bonusfrage wirklich entfernen?")) return;
    onSave(match.id, null, [], 0);
    setQuestionText("");
    setOptionsText("");
    setEditing(false);
    showToast("✓ Bonusfrage entfernt.", "info");
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setEditing((v) => !v)}
        className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
          match.bonusQuestion ? "bg-gold/15 text-gold" : "bg-surface-hover text-ink hover:text-gold"
        }`}
      >
        {match.bonusQuestion ? "Bonusfrage ✓" : "+ Bonusfrage"}
      </button>

      {editing && (
        <div className="w-full rounded-lg border border-edge bg-pitch p-3">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={question}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="z. B. Wer schießt das erste Tor?"
              className="flex-1 rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Optionen, mit Komma getrennt"
              className="flex-1 rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <input
              type="number"
              min={1}
              value={bonusStars}
              onChange={(e) => setBonusStars(e.target.value)}
              title="Sterne-Bonus bei richtiger Antwort"
              className="w-20 rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              Speichern
            </button>
            {match.bonusQuestion && (
              <button
                onClick={handleRemove}
                className="rounded-lg border border-edge px-3 py-1 text-xs text-muted transition-colors hover:text-red-400"
              >
                Entfernen
              </button>
            )}
          </div>

          {match.bonusQuestion && (
            <div className="mt-3 border-t border-edge pt-2">
              <p className="mb-1.5 text-xs text-muted">
                Richtige Antwort
                {match.bonusQuestion.correctOptionIndex !== null ? " (schon gesetzt, überschreiben?)" : " festlegen"}:
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={answerIndex}
                  onChange={(e) => setAnswerIndex(Number(e.target.value))}
                  className="rounded-lg border border-edge bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-gold"
                >
                  {match.bonusQuestion.options.map((opt, i) => (
                    <option key={i} value={i}>
                      {opt}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!confirm("Richtige Antwort jetzt festlegen? Das wertet die Tipps aller User aus.")) return;
                    onSetAnswer(match.id, answerIndex);
                    showToast("✓ Richtige Antwort gespeichert – Tipps ausgewertet.", "gold");
                  }}
                  className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
                >
                  Übernehmen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveScoreEditor({
  match,
  onUpdate,
}: {
  match: Match;
  onUpdate: (matchId: string, homeScore: number | null, awayScore: number | null, status: MatchStatus) => void;
}) {
  const { showToast } = useFeedback();
  const [homeScore, setHomeScore] = useState(match.liveHomeScore ?? 0);
  const [awayScore, setAwayScore] = useState(match.liveAwayScore ?? 0);
  const [status, setStatus] = useState<MatchStatus>(match.status);

  function handleUpdate() {
    // Endstand setzen/korrigieren wertet direkt die Tipps ALLER User aus
    // (siehe MatchManager.handleScoreUpdate) – folgenreich genug, um aktiv
    // nachzufragen. Ein reiner Live-Spielstand (noch nicht "Beendet") wird
    // oft mehrmals während eines Spiels aktualisiert und bleibt deshalb
    // bewusst ohne Bestätigungs-Dialog – nur die kurze Rückmeldung danach.
    if (status === "finished") {
      const verb = match.status === "finished" ? "korrigieren" : "festlegen";
      if (!confirm(`Endstand ${homeScore}:${awayScore} ${verb} und Tipps auswerten?`)) return;
      onUpdate(match.id, homeScore, awayScore, status);
      showToast("✓ Endstand gespeichert – Tipps wurden ausgewertet.", "gold");
    } else {
      onUpdate(match.id, homeScore, awayScore, status);
      showToast("✓ Spielstand aktualisiert.", "success");
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as MatchStatus)}
        className="rounded-lg border border-edge bg-pitch px-2 py-1 text-xs text-ink outline-none focus:border-gold"
      >
        <option value="upcoming">Bevorstehend</option>
        <option value="live">Live</option>
        <option value="finished">Beendet</option>
      </select>
      <input
        type="number"
        min={0}
        value={homeScore}
        onChange={(e) => setHomeScore(Number(e.target.value))}
        className="w-12 rounded-lg border border-edge bg-pitch px-1.5 py-1 text-center text-xs text-ink outline-none focus:border-gold"
      />
      <span className="text-xs text-muted">:</span>
      <input
        type="number"
        min={0}
        value={awayScore}
        onChange={(e) => setAwayScore(Number(e.target.value))}
        className="w-12 rounded-lg border border-edge bg-pitch px-1.5 py-1 text-center text-xs text-ink outline-none focus:border-gold"
      />
      <button
        onClick={handleUpdate}
        title={
          match.status === "finished"
            ? "Endstand erneut übernehmen korrigiert die bereits vergebenen Rangpunkte/Sterne."
            : undefined
        }
        className="rounded-lg bg-action px-2 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
      >
        {match.status === "finished" ? "Korrigieren" : "OK"}
      </button>
    </div>
  );
}

// Wandelt einen ISO-Zeitstempel in den String um, den ein
// datetime-local-Input als value erwartet (lokale Zeit, ohne Offset).
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

const tournamentStatusLabel: Record<ReturnType<typeof getTournamentStatus>, string> = {
  aktiv: "Aktiv",
  kommend: "Kommend",
  beendet: "Beendet",
};

const tournamentStatusClass: Record<ReturnType<typeof getTournamentStatus>, string> = {
  aktiv: "border-gold bg-gold/15 text-gold",
  kommend: "border-blue-400/60 bg-blue-400/10 text-blue-300",
  beendet: "border-edge bg-surface-hover text-muted",
};

function TournamentManager() {
  const { tournaments, createTournament, updateTournament, setTournamentMatches, removeTournament } =
    useTournaments();
  const { matches, getTeam } = useAppData();
  const { showToast } = useFeedback();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🏆");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    if (!confirm(`Turnier "${name.trim()}" anlegen?`)) return;
    createTournament(name.trim(), description.trim(), icon.trim() || "🏆", new Date(startDate).toISOString(), new Date(endDate).toISOString());
    setName("");
    setDescription("");
    setIcon("🏆");
    setStartDate("");
    setEndDate("");
    showToast(`✓ Turnier "${name.trim()}" angelegt.`, "success");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Turniere</h2>
      <p className="mb-3 text-xs text-muted">
        Zeitlich begrenzter Sonder-Bereich (z. B. WM, EM), der eine Auswahl bestehender Spiele
        bündelt und eine eigene, öffentliche Mini-Rangliste zeigt. Spiele werden unten je Turnier
        einzeln zugeordnet.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Weltmeisterschaft 2026"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Icon (Emoji)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🏆"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Start</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs text-muted">Beschreibung (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurzer Hinweis, worum es bei diesem Turnier geht"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Ende</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
        </div>
        <button
          type="submit"
          className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Turnier anlegen
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {tournaments.length === 0 && (
          <p className="rounded-card border border-dashed border-edge bg-surface p-4 text-center text-sm text-muted">
            Noch keine Turniere angelegt.
          </p>
        )}
        {tournaments.map((tournament) => (
          <TournamentRow
            key={tournament.id}
            tournament={tournament}
            allMatches={matches}
            getTeam={getTeam}
            onSave={updateTournament}
            onSetMatches={setTournamentMatches}
            onRemove={removeTournament}
          />
        ))}
      </div>
    </section>
  );
}

function TournamentRow({
  tournament,
  allMatches,
  getTeam,
  onSave,
  onSetMatches,
  onRemove,
}: {
  tournament: Tournament;
  allMatches: Match[];
  getTeam: (id: string) => Team | undefined;
  onSave: (id: string, name: string, description: string, icon: string, startDate: string, endDate: string) => void;
  onSetMatches: (id: string, matchIds: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const { showToast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [pickingMatches, setPickingMatches] = useState(false);
  const [name, setName] = useState(tournament.name);
  const [description, setDescription] = useState(tournament.description);
  const [icon, setIcon] = useState(tournament.icon);
  const [startDate, setStartDate] = useState(toDatetimeLocalValue(tournament.startDate));
  const [endDate, setEndDate] = useState(toDatetimeLocalValue(tournament.endDate));

  const status = getTournamentStatus(tournament);

  function handleSave() {
    if (!name.trim() || !startDate || !endDate) return;
    if (!confirm("Änderungen an diesem Turnier speichern?")) return;
    onSave(tournament.id, name.trim(), description.trim(), icon.trim() || "🏆", new Date(startDate).toISOString(), new Date(endDate).toISOString());
    setEditing(false);
    showToast("✓ Turnier gespeichert.", "success");
  }

  function handleCancel() {
    setName(tournament.name);
    setDescription(tournament.description);
    setIcon(tournament.icon);
    setStartDate(toDatetimeLocalValue(tournament.startDate));
    setEndDate(toDatetimeLocalValue(tournament.endDate));
    setEditing(false);
  }

  function toggleMatch(matchId: string) {
    const current = tournament.matchIds;
    const next = current.includes(matchId)
      ? current.filter((id) => id !== matchId)
      : [...current, matchId];
    onSetMatches(tournament.id, next);
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-edge bg-pitch px-2 py-1.5 text-xs text-ink outline-none focus:border-gold sm:col-span-2"
            />
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="rounded-lg border border-edge bg-pitch px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-edge bg-pitch px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-edge bg-pitch px-2 py-1.5 text-xs text-ink outline-none focus:border-gold sm:col-span-3"
            />
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-edge bg-pitch px-2 py-1.5 text-xs text-ink outline-none focus:border-gold"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              Speichern
            </button>
            <button onClick={handleCancel} className="rounded-lg border border-edge px-3 py-1 text-xs text-muted hover:text-ink">
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-lg">{tournament.icon}</span>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold text-ink">{tournament.name}</p>
              {tournament.description && (
                <p className="truncate text-xs text-muted">{tournament.description}</p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tournamentStatusClass[status]}`}
            >
              {tournamentStatusLabel[status]}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setPickingMatches((v) => !v)}
              className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                pickingMatches ? "bg-gold/15 text-gold" : "bg-surface-hover text-ink hover:text-gold"
              }`}
            >
              Spiele ({tournament.matchIds.length})
            </button>
            <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-gold">
              Bearbeiten
            </button>
            <button
              onClick={() => {
                if (confirm(`Turnier "${tournament.name}" wirklich löschen?`)) {
                  onRemove(tournament.id);
                  showToast("✓ Turnier gelöscht.", "info");
                }
              }}
              className="text-xs text-muted hover:text-red-400"
            >
              Löschen
            </button>
          </div>
        </div>
      )}

      {pickingMatches && !editing && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-edge bg-pitch p-2">
          {allMatches.length === 0 && (
            <p className="p-2 text-xs text-muted">Noch keine Spiele angelegt.</p>
          )}
          {allMatches.map((match) => {
            const home = getTeam(match.homeTeamId);
            const away = getTeam(match.awayTeamId);
            const checked = tournament.matchIds.includes(match.id);
            return (
              <label
                key={match.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-ink hover:bg-surface-hover"
              >
                <input type="checkbox" checked={checked} onChange={() => toggleMatch(match.id)} />
                <span>{sportIcon[match.sport]}</span>
                <span className="min-w-0 flex-1 truncate">
                  {home?.name ?? "?"} vs {away?.name ?? "?"}
                </span>
                <span className="shrink-0 text-muted">{new Date(match.kickoff).toLocaleDateString("de-DE")}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
