"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useAppData, NewsItem } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useTournaments } from "@/lib/TournamentContext";
import { Tournament } from "@/lib/tournamentTypes";
import { getTournamentStatus } from "@/lib/tournamentLeaderboard";
import { Sport, SPORTS, NewsSport, JerseyStyle, JERSEY_STYLES, Match, MatchJersey, MatchStatus, TipMode, Team, SPORT_ICONS, sportLabel } from "@/lib/types";
import { DEFAULT_COUNTRY_CODE, flagEmoji } from "@/lib/flags";
import CountryPicker from "@/components/CountryPicker";
import NewsSportIcon, { NewsSportPicker } from "@/components/NewsSportIcon";
import TeamPicker from "@/components/TeamPicker";
import TeamBadge, { helmetLogoColor, jerseyFor, matchJerseyProps, teamColorProps } from "@/components/TeamBadge";
import JerseyPicker from "@/components/JerseyPicker";
import { useFeedback } from "@/lib/FeedbackContext";
import { findDuplicateTeam } from "@/lib/teamName";
import ScoreInput from "@/components/ScoreInput";
import { competitionsForSport, findDuplicateCompetition } from "@/lib/competitions";
import { displayOrder, isAwayFirst, matchTitle, scoreText } from "@/lib/teamOrder";
import { BOOSTER_STAKE, BOOSTERS_PER_DAY } from "@/lib/poolScore";
import { boostersOnDay } from "@/lib/booster";
import { useJokers } from "@/lib/JokerContext";
import { DuelReport } from "@/components/DuelReport";

type AdminTab = "spiele" | "wettbewerbe" | "teams" | "turniere" | "news";

// Zugang nur für den eingeloggten Admin-Account – geprüft über die
// Datenbank-Funktion is_admin() (siehe isAdmin in lib/UserContext.tsx).
// Das ist nur die Anzeige: das eigentliche Speichern von Spielen, Teams,
// News und Turnieren erlaubt die Datenbank selbst ebenfalls nur dem Admin
// (Row Level Security mit is_admin(), siehe supabase/social-features.sql).
export default function AdminPage() {
  const { isAdmin, adminChecked, isRegistered } = useUser();
  // "Spiele" ist bewusst der Start-Tab: das wird im Alltag am häufigsten
  // gebraucht und soll sofort sichtbar sein, ohne erst scrollen zu müssen.
  const [tab, setTab] = useState<AdminTab>("spiele");
  const { teams, matches, newsItems, competitions } = useAppData();
  const { tournaments } = useTournaments();

  if (!adminChecked) {
    return (
      <main className="mx-auto max-w-sm px-5 py-24 text-center">
        <p className="text-sm text-muted">Zugang wird geprüft…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return <NoAccess loggedIn={isRegistered} />;
  }

  const tabs: { id: AdminTab; label: string; icon: string; count: number }[] = [
    { id: "spiele", label: "Spiele", icon: "⚽", count: matches.length },
    { id: "wettbewerbe", label: "Wettbewerbe", icon: "🏅", count: competitions.length },
    { id: "teams", label: "Teams", icon: "🛡️", count: teams.length },
    { id: "turniere", label: "Turniere", icon: "🏆", count: tournaments.length },
    { id: "news", label: "News", icon: "📰", count: newsItems.length },
  ];

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:max-w-6xl">
      <h1 className="mb-1 font-display text-3xl font-bold text-ink sm:text-4xl">Admin-Bereich</h1>
      <p className="mb-7 text-sm text-muted">
        Spiele, Wettbewerbe, Teams, Turniere und News anlegen. Änderungen werden gespeichert und
        sind sofort für alle sichtbar.
      </p>

      <ShopSwitch />

      <DuelReport />

      {/* Vorschau der Spieler-Seiten fürs Dranbleiben: ändern nichts. */}
      <div className="-mt-4 mb-7 flex flex-col gap-3 rounded-card border border-edge bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink">👀 Vorschau für Spieler</p>
          <p className="text-sm text-muted">So sehen Spieler den Start nach der Registrierung und ihren Wochenrückblick.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/start?vorschau=1"
            className="rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            Start-Erlebnis
          </Link>
          <Link
            href="/rueckblick"
            className="rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            Wochenrückblick
          </Link>
        </div>
      </div>

      {/* Klar getrennte Bereiche statt alles untereinander gestapelt – ein
          Klick auf einen Reiter zeigt nur noch genau diesen Bereich, auf
          voller Breite. Bewusst groß und mit Zahl, damit auf einen Blick klar
          ist, wo man ist und wie viel schon angelegt wurde. */}
      <div className="mb-9 grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`${
              // 5 Reiter: am Handy nimmt der letzte die ganze Zeile, statt allein halb leer zu stehen
              i === tabs.length - 1 ? "col-span-2 md:col-span-1" : ""
            } flex flex-col items-center justify-center gap-1 rounded-card border px-4 py-5 font-display transition-colors ${
              tab === t.id
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-surface text-muted hover:border-gold/40 hover:text-ink"
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className="text-base font-semibold">{t.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
        {tab === "wettbewerbe" && <CompetitionManager />}
        {tab === "teams" && <TeamManager />}
        {tab === "turniere" && <TournamentManager />}
        {tab === "news" && <NewsManager />}
      </div>
    </main>
  );
}

// Schalter für den Joker-Shop (supabase/joker-shop.sql): erst wenn er an ist,
// können alle Spieler Joker kaufen. Der Admin kann vorher schon testen.
function ShopSwitch() {
  const { ready, shopOpen, setShopOpen } = useJokers();
  const { showToast } = useFeedback();
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function toggle() {
    if (!shopOpen && !confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    const failed = await setShopOpen(!shopOpen);
    setSaving(false);
    setConfirming(false);
    if (failed) showToast(`✗ ${failed}`, "info");
    else showToast(shopOpen ? "✓ Joker-Shop wieder gesperrt." : "✓ Joker-Shop freigegeben – alle können jetzt kaufen.", "success");
  }

  return (
    <div className="mb-7 flex flex-col gap-3 rounded-card border border-edge bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-display text-base font-semibold text-ink">🛒 Joker-Shop</p>
        <p className="text-sm text-muted">
          {!ready
            ? "Noch nicht eingerichtet: zuerst supabase/joker-shop.sql ausführen."
            : shopOpen
              ? "Freigegeben: alle Spieler können Joker mit Coins kaufen."
              : confirming
                ? "Wirklich freigeben? Danach können alle Spieler Joker kaufen."
                : "Gesperrt: nur du kannst schon testen, alle anderen sehen \u201eBald verfügbar\u201c."}
        </p>
      </div>
      {ready && (
        <div className="flex shrink-0 items-center gap-2">
          {confirming && (
            <button
              onClick={() => setConfirming(false)}
              className="rounded-full px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
          )}
          <button
            onClick={toggle}
            disabled={saving}
            className={`rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors disabled:cursor-wait ${
              shopOpen
                ? "border border-edge bg-pitch text-ink hover:border-gold/40"
                : "bg-action text-pitch hover:bg-action-hover"
            }`}
          >
            {saving ? "Wird gespeichert…" : shopOpen ? "Wieder sperren" : confirming ? "Ja, freigeben" : "Kaufen freigeben"}
          </button>
        </div>
      )}
    </div>
  );
}

function NewsManager() {
  const { newsItems, addNews, updateNews, removeNews } = useAppData();
  const { showToast } = useFeedback();
  const [text, setText] = useState("");
  const [sport, setSport] = useState<NewsSport | "">("");
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
      <h2 className="mb-1 font-display text-2xl font-semibold text-ink">News-Ticker</h2>
      <p className="mb-4 text-sm text-muted">
        Die Headline läuft oben im Laufband durch. Tippt ein User sie an, öffnet sich der
        Artikeltext (falls vorhanden). Wählst du eine Sportart aus, wird deren Icon automatisch
        vor die Headline gesetzt.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-4 rounded-card border border-edge bg-surface p-5 sm:p-6"
      >
        <h3 className="font-display text-base font-semibold text-ink">Neue Headline</h3>

        <div>
          <label className="mb-1.5 block text-sm text-muted">Headline</label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="z. B. Bayern gewinnt Topspiel 3:1"
            className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-muted">
            Sportart (optional – „Allgemein“ zeigt kein Icon)
          </label>
          <NewsSportPicker value={sport} onChange={setSport} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-muted">
            Artikeltext (optional – ohne bleibt die Headline beim Antippen ohne Detailansicht)
          </label>
          <textarea
            value={article}
            onChange={(e) => setArticle(e.target.value)}
            rows={4}
            placeholder="Ausführlicher Text, der sich öffnet, wenn ein User auf die Headline tippt…"
            className="w-full resize-y rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
          />
        </div>

        <button
          type="submit"
          className="self-start rounded-full bg-action px-6 py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Veröffentlichen
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {newsItems.length === 0 && (
          <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
            Noch keine News angelegt.
          </p>
        )}
        {newsItems.map((item) => (
          <NewsItemRow key={item.id} item={item} onSave={updateNews} onRemove={removeNews} />
        ))}
      </div>
    </section>
  );
}

function NewsItemRow({
  item,
  onSave,
  onRemove,
}: {
  item: NewsItem;
  onSave: (id: string, text: string, sport: NewsSport | null, article: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const { showToast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [sport, setSport] = useState<NewsSport | "">(item.sport ?? "");
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
      <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:p-5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
        />
        <NewsSportPicker value={sport} onChange={setSport} small />
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
    <div className="flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4 sm:p-5">
      <span className="flex items-center gap-2 text-sm text-ink">
        {item.sport && <span className="text-base"><NewsSportIcon sport={item.sport} /></span>}
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

const sportIcon: Record<string, string> = SPORT_ICONS;

const matchStatusLabel: Record<MatchStatus, string> = {
  upcoming: "Bevorstehend",
  live: "Live",
  finished: "Beendet",
  cancelled: "Abgesagt",
};

const matchStatusClass: Record<MatchStatus, string> = {
  upcoming: "border-edge bg-surface-hover text-muted",
  live: "border-red-400/60 bg-red-400/10 text-red-300",
  finished: "border-gold bg-gold/15 text-gold",
  cancelled: "border-red-400/60 bg-red-400/10 text-red-300",
};

function NoAccess({ loggedIn }: { loggedIn: boolean }) {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-5 py-24 text-center">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Kein Zugriff</h1>
      <p className="mb-6 text-sm text-muted">
        {loggedIn
          ? "Dieser Bereich ist nur für Admins."
          : "Dieser Bereich ist nur für Admins. Bitte zuerst einloggen."}
      </p>
      <Link
        href={loggedIn ? "/" : "/registrieren"}
        className="w-full rounded-full bg-action py-2.5 font-display font-semibold text-pitch transition-colors hover:bg-action-hover"
      >
        {loggedIn ? "Zur Startseite" : "Zum Login"}
      </Link>
    </main>
  );
}

// Auswahlfeld "Wettbewerb" für das Spiel-Formular: zeigt die angelegten
// Wettbewerbe der Sportart. Ganz unten "Neuen Wettbewerb anlegen" – dann
// erscheint direkt darunter ein Eingabefeld, ohne den Reiter zu wechseln.
// Hat ein älteres Spiel einen Wettbewerb, den es in der Liste nicht (mehr)
// gibt, bleibt er als eigener Eintrag auswählbar.
const NEW_COMPETITION = "__neu__";

function CompetitionSelect({
  sport,
  value,
  onChange,
  compact = false,
}: {
  sport: Sport;
  value: string;
  onChange: (name: string) => void;
  compact?: boolean;
}) {
  const { competitions, addCompetition } = useAppData();
  const { showToast } = useFeedback();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const options = competitionsForSport(competitions, sport);
  const inList = options.some((c) => c.name === value);
  const duplicate = findDuplicateCompetition(competitions, newName, sport);

  const fieldClass = compact
    ? "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
    : "w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold";

  function create() {
    if (!newName.trim() || duplicate) return;
    const created = addCompetition(newName, sport);
    if (!created) return;
    onChange(created.name);
    setCreating(false);
    setNewName("");
    showToast(`✓ Wettbewerb "${created.name}" angelegt.`, "success");
  }

  return (
    <div>
      <select
        value={creating ? NEW_COMPETITION : value}
        onChange={(e) => {
          if (e.target.value === NEW_COMPETITION) {
            setCreating(true);
            return;
          }
          setCreating(false);
          onChange(e.target.value);
        }}
        className={fieldClass}
      >
        <option value="">Auswählen…</option>
        {options.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
        {value && !inList && <option value={value}>{value} (nicht in der Liste)</option>}
        <option value={NEW_COMPETITION}>＋ Neuer Wettbewerb…</option>
      </select>

      {creating && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-gold/60 bg-gold/5 p-3">
          <label className="text-sm text-muted">
            Neuer Wettbewerb für {sportIcon[sport]} {sportLabel(sport)}
          </label>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              // Enter soll nur den Wettbewerb anlegen, nicht schon das Spiel
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            placeholder="z. B. UEFA Nations League"
            aria-invalid={duplicate ? true : undefined}
            className={`${fieldClass} ${duplicate ? "!border-red-400" : ""}`}
          />
          {duplicate && (
            <p role="alert" className="text-sm text-ink">
              <span className="font-semibold text-red-300">Gibt es schon:</span> „{duplicate.name}“.{" "}
              <button
                type="button"
                onClick={() => {
                  onChange(duplicate.name);
                  setCreating(false);
                  setNewName("");
                }}
                className="font-semibold text-gold transition-colors hover:text-ink"
              >
                Diesen&nbsp;auswählen&nbsp;→
              </button>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={create}
              disabled={!newName.trim() || !!duplicate}
              className="rounded-full bg-action px-5 py-2 text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anlegen &amp; auswählen
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="rounded-full border border-edge px-5 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reiter "Wettbewerbe": einmal anlegen, dann beim Spiel nur noch auswählen.
// Pro Sportart eine eigene Liste (wie bei den Teams). Löschen entfernt den
// Wettbewerb nur aus der Auswahl – bestehende Spiele behalten ihn.
function CompetitionManager() {
  const { competitions, matches, addCompetition, renameCompetition, removeCompetition } = useAppData();
  const { showToast } = useFeedback();
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("Fußball");
  const [listTab, setListTab] = useState<Sport>("Fußball");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const duplicate = findDuplicateCompetition(competitions, name, sport);
  const editing = competitions.find((c) => c.id === editingId);
  const editDuplicate = editing
    ? findDuplicateCompetition(competitions, editName, editing.sport, editing.id)
    : undefined;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || duplicate) return;
    const created = addCompetition(name, sport);
    if (!created) return;
    setName("");
    setListTab(sport);
    showToast(`✓ Wettbewerb "${created.name}" angelegt.`, "success");
  }

  function saveEdit() {
    if (!editing || !editName.trim() || editDuplicate) return;
    const oldName = editing.name;
    const newName = editName.trim();
    const used = matches.filter((m) => m.sport === editing.sport && m.competition.trim() === oldName).length;
    if (
      newName !== oldName &&
      used > 0 &&
      !confirm(`"${oldName}" in "${newName}" umbenennen? Das ändert auch ${used} ${used === 1 ? "Spiel" : "Spiele"}.`)
    )
      return;
    if (renameCompetition(editing.id, newName)) {
      setEditingId(null);
      showToast(`✓ Wettbewerb "${newName}" gespeichert.`, "success");
    }
  }

  const listed = competitionsForSport(competitions, listTab);

  return (
    <section>
      <h2 className="mb-4 font-display text-2xl font-semibold text-ink">Wettbewerbe</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-4 rounded-card border border-edge bg-surface p-5 sm:p-6"
      >
        <div>
          <h3 className="font-display text-base font-semibold text-ink">Neuen Wettbewerb anlegen</h3>
          <p className="mt-1 text-sm text-muted">
            Einmal anlegen, dann beim Spiel einfach aus der Liste auswählen.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. UEFA Nations League"
              aria-invalid={duplicate ? true : undefined}
              className={`w-full rounded-lg border bg-pitch px-4 py-3 text-base text-ink outline-none ${
                duplicate ? "border-red-400 focus:border-red-400" : "border-edge focus:border-gold"
              }`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Sportart</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {sportIcon[s]} {sportLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {duplicate && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ⚠️
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-red-300">Diesen Wettbewerb gibt es schon!</span>
              „{duplicate.name}“ ist bei {sportIcon[duplicate.sport]} {sportLabel(duplicate.sport)} bereits angelegt.
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={!name.trim() || !!duplicate}
          className="self-start rounded-full bg-action px-6 py-3 font-display text-base font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Wettbewerb anlegen
        </button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2.5">
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setListTab(s)}
            className={`min-w-[9rem] rounded-full border px-5 py-3 text-base font-semibold transition-colors ${
              listTab === s
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-surface text-muted hover:border-gold/40 hover:text-ink"
            }`}
          >
            {sportIcon[s]} {sportLabel(s)} ({competitions.filter((c) => c.sport === s).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {listed.length === 0 && (
          <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted sm:col-span-2">
            Noch keine Wettbewerbe für {listTab} angelegt.
          </p>
        )}
        {listed.map((c) => {
          const used = matches.filter((m) => m.sport === c.sport && m.competition.trim() === c.name).length;
          if (c.id === editingId) {
            return (
              <div key={c.id} className="flex flex-col gap-2 rounded-card border border-gold bg-surface p-4">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  aria-invalid={editDuplicate ? true : undefined}
                  className={`w-full rounded-lg border bg-pitch px-3 py-2 text-base text-ink outline-none ${
                    editDuplicate ? "border-red-400" : "border-edge focus:border-gold"
                  }`}
                />
                {editDuplicate && (
                  <p role="alert" className="text-sm text-red-300">
                    „{editDuplicate.name}“ gibt es schon.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={!editName.trim() || !!editDuplicate}
                    className="rounded-lg bg-action px-3 py-1.5 text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight text-ink">{c.name}</span>
                <span className="text-xs text-muted">
                  {used === 0 ? "noch kein Spiel" : `${used} ${used === 1 ? "Spiel" : "Spiele"}`}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-gold transition-colors hover:text-ink"
                >
                  Umbenennen
                </button>
                <button
                  onClick={() => {
                    const hint = used > 0 ? ` Die ${used} ${used === 1 ? "Spiel behält" : "Spiele behalten"} ihn trotzdem.` : "";
                    if (confirm(`Wettbewerb "${c.name}" aus der Auswahl entfernen?${hint}`)) {
                      removeCompetition(c.id);
                      showToast(`✓ Wettbewerb "${c.name}" entfernt.`, "info");
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-red-400"
                >
                  Entfernen
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Startwert der dritten Farbe: genau die Farbe, die an dieser Stelle bisher
// zu sehen war – Einschalten allein verändert das Trikot also noch nicht.
function thirdColorStart(sport: Sport, bodyColor: string, trimColor: string): string {
  if (sport === "NFL") return helmetLogoColor(bodyColor);
  if (sport === "NHL") return "#F3F1EA";
  if (sport === "NBA") return "#FCEDED";
  return trimColor;
}

// Wo die dritte Farbe am Trikot (bzw. Helm) landet, je Sportart.
function thirdColorHint(sport: Sport): string {
  if (sport === "NFL") return "Logo-Mitte";
  if (sport === "NBA") return "Nummer & Zierlinien";
  if (sport === "NHL") return "Zierstreifen";
  return "Kragen & Ärmelenden";
}

// Oberarm-Farbe gibt es nur bei Trikots mit Ärmeln (nicht Basketball, nicht Football-Helm).
function hasArmColor(sport: Sport): boolean {
  return sport === "Fußball" || sport === "Handball" || sport === "NHL";
}

// Startfarbe beim Einschalten: die Ärmelfarbe, die man sonst sieht.
function armColorStart(style: JerseyStyle, bodyColor: string, trimColor: string): string {
  return style === "aermel" ? trimColor : bodyColor;
}

function ArmColorField({
  on,
  color,
  onToggle,
  onColor,
  inputBg,
}: {
  on: boolean;
  color: string;
  onToggle: (on: boolean) => void;
  onColor: (color: string) => void;
  inputBg: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-action"
        />
        Oberarm-Farbe
      </label>
      <input
        type="color"
        value={color}
        disabled={!on}
        onChange={(e) => onColor(e.target.value)}
        aria-label="Oberarm-Farbe"
        className={`h-11 w-20 cursor-pointer rounded-lg border border-edge ${inputBg} p-1 disabled:cursor-not-allowed disabled:opacity-30`}
      />
    </div>
  );
}

function ThirdColorField({
  sport,
  on,
  color,
  onToggle,
  onColor,
  inputBg,
}: {
  sport: Sport;
  on: boolean;
  color: string;
  onToggle: (on: boolean) => void;
  onColor: (color: string) => void;
  inputBg: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-action"
        />
        3. Farbe ({thirdColorHint(sport)})
      </label>
      <input
        type="color"
        value={color}
        disabled={!on}
        onChange={(e) => onColor(e.target.value)}
        aria-label={`Dritte Farbe: ${thirdColorHint(sport)}`}
        className={`h-11 w-20 cursor-pointer rounded-lg border border-edge ${inputBg} p-1 disabled:cursor-not-allowed disabled:opacity-30`}
      />
    </div>
  );
}

function TeamManager() {
  const { teams, addTeam, updateTeam, removeTeam } = useAppData();
  const { showToast } = useFeedback();
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("Fußball");
  // Team-Liste nach Sportart in Reitern statt alles gemischt untereinander –
  // sonst verliert man bei mehreren Sportarten schnell den Überblick.
  const [teamListTab, setTeamListTab] = useState<Sport>("Fußball");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [primaryColor, setPrimaryColor] = useState("#3FA66B");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [jerseyStyle, setJerseyStyle] = useState<JerseyStyle>("solid");
  // Dritte Farbe (optional); aus = Trikot wie bisher zweifarbig.
  const [tertiaryOn, setTertiaryOn] = useState(false);
  const [tertiaryColor, setTertiaryColor] = useState("#FFFFFF");
  // Eigene Oberarm-Farbe (optional); aus = Ärmel wie bisher.
  const [armOn, setArmOn] = useState(false);
  const [armColor, setArmColor] = useState("#3FA66B");
  // Eigene Auswärtsfarben; aus = Auswärtstrikot sind die Heimfarben vertauscht.
  const [awayCustom, setAwayCustom] = useState(false);
  const [awayPrimaryColor, setAwayPrimaryColor] = useState("#FFFFFF");
  const [awaySecondaryColor, setAwaySecondaryColor] = useState("#3FA66B");
  const [awayTertiaryOn, setAwayTertiaryOn] = useState(false);
  const [awayTertiaryColor, setAwayTertiaryColor] = useState("#FFFFFF");
  const [awayArmOn, setAwayArmOn] = useState(false);
  const [awayArmColor, setAwayArmColor] = useState("#FFFFFF");
  // Eigener Stil fürs Auswärtstrikot; "" = wie das Heimtrikot.
  const [awayJerseyStyle, setAwayJerseyStyle] = useState<JerseyStyle | "">("");
  const [isNationalTeam, setIsNationalTeam] = useState(false);
  // Gesetzt, solange ein bestehendes Team bearbeitet wird: dasselbe Formular
  // wie beim Anlegen, nur mit den Werten des Teams vorausgefüllt.
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
    setSport("Fußball");
    setCountryCode(DEFAULT_COUNTRY_CODE);
    setPrimaryColor("#3FA66B");
    setSecondaryColor("#FFFFFF");
    setJerseyStyle("solid");
    setTertiaryOn(false);
    setArmOn(false);
    setAwayCustom(false);
    setAwayTertiaryOn(false);
    setAwayArmOn(false);
    setAwayJerseyStyle("");
    setIsNationalTeam(false);
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setName(team.name);
    setSport(team.sport);
    setCountryCode(team.countryCode);
    setPrimaryColor(team.primaryColor);
    setSecondaryColor(team.secondaryColor);
    setJerseyStyle(team.jerseyStyle ?? "solid");
    setAwayCustom(!!(team.awayPrimaryColor && team.awaySecondaryColor));
    setAwayPrimaryColor(team.awayPrimaryColor ?? team.secondaryColor);
    setAwaySecondaryColor(team.awaySecondaryColor ?? team.primaryColor);
    setTertiaryOn(!!team.tertiaryColor);
    setTertiaryColor(team.tertiaryColor ?? thirdColorStart(team.sport, team.primaryColor, team.secondaryColor));
    setAwayTertiaryOn(!!team.awayTertiaryColor);
    setAwayTertiaryColor(team.awayTertiaryColor ?? team.tertiaryColor ?? thirdColorStart(team.sport, team.secondaryColor, team.primaryColor));
    setAwayJerseyStyle(team.awayJerseyStyle ?? "");
    setArmOn(!!team.armColor);
    setArmColor(team.armColor ?? armColorStart(team.jerseyStyle ?? "solid", team.primaryColor, team.secondaryColor));
    setAwayArmOn(!!team.awayArmColor);
    setAwayArmColor(
      team.awayArmColor ??
        team.armColor ??
        armColorStart(
          team.awayJerseyStyle ?? team.jerseyStyle ?? "solid",
          team.awayPrimaryColor ?? team.secondaryColor,
          team.awaySecondaryColor ?? team.primaryColor
        )
    );
    setIsNationalTeam(team.isNationalTeam ?? false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Gibt es das Team in dieser Sportart schon? Dann Hinweis zeigen und
  // Speichern sperren, damit kein Team doppelt angelegt wird.
  const duplicate = findDuplicateTeam(teams, name, sport, editingId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (duplicate) {
      showToast(`„${duplicate.name}“ gibt es bei ${sportLabel(duplicate.sport)} schon.`, "info");
      return;
    }
    const data = {
      name: name.trim(),
      sport,
      countryCode,
      primaryColor,
      secondaryColor,
      jerseyStyle,
      // Optionale Felder nur speichern, wenn gewählt: ohne sie sieht alles aus wie bisher.
      ...(tertiaryOn ? { tertiaryColor } : {}),
      ...(armOn && hasArmColor(sport) ? { armColor } : {}),
      // Auswärtstrikot nicht bei NFL (Helm, keine Trikots)
      ...(awayCustom && sport !== "NFL"
        ? {
            awayPrimaryColor,
            awaySecondaryColor,
            ...(awayTertiaryOn ? { awayTertiaryColor } : {}),
            ...(awayArmOn && hasArmColor(sport) ? { awayArmColor } : {}),
          }
        : {}),
      ...(awayJerseyStyle && sport !== "NFL" ? { awayJerseyStyle } : {}),
      isNationalTeam,
    };
    if (editingId) {
      if (!confirm(`Änderungen an "${name.trim()}" speichern?`)) return;
      updateTeam(editingId, data);
      setTeamListTab(sport);
      resetForm();
      showToast(`✓ Team "${data.name}" gespeichert.`, "success");
      return;
    }
    if (!confirm(`Team "${name.trim()}" anlegen?`)) return;
    addTeam(data);
    setName("");
    showToast(`✓ Team "${name.trim()}" angelegt.`, "success");
  }

  return (
    <section>
      <h2 className="mb-4 font-display text-2xl font-semibold text-ink">Teams</h2>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`mb-6 flex scroll-mt-40 flex-col gap-5 rounded-card border bg-surface p-5 sm:p-6 ${
          editingId ? "border-gold" : "border-edge"
        }`}
      >
        <h3 className="font-display text-base font-semibold text-ink">
          {editingId ? "Team bearbeiten" : "Neues Team anlegen"}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="mb-1.5 block text-sm text-muted">Teamname</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Kansas City Chiefs"
              aria-invalid={duplicate ? true : undefined}
              className={`w-full rounded-lg border bg-pitch px-4 py-3 text-base text-ink outline-none ${
                duplicate ? "border-red-400 focus:border-red-400" : "border-edge focus:border-gold"
              }`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Sportart</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {sportIcon[s]} {sportLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Land</label>
            <CountryPicker value={countryCode} onChange={setCountryCode} />
          </div>
        </div>

        {duplicate && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-400/60 bg-red-500/10 px-4 py-3 text-sm text-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ⚠️
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-red-300">Dieses Team gibt es schon!</span>
              „{duplicate.name}“ ist bei {sportIcon[duplicate.sport]} {sportLabel(duplicate.sport)} bereits
              angelegt. Bitte nicht doppelt anlegen, sondern das vorhandene Team verwenden oder
              bearbeiten.
              {!editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setTeamListTab(duplicate.sport);
                    startEdit(duplicate);
                  }}
                  className="mt-2 block text-left font-semibold text-gold transition-colors hover:text-ink"
                >
                  Vorhandenes Team bearbeiten&nbsp;→
                </button>
              )}
            </span>
          </div>
        )}

        <label className="flex w-fit items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={isNationalTeam}
            onChange={(e) => setIsNationalTeam(e.target.checked)}
            className="h-4 w-4 accent-action"
          />
          Nationalmannschaft (Icon zeigt automatisch die Landesflagge statt Trikot/Helm)
        </label>

        {/* Farben + große Live-Vorschau nebeneinander: man sieht sofort, wie
            das Team-Wappen mit den gewählten Farben aussieht. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 rounded-lg border border-edge bg-pitch px-5 py-4">
            <TeamBadge
              sport={sport}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              tertiaryColor={tertiaryOn ? tertiaryColor : undefined}
              armColor={armOn && hasArmColor(sport) ? armColor : undefined}
              jerseyStyle={jerseyStyle}
              isNationalTeam={isNationalTeam}
              countryCode={countryCode}
              size={56}
            />
            <div>
              <p className="text-sm font-semibold text-ink">{name.trim() || "Vorschau"}</p>
              <p className="text-xs text-muted">
                {sport === "NFL" || isNationalTeam ? "So sieht das Wappen im Spiel aus" : "Heimtrikot"}
              </p>
            </div>
          </div>

          {!isNationalTeam && (
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1.5 block text-sm text-muted">
                  {sport === "NFL" ? "Helmfarbe" : "Trikotfarbe"}
                </label>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-11 w-20 cursor-pointer rounded-lg border border-edge bg-pitch p-1"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-muted">
                  {sport === "NFL" ? "Streifen-/Gitterfarbe" : "Kragen-/Streifenfarbe"}
                </label>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-11 w-20 cursor-pointer rounded-lg border border-edge bg-pitch p-1"
                />
              </div>
              <ThirdColorField
                sport={sport}
                on={tertiaryOn}
                color={tertiaryColor}
                onToggle={(on) => {
                  // Startfarbe so, dass sich beim Einschalten noch nichts ändert
                  if (on && !tertiaryOn) setTertiaryColor(thirdColorStart(sport, primaryColor, secondaryColor));
                  setTertiaryOn(on);
                }}
                onColor={setTertiaryColor}
                inputBg="bg-pitch"
              />
              {hasArmColor(sport) && (
                <ArmColorField
                  on={armOn}
                  color={armColor}
                  onToggle={(on) => {
                    if (on && !armOn) setArmColor(armColorStart(jerseyStyle, primaryColor, secondaryColor));
                    setArmOn(on);
                  }}
                  onColor={setArmColor}
                  inputBg="bg-pitch"
                />
              )}
            </div>
          )}

          {!isNationalTeam && sport !== "NFL" && (
            <div>
              <label className="mb-1.5 block text-sm text-muted">Trikot-Stil (Heim)</label>
              <select
                value={jerseyStyle}
                onChange={(e) => setJerseyStyle(e.target.value as JerseyStyle)}
                className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
              >
                {JERSEY_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!isNationalTeam && sport !== "NFL" && (
          <div className="rounded-lg border border-edge bg-pitch p-4">
            <p className="mb-1 text-sm font-semibold text-ink">Auswärtstrikot</p>
            <p className="mb-3 text-xs text-muted">
              Ohne eigene Farben ist das Auswärtstrikot einfach deine Heimfarben vertauscht.
            </p>
            <div className="mb-4 max-w-xs">
              <label className="mb-1.5 block text-sm text-muted">Trikot-Stil (Auswärts)</label>
              <select
                value={awayJerseyStyle}
                onChange={(e) => setAwayJerseyStyle(e.target.value as JerseyStyle | "")}
                className="w-full rounded-lg border border-edge bg-surface px-4 py-3 text-base text-ink outline-none focus:border-gold"
              >
                <option value="">
                  Wie Heim ({JERSEY_STYLES.find((s) => s.value === jerseyStyle)?.label})
                </option>
                {JERSEY_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="mb-4 flex w-fit items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={awayCustom}
                onChange={(e) => {
                  if (e.target.checked && !awayCustom) {
                    // Startpunkt: die vertauschten Heimfarben, die man bisher sah
                    setAwayPrimaryColor(secondaryColor);
                    setAwaySecondaryColor(primaryColor);
                    setAwayTertiaryOn(tertiaryOn);
                    setAwayTertiaryColor(tertiaryOn ? tertiaryColor : thirdColorStart(sport, secondaryColor, primaryColor));
                    setAwayArmOn(armOn);
                    setAwayArmColor(
                      armOn ? armColor : armColorStart(awayJerseyStyle || jerseyStyle, secondaryColor, primaryColor)
                    );
                  }
                  setAwayCustom(e.target.checked);
                }}
                className="h-4 w-4 accent-action"
              />
              Eigene Farben für das Auswärtstrikot
            </label>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-end justify-center gap-5 rounded-lg border border-edge bg-surface px-5 py-3">
                {(["heim", "auswaerts"] as const).map((v) => (
                  <div key={v} className="flex flex-col items-center gap-1">
                    <TeamBadge
                      sport={sport}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      tertiaryColor={tertiaryOn ? tertiaryColor : undefined}
                      jerseyStyle={v === "auswaerts" && awayJerseyStyle ? awayJerseyStyle : jerseyStyle}
                      variant={v}
                      awayPrimaryColor={awayCustom ? awayPrimaryColor : undefined}
                      awaySecondaryColor={awayCustom ? awaySecondaryColor : undefined}
                      awayTertiaryColor={awayCustom && awayTertiaryOn ? awayTertiaryColor : undefined}
                      armColor={armOn && hasArmColor(sport) ? armColor : undefined}
                      awayArmColor={awayCustom && awayArmOn && hasArmColor(sport) ? awayArmColor : undefined}
                      size={56}
                    />
                    <span className="text-xs text-muted">{v === "heim" ? "Heim" : "Auswärts"}</span>
                  </div>
                ))}
              </div>
              {awayCustom && (
                <div className="flex flex-wrap items-end gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm text-muted">Trikotfarbe</label>
                    <input
                      type="color"
                      value={awayPrimaryColor}
                      onChange={(e) => setAwayPrimaryColor(e.target.value)}
                      className="h-11 w-20 cursor-pointer rounded-lg border border-edge bg-surface p-1"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-muted">Kragen-/Streifenfarbe</label>
                    <input
                      type="color"
                      value={awaySecondaryColor}
                      onChange={(e) => setAwaySecondaryColor(e.target.value)}
                      className="h-11 w-20 cursor-pointer rounded-lg border border-edge bg-surface p-1"
                    />
                  </div>
                  <ThirdColorField
                    sport={sport}
                    on={awayTertiaryOn}
                    color={awayTertiaryColor}
                    onToggle={(on) => {
                      if (on && !awayTertiaryOn) setAwayTertiaryColor(thirdColorStart(sport, awayPrimaryColor, awaySecondaryColor));
                      setAwayTertiaryOn(on);
                    }}
                    onColor={setAwayTertiaryColor}
                    inputBg="bg-surface"
                  />
                  {hasArmColor(sport) && (
                    <ArmColorField
                      on={awayArmOn}
                      color={awayArmColor}
                      onToggle={(on) => {
                        if (on && !awayArmOn)
                          setAwayArmColor(armColorStart(awayJerseyStyle || jerseyStyle, awayPrimaryColor, awaySecondaryColor));
                        setAwayArmOn(on);
                      }}
                      onColor={setAwayArmColor}
                      inputBg="bg-surface"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!!duplicate}
            className="rounded-full bg-action px-6 py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-action"
          >
            {editingId ? "Änderungen speichern" : "Team anlegen"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-muted/50 px-6 py-3 font-display text-base font-semibold text-ink transition-colors hover:border-ink"
            >
              Abbrechen
            </button>
          )}
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2.5">
        {SPORTS.map((s) => {
          const countForSport = teams.filter((t) => t.sport === s).length;
          return (
            <button
              key={s}
              onClick={() => setTeamListTab(s)}
              className={`min-w-[9rem] rounded-full border px-5 py-3 text-base font-semibold transition-colors ${
                teamListTab === s
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-edge bg-surface text-muted hover:border-gold/40 hover:text-ink"
              }`}
            >
              {sportIcon[s]} {sportLabel(s)} ({countForSport})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {teams.filter((t) => t.sport === teamListTab).length === 0 && (
          <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted sm:col-span-2">
            Noch keine Teams für {teamListTab} angelegt.
          </p>
        )}
        {teams
          .filter((t) => t.sport === teamListTab)
          .map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4"
            >
              <span className="flex min-w-0 items-center gap-3">
                <TeamBadge
                  sport={team.sport}
                  {...teamColorProps(team)}
                  jerseyStyle={team.jerseyStyle}
                  isNationalTeam={team.isNationalTeam}
                  countryCode={team.countryCode}
                  size={40}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-ink">
                    {!team.isNationalTeam && flagEmoji(team.countryCode)} {team.name}
                  </span>
                  <span className="text-xs text-muted">
                    {sportLabel(team.sport)}
                    {team.isNationalTeam ? " · Nationalmannschaft" : ""}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <button
                  onClick={() => startEdit(team)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-gold transition-colors hover:text-ink"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Team "${team.name}" wirklich entfernen?`)) {
                      removeTeam(team.id);
                      if (editingId === team.id) resetForm();
                      showToast(`✓ Team "${team.name}" entfernt.`, "info");
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-red-400"
                >
                  Entfernen
                </button>
              </span>
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
    cancelMatch,
    getTeam,
    updateMatchScore,
    updateMatchDetails,
    setSummaryVideo,
    setTvChannel,
    setTipMode,
    setBooster,
    setBonusQuestion,
    setBonusQuestionAnswer,
  } = useAppData();
  const { showToast } = useFeedback();

  // Die Bonusfrage wertet die Datenbank aus, sobald die richtige Antwort
  // gespeichert ist (supabase/auswertung-server.sql).
  function handleBonusAnswer(matchId: string, correctOptionIndex: number) {
    setBonusQuestionAnswer(matchId, correctOptionIndex);
  }

  // Tipps, Duelle und Endstand-Korrekturen wertet die Datenbank für ALLE
  // Spieler selbst aus, sobald das Spiel hier als beendet gespeichert wird
  // – kein Browser muss dafür offen sein, und keiner kann dabei schummeln.
  function handleScoreUpdate(
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
    status: MatchStatus
  ) {
    updateMatchScore(matchId, homeScore, awayScore, status);
  }

  // Trennt die Liste unten in "Bevorstehend" (inkl. Live) und "Beendet" –
  // sonst wächst die Liste mit der Zeit endlos und man muss an alten,
  // abgepfiffenen Spielen vorbeiscrollen, um ein neues zu bearbeiten.
  const [matchListTab, setMatchListTab] = useState<"bevorstehend" | "beendet">("bevorstehend");

  const [sport, setSport] = useState<Sport>("Fußball");
  const [competition, setCompetition] = useState("");
  const [matchday, setMatchday] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [tipDeadline, setTipDeadline] = useState("");
  // Solange der Admin den Tippschluss nicht selbst ändert, läuft er mit dem
  // Anpfiff mit. Vorher wurde er nur beim ersten Eintrag kopiert: wer danach
  // die Anpfiff-Zeit änderte, behielt einen alten (oft schon vorbeien)
  // Tippschluss – das Spiel stand dann nie bei "Offene Tipps".
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  // undefined = Standard (Heim-/Auswärtstrikot im Team-Stil)
  const [homeJersey, setHomeJersey] = useState<MatchJersey | undefined>(undefined);
  const [awayJersey, setAwayJersey] = useState<MatchJersey | undefined>(undefined);
  const [booster, setBoosterInput] = useState(false);
  const [tvChannel, setTvChannelInput] = useState("");
  const [tipMode, setTipModeInput] = useState<TipMode>("score");

  const teamsForSport = teams.filter((t) => t.sport === sport);
  // Bestätigung direkt im Formular statt Browser-Dialog: Safari/Chrome können
  // confirm()-Fenster nach mehreren Rückfragen stumm unterdrücken – dann
  // passierte beim Tippen auf "Spiel anlegen" einfach gar nichts.
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  useEffect(() => {
    setConfirming(false);
    setFormError(null);
  }, [sport, competition, kickoff, tipDeadline, homeTeamId, awayTeamId, booster]);

  // Jeder Fehlerfall zeigt eine Meldung direkt am Knopf (plus Toast) – es
  // darf nie passieren, dass beim Tippen auf "Spiel anlegen" nichts geschieht.
  function fail(message: string) {
    setFormError(message);
    showToast(message, "info");
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setFormError(null);
    try {
      submitMatch();
    } catch (err) {
      fail(`Spiel konnte nicht angelegt werden: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function submitMatch() {
    if (!competition.trim()) {
      fail("Bitte zuerst einen Wettbewerb auswählen.");
      return;
    }
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) {
      fail("Bitte zwei verschiedene Teams auswählen.");
      return;
    }
    // Safari zeigt im leeren Datumsfeld das heutige Datum grau als Vorschlag –
    // das ist aber noch nicht eingetragen. Ist nur die Uhrzeit gesetzt, liefert
    // das Feld gar keinen Wert.
    if (!kickoff) {
      fail("Beim Anpfiff fehlt noch das Datum (ein grau angezeigtes Datum ist nur ein Vorschlag). Tippe unter dem Feld auf „Heute“ oder „Morgen“ und wähle dann die Uhrzeit.");
      return;
    }
    if (!tipDeadline) {
      fail("Beim Tippschluss fehlt noch das Datum (ein grau angezeigtes Datum ist nur ein Vorschlag). Tippe unter dem Feld auf „Heute“ oder „Morgen“.");
      return;
    }
    const deadlineProblem = checkDeadline(kickoff, tipDeadline);
    if (deadlineProblem) {
      fail(deadlineProblem);
      return;
    }
    if (booster && boostersOnDay(matches, new Date(kickoff).toISOString()) >= BOOSTERS_PER_DAY) {
      fail(`An diesem Tag gibt es schon ${BOOSTERS_PER_DAY} Booster-Spiele.`);
      return;
    }

    const homeName = getTeam(homeTeamId)?.name ?? "?";
    const awayName = getTeam(awayTeamId)?.name ?? "?";
    // Erster Tipp auf den Knopf: Bestätigung im Formular zeigen, zweiter legt an.
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);

    addMatch({
      sport,
      competition: competition.trim(),
      matchday: matchday ? Number(matchday) : undefined,
      kickoff: new Date(kickoff).toISOString(),
      tipDeadline: new Date(tipDeadline).toISOString(),
      homeTeamId,
      awayTeamId,
      fixedStake: booster ? BOOSTER_STAKE : 0,
      booster,
      status: "upcoming",
      liveHomeScore: null,
      liveAwayScore: null,
      summaryVideoUrl: null,
      tvChannel: tvChannel.trim() || null,
      tipMode,
      ...(homeJersey ? { homeJersey } : {}),
      ...(awayJersey ? { awayJersey } : {}),
    });

    setCompetition("");
    setMatchday("");
    setKickoff("");
    setTipDeadline("");
    setDeadlineTouched(false);
    setHomeTeamId("");
    setAwayTeamId("");
    setHomeJersey(undefined);
    setAwayJersey(undefined);
    setBoosterInput(false);
    setTvChannelInput("");
    setTipModeInput("score");
    showToast(`✓ Spiel "${matchTitle(sport, homeName, awayName)}" angelegt.`, "success");
  }

  const previewHome = teamsForSport.find((t) => t.id === homeTeamId);
  const previewAway = teamsForSport.find((t) => t.id === awayTeamId);

  return (
    <section>
      <h2 className="mb-4 font-display text-2xl font-semibold text-ink">Spiele</h2>

      {/* noValidate: Safari meldete beim Datumsfeld sonst "Ungültiger Wert"
          und blockierte das Anlegen, obwohl Anpfiff und Tippschluss
          korrekt eingetragen waren. Geprüft wird selbst in handleSubmit. */}
      <form
        noValidate
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-6 rounded-card border border-edge bg-surface p-5 sm:p-6"
      >
        <h3 className="font-display text-base font-semibold text-ink">Neues Spiel anlegen</h3>

        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Teams</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-muted">Sportart</label>
              <select
                value={sport}
                onChange={(e) => {
                  setSport(e.target.value as Sport);
                  setCompetition("");
                  setHomeTeamId("");
                  setAwayTeamId("");
                  setHomeJersey(undefined);
                  setAwayJersey(undefined);
                }}
                className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {sportIcon[s]} {sportLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">Wettbewerb</label>
              <CompetitionSelect sport={sport} value={competition} onChange={setCompetition} />
            </div>
            {/* US-Sport ("Gast @ Heim"): Gastteam-Feld zuerst, wie auf dem Spielplan. */}
            <div className={isAwayFirst(sport) ? "order-1" : ""}>
              <label className="mb-1.5 block text-sm text-muted">{teamFieldLabel(sport, "home")}</label>
              <TeamPicker
                teams={teamsForSport}
                value={homeTeamId}
                onChange={(id) => {
                  setHomeTeamId(id);
                  setHomeJersey(undefined);
                }}
                otherTeamId={awayTeamId}
                otherLabel="schon als Auswärtsteam gewählt"
              />
              {previewHome && (
                <JerseyPicker team={previewHome} value={jerseyFor(previewHome, homeJersey)} onChange={setHomeJersey} />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">{teamFieldLabel(sport, "away")}</label>
              <TeamPicker
                teams={teamsForSport}
                value={awayTeamId}
                onChange={(id) => {
                  setAwayTeamId(id);
                  setAwayJersey(undefined);
                }}
                otherTeamId={homeTeamId}
                otherLabel="schon als Heimteam gewählt"
              />
              {previewAway && (
                <JerseyPicker team={previewAway} value={jerseyFor(previewAway, awayJersey)} onChange={setAwayJersey} />
              )}
            </div>
          </div>

          {/* Live-Vorschau: sobald beide Teams gewählt sind, sieht man sofort
              die Trikots (Heim und Auswärts), statt sie sich aus dem Namen vorstellen
              zu müssen. */}
          {(previewHome || previewAway) && (
            <div
              className={`mt-3 flex items-center justify-center gap-4 rounded-lg border border-edge bg-pitch px-4 py-4 ${
                isAwayFirst(sport) ? "flex-row-reverse" : ""
              }`}
            >
              <div className="flex flex-col items-center gap-1.5">
                {previewHome ? (
                  <TeamBadge
                    sport={previewHome.sport}
                    {...teamColorProps(previewHome)}
                    jerseyStyle={jerseyFor(previewHome, homeJersey).style}
                    variant={jerseyFor(previewHome, homeJersey).variant}
                    isNationalTeam={previewHome.isNationalTeam}
                    countryCode={previewHome.countryCode}
                    size={48}
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-edge text-muted">
                    ?
                  </span>
                )}
                <span className="max-w-[9rem] text-center text-sm font-semibold leading-tight text-ink">
                  {previewHome?.name ?? "Heimteam"}
                </span>
              </div>
              <span className="font-display text-sm font-bold text-muted">vs</span>
              <div className="flex flex-col items-center gap-1.5">
                {previewAway ? (
                  <TeamBadge
                    sport={previewAway.sport}
                    {...teamColorProps(previewAway)}
                    jerseyStyle={jerseyFor(previewAway, awayJersey).style}
                    variant={jerseyFor(previewAway, awayJersey).variant}
                    isNationalTeam={previewAway.isNationalTeam}
                    countryCode={previewAway.countryCode}
                    flip
                    size={48}
                  />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-edge text-muted">
                    ?
                  </span>
                )}
                <span className="max-w-[9rem] text-center text-sm font-semibold leading-tight text-ink">
                  {previewAway?.name ?? "Auswärtsteam"}
                </span>
              </div>
            </div>
          )}

          {teamsForSport.length < 2 && (
            <p className="mt-2 text-sm text-muted">
              Für {sportLabel(sport)} brauchst du zuerst mindestens zwei Teams (siehe Tab "Teams").
            </p>
          )}
        </div>

        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Termine</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickDateTimeField
              label="Anpfiff"
              value={kickoff}
              onChange={(v) => {
                setKickoff(v);
                // Tippschluss = Anpfiff, bis der Admin ihn selbst ändert
                if (!deadlineTouched && v) setTipDeadline(v);
              }}
            />
            <QuickDateTimeField
              label="Tippschluss (ab dann kein Tipp mehr möglich)"
              value={tipDeadline}
              onChange={(v) => {
                setTipDeadline(v);
                setDeadlineTouched(v !== kickoff);
              }}
            />
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-muted">Spieltag (optional)</label>
              <input
                type="number"
                value={matchday}
                onChange={(e) => setMatchday(e.target.value)}
                className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
              />
            </div>
            <BoosterCheckbox
              checked={booster}
              onChange={setBoosterInput}
              taken={kickoff ? boostersOnDay(matches, new Date(kickoff).toISOString()) : 0}
            />
            <div>
              <label className="mb-1.5 block text-sm text-muted">TV-Sender (optional)</label>
              <input
                value={tvChannel}
                onChange={(e) => setTvChannelInput(e.target.value)}
                placeholder="z. B. Sky, DAZN, ORF1"
                className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">Tipp-Art</label>
              <select
                value={tipMode}
                onChange={(e) => setTipModeInput(e.target.value as TipMode)}
                className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
              >
                <option value="score">Ergebnis-Tipp (z. B. 2:1)</option>
                <option value="1x2">1X2 (Wer gewinnt? Knöpfe mit Teamnamen)</option>
              </select>
            </div>
          </div>
        </div>

        {confirming ? (
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-4">
            <p className="text-sm font-semibold text-ink">
              Spiel „{matchTitle(sport, getTeam(homeTeamId)?.name ?? "?", getTeam(awayTeamId)?.name ?? "?")}“ (
              {competition.trim()}) am {new Date(kickoff).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}{" "}
              anlegen?
            </p>
            {new Date(tipDeadline).getTime() <= Date.now() && (
              <p className="mt-1 text-sm text-gold">
                Achtung: Der Tippschluss ist schon vorbei – Spieler sehen das Spiel nur unter „Geschlossene Tipps“.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="rounded-full bg-action px-6 py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-action-hover"
              >
                Ja, anlegen
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-muted/50 px-6 py-3 font-display text-base font-semibold text-ink transition-colors hover:border-ink"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="self-start rounded-full bg-action px-6 py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Spiel anlegen
          </button>
        )}
        {formError && (
          <p role="alert" className="-mt-3 rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-300">
            {formError}
          </p>
        )}
      </form>

      {(() => {
        // Abgesagte Spiele stehen bei "Beendet" (nichts mehr zu tun).
        const isDone = (m: (typeof matches)[number]) => m.status === "finished" || m.status === "cancelled";
        const upcomingMatches = matches
          .filter((m) => !isDone(m))
          .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
        const finishedMatches = matches
          .filter(isDone)
          .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
        const visibleMatches = matchListTab === "bevorstehend" ? upcomingMatches : finishedMatches;

        return (
          <>
            <div className="mb-4 flex gap-2.5">
              <button
                onClick={() => setMatchListTab("bevorstehend")}
                className={`flex-1 rounded-full border px-4 py-3 text-base font-semibold sm:min-w-[11rem] sm:flex-none sm:px-5 transition-colors ${
                  matchListTab === "bevorstehend"
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-edge bg-surface text-muted hover:border-gold/40 hover:text-ink"
                }`}
              >
                Bevorstehend ({upcomingMatches.length})
              </button>
              <button
                onClick={() => setMatchListTab("beendet")}
                className={`flex-1 rounded-full border px-4 py-3 text-base font-semibold sm:min-w-[11rem] sm:flex-none sm:px-5 transition-colors ${
                  matchListTab === "beendet"
                    ? "border-gold bg-gold/15 text-gold"
                    : "border-edge bg-surface text-muted hover:border-gold/40 hover:text-ink"
                }`}
              >
                Beendet ({finishedMatches.length})
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {visibleMatches.length === 0 && (
                <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
                  {matchListTab === "bevorstehend"
                    ? "Keine bevorstehenden Spiele."
                    : "Noch keine beendeten Spiele."}
                </p>
              )}
              {visibleMatches.map((match) => {
                const home = getTeam(match.homeTeamId);
                const away = getTeam(match.awayTeamId);
                // US-Sport: Gast links, Heim rechts (nur Anzeige).
                const [left, right] = displayOrder(match.sport, home, away);
          return (
            <div key={match.id} className="rounded-card border border-edge bg-surface p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="text-base">{sportIcon[match.sport]}</span>
                  <span className="font-semibold text-ink">
                    {match.competition}
                    {match.matchday ? ` · Spieltag ${match.matchday}` : ""}
                  </span>
                  <span>· {new Date(match.kickoff).toLocaleString("de-DE")}</span>
                  {match.tipDeadline !== match.kickoff && (
                    <span>· Tippschluss {new Date(match.tipDeadline).toLocaleString("de-DE")}</span>
                  )}
                  {match.booster && (
                    <span className="rounded-full border border-gold/50 bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">
                      ⚡ Booster
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${matchStatusClass[match.status]}`}
                >
                  {matchStatusLabel[match.status]}
                </span>
              </div>

              {match.status === "upcoming" &&
                new Date(match.tipDeadline).getTime() <= Date.now() &&
                new Date(match.kickoff).getTime() > Date.now() && (
                  <p className="mb-4 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
                    Tippschluss ist schon vorbei ({new Date(match.tipDeadline).toLocaleString("de-DE")}) – Spieler
                    sehen das Spiel nur unter „Geschlossene Tipps“. Über „Bearbeiten“ den Tippschluss neu setzen.
                  </p>
                )}
              <div className="mb-5 flex items-center justify-center gap-4 sm:gap-6">
                <div className="flex flex-1 flex-col items-center gap-1.5 sm:flex-row sm:justify-end sm:gap-3">
                  {left && (
                    <TeamBadge
                      sport={left.sport}
                      {...matchJerseyProps(match, left)}
                      isNationalTeam={left.isNationalTeam}
                      countryCode={left.countryCode}
                      size={40}
                    />
                  )}
                  <span className="max-w-[8rem] text-center text-sm font-semibold leading-tight text-ink sm:text-right">
                    {left?.name ?? "?"}
                  </span>
                </div>

                {match.status === "finished" || match.status === "live" ? (
                  <span className="shrink-0 font-display text-xl font-bold text-ink">
                    {scoreText(match.sport, match.liveHomeScore, match.liveAwayScore)}
                  </span>
                ) : (
                  <span className="shrink-0 font-display text-sm font-bold text-muted">vs</span>
                )}

                <div className="flex flex-1 flex-col items-center gap-1.5 sm:flex-row sm:justify-start sm:gap-3">
                  {right && (
                    <TeamBadge
                      sport={right.sport}
                      {...matchJerseyProps(match, right)}
                      isNationalTeam={right.isNationalTeam}
                      countryCode={right.countryCode}
                      flip
                      size={40}
                    />
                  )}
                  <span className="max-w-[8rem] text-center text-sm font-semibold leading-tight text-ink sm:text-left">
                    {right?.name ?? "?"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-4">
                {match.status !== "cancelled" && (
                  <>
                    <MatchDetailsEditor match={match} teams={teams} onSave={updateMatchDetails} />
                    {match.status === "upcoming" && (
                      <BoosterToggleButton match={match} matches={matches} onToggle={setBooster} />
                    )}
                    <LiveScoreEditor
                      match={match}
                      homeName={home?.name ?? "Heimteam"}
                      awayName={away?.name ?? "Auswärtsteam"}
                      onUpdate={handleScoreUpdate}
                    />
                    <MatchExtrasEditor
                      match={match}
                      onSaveTipMode={setTipMode}
                      onSaveTvChannel={setTvChannel}
                      onSaveVideoUrl={setSummaryVideo}
                    />
                    <BonusQuestionEditor match={match} onSave={setBonusQuestion} onSetAnswer={handleBonusAnswer} />
                  </>
                )}
                {match.status !== "finished" && match.status !== "cancelled" && (
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `Spiel "${matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")}" absagen?\n\n` +
                            "Alle Spieler bekommen ihren Einsatz zurück, das Spiel wird nicht gewertet. " +
                            "Das lässt sich nicht rückgängig machen."
                        )
                      )
                        return;
                      const result = await cancelMatch(match.id);
                      if (result.ok) {
                        showToast(
                          result.refundedTips === 1
                            ? "✓ Spiel abgesagt – 1 Tipp erstattet."
                            : `✓ Spiel abgesagt – ${result.refundedTips} Tipps erstattet.`,
                          "success"
                        );
                      } else {
                        showToast(`Absagen fehlgeschlagen: ${result.error}`, "info");
                      }
                    }}
                    className="rounded-lg border border-red-400/50 px-2.5 py-1 text-xs font-semibold text-red-300 transition-colors hover:bg-red-400/10"
                  >
                    Absagen
                  </button>
                )}
                <button
                  onClick={() => {
                    const refundNote =
                      match.status === "finished" || match.status === "cancelled"
                        ? ""
                        : "\n\nWer schon getippt hat, bekommt seinen Einsatz automatisch zurück.";
                    if (confirm(`Spiel "${matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")}" wirklich entfernen?${refundNote}`)) {
                      removeMatch(match.id);
                      showToast("✓ Spiel entfernt.", "info");
                    }
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-red-400"
                >
                  Entfernen
                </button>
              </div>
            </div>
                );
              })}
            </div>
          </>
        );
      })()}
    </section>
  );
}

// Wandelt eine gespeicherte ISO-Zeit in das Format um, das
// <input type="datetime-local"> erwartet (lokale Zeit im Browser, ohne
// Zeitzone) – nötig, damit der Bearbeiten-Dialog mit dem bisherigen
// Anpfiff/Tippschluss vorausgefüllt ist statt leer zu starten.
// Prüft Anpfiff/Tippschluss vor dem Speichern.
function checkDeadline(kickoff: string, tipDeadline: string): string | null {
  const kickoffMs = new Date(kickoff).getTime();
  const deadlineMs = new Date(tipDeadline).getTime();
  if (Number.isNaN(kickoffMs) || Number.isNaN(deadlineMs)) return "Anpfiff oder Tippschluss ist kein gültiges Datum.";
  if (deadlineMs > kickoffMs) return "Der Tippschluss darf nicht nach dem Anpfiff liegen.";
  return null;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

// Übliche Anstoßzeiten – spart das mühsame Eintippen/Scrollen im nativen
// Zeit-Picker für den häufigsten Fall.
const QUICK_KICKOFF_TIMES = ["15:30", "17:30", "18:30", "20:00", "20:45"];

// Schnell-Auswahl für Anpfiff/Tippschluss: der native datetime-local-Picker
// bleibt als Fallback für genaue Werte erhalten, aber ein Tag-Button (Heute/
// Morgen/...) + ein Uhrzeit-Button reichen für den Alltag meist schon aus,
// statt sich durch Kalender und Ziffern klicken zu müssen. Tag- und
// Uhrzeit-Teil werden dabei unabhängig voneinander gesetzt – der jeweils
// andere Teil (falls schon vorhanden) bleibt erhalten.
function QuickDateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  function todayDatePart(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function setDayOffset(daysFromToday: number) {
    const base = new Date();
    base.setDate(base.getDate() + daysFromToday);
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
    const timePart = value.includes("T") ? value.split("T")[1] : "15:30";
    onChange(`${datePart}T${timePart}`);
  }

  function setTimePart(time: string) {
    const datePart = value.includes("T") ? value.split("T")[0] : todayDatePart();
    onChange(`${datePart}T${time}`);
  }

  // Nur teilweise ausgefüllt (z. B. in Safari nur die Uhrzeit, das Datum steht
  // bloß grau als Vorschlag da): das Feld liefert dann keinen Wert.
  const [incomplete, setIncomplete] = useState(false);
  function checkComplete(input: HTMLInputElement) {
    setIncomplete(input.validity.badInput || (input.value === "" && value !== ""));
  }
  useEffect(() => {
    if (value) setIncomplete(false);
  }, [value]);

  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted">{label}</label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          checkComplete(e.target);
        }}
        onInput={(e) => checkComplete(e.currentTarget)}
        onBlur={(e) => checkComplete(e.currentTarget)}
        className={`mb-1.5 w-full rounded-lg border bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold ${
          incomplete ? "border-red-400" : "border-edge"
        }`}
      />
      {incomplete && (
        <p role="alert" className="mb-1.5 text-sm text-red-300">
          Datum oder Uhrzeit fehlt noch (grau = nur Vorschlag). Tippe auf „Heute“ oder „Morgen“.
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setDayOffset(0)}
          className="rounded-lg bg-surface-hover px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
        >
          Heute
        </button>
        <button
          type="button"
          onClick={() => setDayOffset(1)}
          className="rounded-lg bg-surface-hover px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
        >
          Morgen
        </button>
        <button
          type="button"
          onClick={() => setDayOffset(7)}
          className="rounded-lg bg-surface-hover px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
        >
          +1 Woche
        </button>
        <span className="mx-0.5 w-px self-stretch bg-edge" />
        {QUICK_KICKOFF_TIMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTimePart(t)}
            className="rounded-lg bg-surface-hover px-2.5 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
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
      homeJersey?: MatchJersey;
      awayJersey?: MatchJersey;
    }
  ) => void;
}) {
  const { showToast } = useFeedback();
  const { matches } = useAppData();
  const [editing, setEditing] = useState(false);
  const [competition, setCompetition] = useState(match.competition);
  const [matchday, setMatchday] = useState(match.matchday ? String(match.matchday) : "");
  const [kickoff, setKickoff] = useState(() => toLocalInputValue(match.kickoff));
  const [tipDeadline, setTipDeadline] = useState(() => toLocalInputValue(match.tipDeadline));
  // Stand Tippschluss = Anpfiff, zieht er beim Verschieben des Anpfiffs mit.
  const [deadlineFollowsKickoff, setDeadlineFollowsKickoff] = useState(
    () => toLocalInputValue(match.tipDeadline) === toLocalInputValue(match.kickoff)
  );
  const [homeTeamId, setHomeTeamId] = useState(match.homeTeamId);
  const [awayTeamId, setAwayTeamId] = useState(match.awayTeamId);
  const [homeJersey, setHomeJersey] = useState<MatchJersey | undefined>(match.homeJersey);
  const [awayJersey, setAwayJersey] = useState<MatchJersey | undefined>(match.awayJersey);

  const teamsForSport = teams.filter((t) => t.sport === match.sport);
  const homeTeam = teamsForSport.find((t) => t.id === homeTeamId);
  const awayTeam = teamsForSport.find((t) => t.id === awayTeamId);

  function handleSave() {
    if (!competition.trim() || !kickoff || !tipDeadline || !homeTeamId || !awayTeamId) {
      showToast("Bitte Wettbewerb, Teams, Anpfiff und Tippschluss ausfüllen.", "info");
      return;
    }
    if (homeTeamId === awayTeamId) return;
    const deadlineProblem = checkDeadline(kickoff, tipDeadline);
    if (deadlineProblem) {
      showToast(deadlineProblem, "info");
      return;
    }
    // Ohne Browser-Dialog (kann stumm unterdrückt werden): Änderungen lassen
    // sich jederzeit wieder bearbeiten, ein vorbeier Tippschluss wird nur gemeldet.
    const deadlineInPast =
      tipDeadline !== toLocalInputValue(match.tipDeadline) && new Date(tipDeadline).getTime() <= Date.now();
    if (match.booster && boostersOnDay(matches, new Date(kickoff).toISOString(), match.id) >= BOOSTERS_PER_DAY) {
      showToast(`Am neuen Tag gibt es schon ${BOOSTERS_PER_DAY} Booster-Spiele – erst dort einen ausschalten.`, "info");
      return;
    }
    onSave(match.id, {
      competition: competition.trim(),
      matchday: matchday ? Number(matchday) : undefined,
      kickoff: new Date(kickoff).toISOString(),
      tipDeadline: new Date(tipDeadline).toISOString(),
      homeTeamId,
      awayTeamId,
      homeJersey,
      awayJersey,
    });
    setEditing(false);
    showToast(
      deadlineInPast
        ? "✓ Gespeichert – aber der Tippschluss ist schon vorbei, Spieler sehen das Spiel nur unter „Geschlossene Tipps“."
        : "✓ Spieldaten gespeichert.",
      deadlineInPast ? "info" : "success"
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setEditing((v) => !v)}
        className="min-w-[9rem] rounded-lg bg-surface-hover px-3 py-2.5 text-base font-semibold text-ink transition-colors hover:text-gold"
      >
        Bearbeiten
      </button>

      {editing && (
        <div className="w-full rounded-lg border border-edge bg-pitch p-4">
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm text-muted">Wettbewerb</label>
              <CompetitionSelect sport={match.sport} value={competition} onChange={setCompetition} compact />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">Spieltag (optional)</label>
              <input
                type="number"
                value={matchday}
                onChange={(e) => setMatchday(e.target.value)}
                className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">{teamFieldLabel(match.sport, "home")}</label>
              <TeamPicker
                teams={teamsForSport}
                value={homeTeamId}
                onChange={(id) => {
                  setHomeTeamId(id);
                  setHomeJersey(undefined);
                }}
                otherTeamId={awayTeamId}
                otherLabel="schon als Auswärtsteam gewählt" compact
              />
              {homeTeam && (
                <JerseyPicker team={homeTeam} value={jerseyFor(homeTeam, homeJersey)} onChange={setHomeJersey} />
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-muted">{teamFieldLabel(match.sport, "away")}</label>
              <TeamPicker
                teams={teamsForSport}
                value={awayTeamId}
                onChange={(id) => {
                  setAwayTeamId(id);
                  setAwayJersey(undefined);
                }}
                otherTeamId={homeTeamId}
                otherLabel="schon als Heimteam gewählt" compact
              />
              {awayTeam && (
                <JerseyPicker team={awayTeam} value={jerseyFor(awayTeam, awayJersey)} onChange={setAwayJersey} />
              )}
            </div>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickDateTimeField
              label="Anpfiff"
              value={kickoff}
              onChange={(v) => {
                setKickoff(v);
                if (deadlineFollowsKickoff && v) setTipDeadline(v);
              }}
            />
            <QuickDateTimeField
              label="Tippschluss"
              value={tipDeadline}
              onChange={(v) => {
                setTipDeadline(v);
                setDeadlineFollowsKickoff(v === kickoff);
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-action px-3 py-1.5 text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              Speichern
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-edge px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Fasst Tipp-Art, TV-Sender und Video-Link in EINEM Editor mit EINEM
// "Speichern"-Button zusammen – vorher brauchte jedes einzelne Feld einen
// eigenen Klick auf "Speichern", was bei drei Feldern in Folge lästig war.
function MatchExtrasEditor({
  match,
  onSaveTipMode,
  onSaveTvChannel,
  onSaveVideoUrl,
}: {
  match: Match;
  onSaveTipMode: (matchId: string, mode: TipMode) => void;
  onSaveTvChannel: (matchId: string, channel: string) => void;
  onSaveVideoUrl: (matchId: string, url: string) => void;
}) {
  const { showToast } = useFeedback();
  const [tipMode, setTipMode] = useState<TipMode>(match.tipMode);
  const [tvChannel, setTvChannel] = useState(match.tvChannel ?? "");
  const [videoUrl, setVideoUrl] = useState(match.summaryVideoUrl ?? "");

  const tipModeChanged = tipMode !== match.tipMode;
  const tvChannelChanged = tvChannel.trim() !== (match.tvChannel ?? "");
  const videoUrlChanged = videoUrl.trim() !== (match.summaryVideoUrl ?? "");
  const hasChanges = tipModeChanged || tvChannelChanged || videoUrlChanged;

  function handleSave() {
    if (tipModeChanged && !confirm("Tipp-Art für dieses Spiel wirklich ändern?")) return;
    if (tipModeChanged) onSaveTipMode(match.id, tipMode);
    if (tvChannelChanged) onSaveTvChannel(match.id, tvChannel.trim());
    if (videoUrlChanged) onSaveVideoUrl(match.id, videoUrl.trim());
    showToast("✓ Gespeichert.", "success");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={tipMode}
        onChange={(e) => setTipMode(e.target.value as TipMode)}
        className="min-w-[12rem] rounded-lg border border-edge bg-pitch px-3 py-2.5 text-base text-ink outline-none focus:border-gold"
        title="Tipp-Art für dieses Spiel"
      >
        <option value="score">Ergebnis-Tipp</option>
        <option value="1x2">1X2</option>
      </select>
      <input
        value={tvChannel}
        onChange={(e) => setTvChannel(e.target.value)}
        placeholder="TV-Sender"
        className="w-44 rounded-lg border border-edge bg-pitch px-3 py-2.5 text-base text-ink outline-none focus:border-gold"
      />
      <input
        type="url"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="YouTube-Link zur Zusammenfassung"
        className="w-60 rounded-lg border border-edge bg-pitch px-3 py-2.5 text-base text-ink outline-none focus:border-gold"
      />
      {hasChanges && (
        <button
          onClick={handleSave}
          className="min-w-[8rem] rounded-lg bg-action px-3 py-2.5 text-base font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Speichern
        </button>
      )}
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
        className={`min-w-[9rem] rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
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
              title="Coin-Bonus bei richtiger Antwort"
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

// Statt eines Status-Dropdowns (bei dem leicht vergessen wird, es auch
// wirklich auf "Beendet" umzustellen) gibt es jetzt klar benannte Buttons:
// "Spiel beenden" ist die Standard-Aktion und macht sofort, was der Name
// sagt – Endstand setzen UND auswerten. "Nur Zwischenstand speichern" ist
// die Ausnahme für einen Live-Spielstand, der das Spiel noch nicht beendet.
// Bei US-Sport steht im Feldnamen dazu, wo das Team später angezeigt wird.
function teamFieldLabel(sport: string, side: "home" | "away") {
  if (!isAwayFirst(sport)) return side === "home" ? "Heimteam" : "Auswärtsteam";
  return side === "home" ? "Heimteam (steht rechts)" : "Gastteam (steht links)";
}

function LiveScoreEditor({
  match,
  homeName,
  awayName,
  onUpdate,
}: {
  match: Match;
  homeName: string;
  awayName: string;
  onUpdate: (matchId: string, homeScore: number | null, awayScore: number | null, status: MatchStatus) => void;
}) {
  const { showToast } = useFeedback();
  const [homeScore, setHomeScore] = useState(match.liveHomeScore ?? 0);
  const [awayScore, setAwayScore] = useState(match.liveAwayScore ?? 0);
  const alreadyFinished = match.status === "finished";

  function handleFinish() {
    const verb = alreadyFinished ? "korrigieren" : "festlegen";
    // Mit Teamnamen, weil US-Ergebnisse meist den Gast zuerst nennen – ein
    // vertauschter Endstand würde die ganze Wertung umdrehen.
    const scoreLine = isAwayFirst(match.sport)
      ? `${awayName} ${awayScore} : ${homeScore} ${homeName}`
      : `${homeName} ${homeScore} : ${awayScore} ${awayName}`;
    if (!confirm(`Endstand ${scoreLine} ${verb} und Tipps auswerten?`)) return;
    onUpdate(match.id, homeScore, awayScore, "finished");
    showToast("✓ Endstand gespeichert – Tipps wurden ausgewertet.", "gold");
  }

  const homeField = (
    <label className="flex w-24 flex-col items-center gap-1">
      <span className="text-center text-xs font-semibold leading-tight text-muted [overflow-wrap:normal]">{homeName}</span>
      <ScoreInput
        value={homeScore}
        onChange={setHomeScore}
        max={999}
        label={`Endstand ${homeName}`}
        className="w-16 rounded-lg border border-edge bg-pitch px-2 py-2.5 text-center text-base text-ink outline-none focus:border-gold"
      />
    </label>
  );
  const awayField = (
    <label className="flex w-24 flex-col items-center gap-1">
      <span className="text-center text-xs font-semibold leading-tight text-muted [overflow-wrap:normal]">{awayName}</span>
      <ScoreInput
        value={awayScore}
        onChange={setAwayScore}
        max={999}
        label={`Endstand ${awayName}`}
        className="w-16 rounded-lg border border-edge bg-pitch px-2 py-2.5 text-center text-base text-ink outline-none focus:border-gold"
      />
    </label>
  );

  function handleSaveLive() {
    onUpdate(match.id, homeScore, awayScore, "live");
    showToast("✓ Zwischenstand gespeichert.", "success");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Teamnamen direkt über den Feldern: welches Feld zu welchem Team
          gehört, ist so auch bei US-Spielen (dort steht der Gast meist
          zuerst) eindeutig. */}
      <div className="flex items-end gap-2">
        {isAwayFirst(match.sport) ? (
          <>
            {awayField}
            <span className="pb-2.5 text-base text-muted">:</span>
            {homeField}
          </>
        ) : (
          <>
            {homeField}
            <span className="pb-2.5 text-base text-muted">:</span>
            {awayField}
          </>
        )}
      </div>
      <button
        onClick={handleFinish}
        title={
          alreadyFinished
            ? "Endstand erneut übernehmen korrigiert die bereits vergebenen Rangpunkte/Coins."
            : undefined
        }
        className="min-w-[9rem] rounded-lg bg-action px-3 py-2.5 text-base font-semibold text-pitch transition-colors hover:bg-action-hover"
      >
        {alreadyFinished ? "Endstand korrigieren" : "Spiel beenden"}
      </button>
      {!alreadyFinished && (
        <button
          onClick={handleSaveLive}
          className="rounded-lg bg-surface-hover px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          Nur Zwischenstand speichern
        </button>
      )}
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
      <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Turniere</h2>
      <p className="mb-4 text-sm text-muted">
        Zeitlich begrenzter Sonder-Bereich (z. B. WM, EM), der eine Auswahl bestehender Spiele
        bündelt und eine eigene, öffentliche Mini-Rangliste zeigt. Spiele werden unten je Turnier
        einzeln zugeordnet.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-4 rounded-card border border-edge bg-surface p-5 sm:p-6"
      >
        <h3 className="font-display text-base font-semibold text-ink">Neues Turnier anlegen</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Weltmeisterschaft 2026"
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Icon (Emoji)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🏆"
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Start</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="mb-1.5 block text-sm text-muted">Beschreibung (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurzer Hinweis, worum es bei diesem Turnier geht"
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Ende</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-4 py-3 text-base text-ink outline-none focus:border-gold"
            />
          </div>
        </div>
        <button
          type="submit"
          className="self-start rounded-full bg-action px-6 py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Turnier anlegen
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {tournaments.length === 0 && (
          <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
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
    <div className="rounded-card border border-edge bg-surface p-4 sm:p-5">
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-3xl">{tournament.icon}</span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-ink">{tournament.name}</p>
              {tournament.description && (
                <p className="truncate text-sm text-muted">{tournament.description}</p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tournamentStatusClass[status]}`}
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
                  {matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")}
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

// Booster-Spiel beim Anlegen: fester Einsatz 20 Sterne, höchstens 3 pro Tag
// (Anpfiff-Tag in Österreich). Alle anderen Spiele sind gratis.
function BoosterCheckbox({
  checked,
  onChange,
  taken,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  taken: number;
}) {
  const full = !checked && taken >= BOOSTERS_PER_DAY;
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        checked ? "border-gold/60 bg-gold/10" : "border-edge bg-pitch"
      } ${full ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={full}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-gold))]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">⚡ Booster-Spiel</span>
        <span className="block text-xs text-muted">
          {full
            ? `An diesem Tag gibt es schon ${BOOSTERS_PER_DAY} Booster.`
            : `${BOOSTER_STAKE} Coins Einsatz, ohne Haken gratis. Schon ${taken} von ${BOOSTERS_PER_DAY} an diesem Tag.`}
        </span>
      </span>
    </label>
  );
}

// Booster in der Spieleliste an- oder ausschalten.
function BoosterToggleButton({
  match,
  matches,
  onToggle,
}: {
  match: Match;
  matches: Match[];
  onToggle: (matchId: string, booster: boolean) => void;
}) {
  const { showToast } = useFeedback();
  const on = !!match.booster;

  function handleClick() {
    if (!on && boostersOnDay(matches, match.kickoff, match.id) >= BOOSTERS_PER_DAY) {
      showToast(`An diesem Tag gibt es schon ${BOOSTERS_PER_DAY} Booster-Spiele.`, "info");
      return;
    }
    const text = on
      ? "Booster ausschalten? Neue Tipps sind dann gratis."
      : `Zum Booster machen? Neue Tipps kosten dann ${BOOSTER_STAKE} Coins Einsatz.`;
    if (!confirm(`${text}\n\nWer schon getippt hat, behält seinen bisherigen Einsatz.`)) return;
    onToggle(match.id, !on);
    showToast(on ? "✓ Booster ausgeschaltet." : "✓ Booster eingeschaltet.", "success");
  }

  return (
    <button
      onClick={handleClick}
      className={`min-w-[9rem] rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
        on ? "border border-gold/60 bg-gold/15 text-gold hover:bg-gold/25" : "bg-surface-hover text-ink hover:text-gold"
      }`}
    >
      {on ? "⚡ Booster aus" : "⚡ Booster an"}
    </button>
  );
}
