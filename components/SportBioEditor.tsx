"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { RankIconOption } from "@/lib/rankTiers";
import { SavedHint } from "@/components/SaveButton";
import { SportCard } from "@/components/SportBioCard";
import CardPhotoEditor from "@/components/CardPhotoEditor";
import {
  BIO_SPORTS,
  BioData,
  BioVisibility,
  CARD_STYLES,
  CardStyle,
  CLUB_MAX,
  COUNTRIES,
  FAV_MAX,
  Honor,
  honorIcon,
  HONOR_TYPES,
  MAX_HONORS,
  MAX_INTERESTS,
  sortedHonors,
  isFanRole,
  leaguesFor,
  PLAYING_ROLES,
  POSITIONS,
  ROLE_CATS,
  roleDef,
  saveSportBio,
  SportBio,
  Station,
  stationPlace,
  stationTitle,
  stationYears,
} from "@/lib/sportBio";

const MAX_STATIONS = 15;

// Profil -> Einstellungen -> "Deine Sportlerkarte": Laufbahn-Stationen,
// Erfolge, Karte (Nummer, Farben, Edition), Sichtbarkeit. Jede Auswahl
// speichert sofort, Textfelder beim Verlassen. Oben läuft die Karte als
// Live-Vorschau mit. Anzeige im Profil: components/SportBioCard.tsx.
export default function SportBioEditor({
  userId,
  name,
  photo,
  rankIcon,
  place,
  points,
  bio,
  unavailable,
  onSaved,
}: {
  userId: string;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
  points?: number | null;
  bio: SportBio | null;
  unavailable: boolean;
  onSaved: () => void;
}) {
  const { teams } = useAppData();
  const { hasPremiumPass, photos } = useUser();
  const [data, setData] = useState<BioData>(bio?.data ?? {});
  const [visibility, setVisibility] = useState<BioVisibility>(bio?.visibility ?? "friends");
  const [saved, setSaved] = useState(false);
  const [savedWhere, setSavedWhere] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const touched = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Geladener Steckbrief kommt nach: übernehmen, solange man nichts geändert
  // hat. Danach nur noch den Prüf-Stand der Vereine (kommt vom Server).
  useEffect(() => {
    if (!bio) return;
    if (!touched.current) {
      setData(bio.data);
      setVisibility(bio.visibility);
      return;
    }
    setData((cur) => ({
      ...cur,
      stations: (cur.stations ?? []).map((st, i) => {
        const server = bio.data.stations?.[i];
        return server && server.club === st.club ? { ...st, clubApproved: server.clubApproved } : st;
      }),
    }));
  }, [bio]);

  const clubNames = useMemo(() => Array.from(new Set(teams.map((t) => t.name))).sort((a, b) => a.localeCompare(b, "de")), [teams]);
  const knownClub = (club?: string) => !!club && clubNames.some((n) => n.toLowerCase() === club.toLowerCase());

  // where: welcher Bereich gespeichert hat – dort erscheint "✓ Gespeichert"
  // (Rene, 20.10.2026: man soll sehen, was übernommen wurde).
  async function commit(nextData: BioData, nextVis: BioVisibility = visibility, where = "") {
    touched.current = true;
    setData(nextData);
    setVisibility(nextVis);
    setSaved(false);
    setSavedWhere(where);
    const err = await saveSportBio(userId, nextData, nextVis);
    setError(err);
    if (err) return false;
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2500);
    onSaved();
    return true;
  }
  const savedAt = (where: string) => saved && savedWhere === where;

  // Stationen bearbeitet man in einem Entwurf: erst "Speichern" übernimmt
  // ihn, "Abbrechen" verwirft ihn (Rene, 20.10.2026: vorher wusste man nicht,
  // was schon übernommen ist). index null = neue Station.
  const stations = data.stations ?? [];
  const [editing, setEditing] = useState<{ index: number | null; draft: Station } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  function setStations(next: Station[], where = "laufbahn") {
    return commit({ ...data, stations: next }, visibility, where);
  }
  function patchDraft(p: Partial<Station>) {
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));
  }
  async function saveDraft() {
    if (!editing) return;
    const d = editing.draft;
    setDraftError(null);
    // Keine Jahreszahlen mehr (Rene, 20.10.2026: am Anfang unkompliziert).
    const clean: Station = { ...d, club: d.club?.trim() || undefined, from: undefined, to: undefined };
    const next = editing.index === null ? [...stations, clean] : stations.map((st, j) => (j === editing.index ? clean : st));
    if (await setStations(next)) setEditing(null);
  }

  if (unavailable) {
    return (
      <section id="steckbrief" className="mb-8 scroll-mt-48">
        <h2 className="font-display text-lg font-semibold text-ink">Deine Sportlerkarte</h2>
        <p className="mt-1 text-xs text-muted">⚠️ Kommt gleich – es fehlt noch ein Datenbank-Update.</p>
      </section>
    );
  }

  // Vorschau zeigt auch den Entwurf, den man gerade bearbeitet.
  const previewStations = editing
    ? editing.index === null
      ? [...stations, editing.draft]
      : stations.map((st, j) => (j === editing.index ? editing.draft : st))
    : stations;
  const preview: SportBio = { data: { ...data, stations: previewStations }, verified: bio?.verified ?? false, visibility };
  const hasKnownClub = stations.some((st) => knownClub(st.club));
  const style = data.cardStyle ?? "standard";

  return (
    <section id="steckbrief" className="mb-8 scroll-mt-48">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">🃏 Deine Sportlerkarte</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Was hast du selbst mit Sport zu tun? Deine Karte gibt es pro Sportart, mit deinem Rang und deiner Tipp-Statistik. Laufbahn
        und Erfolge sind „eigene Angaben“ und bringen keine Punkte, „✓ bestätigt“ kann nur der Admin setzen. Kaufen kannst du eine
        Karte bald, frühestens ab 500 getippten Spielen in der Sportart. Sie wird gedruckt und dir nach Hause geschickt.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {previewStations.length > 0 && (
        <div className="mt-4">
          <SportCard bio={preview} own userId={userId} name={name} photo={photo} rankIcon={rankIcon} place={place} points={points} />
          <p className="mt-1 text-center text-[11px] text-muted">Vorschau</p>
        </div>
      )}

      <Card
        title="Deine Laufbahn"
        text="Jede Station: was, welche Sportart, wo, von wann bis wann. Die oberste ist deine Hauptrolle auf der Karte."
        saved={savedAt("laufbahn")}
      >
        <div className="mt-3 flex flex-col gap-2">
          {stations.map((st, i) =>
            editing?.index === i ? (
              <StationEditor
                key={i}
                st={editing.draft}
                isMain={i === 0}
                known={knownClub(editing.draft.club)}
                error={draftError}
                onPatch={patchDraft}
                onSave={saveDraft}
                onCancel={() => {
                  setEditing(null);
                  setDraftError(null);
                }}
              />
            ) : (
              <div key={i} className="flex flex-col gap-2 rounded-card border border-edge bg-pitch px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-ink">
                    {roleDef(st.role).icon} {stationTitle(st)}
                    {i === 0 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-gold">Hauptrolle</span>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {[bioSportLabel(st.sport), stationPlace(st), stationYears(st)].filter(Boolean).join(" · ") || "Noch keine Details"}
                  </p>
                </div>
                {confirmDelete === i ? (
                  <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted">Wirklich löschen?</span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (await setStations(stations.filter((_, j) => j !== i))) setConfirmDelete(null);
                      }}
                      className="rounded-full bg-red-500/90 px-3 py-1 font-semibold text-white hover:bg-red-500"
                    >
                      Ja, löschen
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-full border border-edge px-3 py-1 text-muted hover:text-ink">
                      Nein
                    </button>
                  </span>
                ) : (
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {i > 0 && (
                      <SmallButton disabled={!!editing} onClick={() => setStations(swap(stations, i - 1, i))} label="Nach oben">
                        ↑
                      </SmallButton>
                    )}
                    <SmallButton
                      disabled={!!editing}
                      onClick={() => {
                        setConfirmDelete(null);
                        setDraftError(null);
                        setEditing({ index: i, draft: st });
                      }}
                    >
                      ✏️ Bearbeiten
                    </SmallButton>
                    <SmallButton disabled={!!editing} onClick={() => setConfirmDelete(i)}>
                      🗑️ Löschen
                    </SmallButton>
                  </span>
                )}
              </div>
            )
          )}
          {editing?.index === null && (
            <StationEditor
              st={editing.draft}
              isNew
              isMain={stations.length === 0}
              known={knownClub(editing.draft.club)}
              error={draftError}
              onPatch={patchDraft}
              onSave={saveDraft}
              onCancel={() => {
                setEditing(null);
                setDraftError(null);
              }}
            />
          )}
        </div>
        <datalist id="sport-bio-clubs">
          {clubNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {stations.length < MAX_STATIONS && !editing && (
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="mt-3 rounded-full bg-gold px-4 py-2 font-display text-sm font-bold text-pitch transition-opacity hover:opacity-90"
          >
            {picking ? "Schließen" : "+ Station hinzufügen"}
          </button>
        )}
        {picking && !editing && (
          <div className="mt-3 flex flex-col gap-3 rounded-card border border-dashed border-edge p-3">
            <p className="text-xs text-muted">Was warst oder bist du? Danach füllst du die Details aus und speicherst.</p>
            {ROLE_CATS.map(([cat, roles]) => (
              <div key={cat}>
                <p className="font-display text-xs font-bold text-ink">{cat}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {roles.map((r) => (
                    <Chip
                      key={r.key}
                      small
                      active={false}
                      onClick={() => {
                        setPicking(false);
                        setDraftError(null);
                        setEditing({ index: null, draft: { role: r.key, ex: false, sport: "fb", land: isFanRole(r.key) ? undefined : "AT" } });
                      }}
                    >
                      <span aria-hidden>{r.icon}</span>
                      {r.label}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Erfolge" text="Was, auf welchem Niveau und mit welchem Verein. Stehen auf der Rückseite deiner Karte." saved={savedAt("erfolge")}>
        <HonorsEditor
          honors={data.honors ?? []}
          clubs={Array.from(new Set(stations.map((st) => st.club).filter((c): c is string => !!c)))}
          leagues={leaguesFor(stations[0]?.sport, stations[0]?.land)}
          onChange={(honors) => commit({ ...data, honors }, visibility, "erfolge")}
        />
      </Card>

      <Card
        title="Interessen"
        text="Andere Sportarten, die du verfolgst oder selbst machst. Antippen speichert sofort. Lieblingsverein oder Sportler optional (wird vom Admin geprüft)."
        saved={savedAt("interessen")}
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {BIO_SPORTS.map((sp) => {
            const on = (data.interests ?? []).some((i) => i.k === sp.key);
            const full = !on && (data.interests ?? []).length >= MAX_INTERESTS;
            return (
              <Chip
                key={sp.key}
                small
                active={on}
                onClick={() =>
                  !full &&
                  commit(
                    {
                      ...data,
                      interests: on ? (data.interests ?? []).filter((i) => i.k !== sp.key) : [...(data.interests ?? []), { k: sp.key }],
                    },
                    visibility,
                    "interessen"
                  )
                }
              >
                <span aria-hidden>{sp.icon}</span>
                {sp.label}
              </Chip>
            );
          })}
        </div>
        {(data.interests ?? []).length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {(data.interests ?? []).map((it) => (
              <FavRow
                key={it.k}
                label={bioSportLabel(it.k)}
                value={it.fav ?? ""}
                onSave={(fav) =>
                  commit(
                    { ...data, interests: (data.interests ?? []).map((i) => (i.k === it.k ? { ...i, fav: fav || undefined } : i)) },
                    visibility,
                    "interessen"
                  )
                }
              />
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Kartenfoto"
        text="Eigenes Foto für die Karte, z. B. im Vereinsdress. Ausschnitt verschieben und zoomen. Sieht jeder, der deine Karte sehen darf."
        saved={savedAt("foto")}
      >
        <CardPhotoEditor
          current={data.photo}
          profilePhotos={photos.filter((p): p is string => !!p && p.startsWith("data:image"))}
          onSave={(url) => commit({ ...data, photo: url }, visibility, "foto")}
          onReset={() => commit({ ...data, photo: undefined }, visibility, "foto")}
        />
        {/* Nur Hinweis, noch nicht kaufbar (Rene, 20.10.2026). */}
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed border-gold/40 bg-gold/[0.06] p-3">
          <span aria-hidden className="text-xl">🛒</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              Karte kaufen <span className="ml-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">Bald</span>
            </p>
            <p className="text-xs text-muted">
              Kaufen kann man eine Karte später frühestens ab 500 getippten Spielen (pro Sportart) und nur mit einem klar erkennbaren
              eigenen Gesicht. Du stellst einen Antrag, PoolTipp prüft das Foto und gibt frei. Die gekaufte Karte wird gedruckt und dir nach Hause
              geschickt, die Statistik darauf zählt von deinem ersten Tipp bis zum Kauf. Im Profil kannst du dein Kartenfoto weiter jederzeit tauschen.
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Karte"
        text="Rückennummer und Edition. Die Kartenfarben kommen von deinem Verein oder von deinem Rang (Rene, 20.10.2026: Farben muss man sich verdienen)."
        saved={savedAt("karte")}
      >
        <div className="mt-3 max-w-[12rem]">
          <Field label="Rückennummer">
            <TextInput
              value={data.nr ?? ""}
              maxLength={2}
              numeric
              placeholder="z. B. 10"
              onCommit={(v) => v !== (data.nr ?? "") && commit({ ...data, nr: v || undefined }, visibility, "karte")}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Edition</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARD_STYLES.map((c) => {
            const locked = c.premium && !hasPremiumPass;
            return locked ? (
              <Link
                key={c.key}
                href="/fortschritt"
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-pitch px-3 py-1 font-display text-xs font-semibold text-muted opacity-70 hover:opacity-100"
              >
                🔒 {c.label}
              </Link>
            ) : (
              <Chip key={c.key} small active={style === c.key} onClick={() => commit({ ...data, cardStyle: c.key as CardStyle }, visibility, "karte")}>
                {c.label}
              </Chip>
            );
          })}
        </div>
        {!hasPremiumPass && <p className="mt-2 text-[11px] text-muted">Holo, Gold- und Saison-Edition gibt es mit dem Premium-Pass.</p>}
      </Card>

      <Card title="Wer sieht deine Karte?" text="Du siehst sie immer. Antippen speichert sofort." saved={savedAt("sicht")}>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["public", "👁️ Alle"],
              ["friends", "👥 Nur Freunde"],
              ["private", "🔒 Niemand"],
            ] as [BioVisibility, string][]
          ).map(([v, l]) => (
            <Chip key={v} active={visibility === v} onClick={() => commit(data, v, "sicht")}>
              {l}
            </Chip>
          ))}
        </div>
      </Card>
    </section>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function StationEditor({
  st,
  isNew = false,
  isMain,
  known,
  error,
  onPatch,
  onSave,
  onCancel,
}: {
  st: Station;
  isNew?: boolean;
  isMain: boolean;
  known: boolean;
  error: string | null;
  onPatch: (p: Partial<Station>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const fan = isFanRole(st.role);
  const country = st.land ? COUNTRIES[st.land] : undefined;
  const positions = !fan && PLAYING_ROLES.includes(st.role) ? POSITIONS[st.sport ?? ""] : undefined;
  const pending = !!st.club && !known && st.clubApproved !== true;
  return (
    <div className="flex flex-col gap-3 rounded-card border-2 border-gold/60 bg-pitch p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 font-display text-[15px] font-bold text-ink">
          {roleDef(st.role).icon} {stationTitle(st)}
          {isMain && <span className="ml-2 font-display text-[10px] font-bold uppercase tracking-wider text-gold">Hauptrolle</span>}
        </p>
        <span className="shrink-0 rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
          {isNew ? "Neu · noch nicht gespeichert" : "Wird bearbeitet"}
        </span>
      </div>
      {!fan && (
        <div className="flex flex-wrap gap-1.5">
          <Chip small active={!st.ex} onClick={() => onPatch({ ex: false })}>
            Aktiv
          </Chip>
          <Chip small active={st.ex} onClick={() => onPatch({ ex: true })}>
            Ehemalig
          </Chip>
        </div>
      )}
      <Field label="Sportart">
        <div className="flex flex-wrap gap-1.5">
          {BIO_SPORTS.map((s) => (
            <Chip key={s.key} small active={st.sport === s.key} onClick={() => onPatch({ sport: s.key, pos: undefined, league: undefined })}>
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </Chip>
          ))}
        </div>
      </Field>
      {positions && (
        <Field label="Position">
          <div className="flex flex-wrap gap-1.5">
            {positions.map((p) => (
              <Chip key={p} small active={st.pos === p} onClick={() => onPatch({ pos: st.pos === p ? undefined : p })}>
                {p}
              </Chip>
            ))}
          </div>
        </Field>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {!fan && (
          <>
            <Field label="Land">
              <select
                value={st.land ?? ""}
                onChange={(e) => onPatch({ land: e.target.value || undefined, bl: undefined, league: undefined })}
                className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">–</option>
                {Object.entries(COUNTRIES).map(([k, c]) => (
                  <option key={k} value={k}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bundesland / Region">
              <select
                value={st.bl ?? ""}
                disabled={!country || country.states.length === 0}
                onChange={(e) => onPatch({ bl: e.target.value || undefined })}
                className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
                <option value="">–</option>
                {(country?.states ?? []).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label={fan ? "Lieblingsverein" : "Verein"}>
          <input
            value={st.club ?? ""}
            maxLength={CLUB_MAX}
            list="sport-bio-clubs"
            placeholder="Verein …"
            onChange={(e) => onPatch({ club: e.target.value || undefined, clubApproved: undefined })}
            className={INPUT}
          />
          {pending && <p className="mt-1 text-[11px] text-gold">⏳ Wird vom Admin geprüft, bis dahin sehen andere den Verein nicht.</p>}
        </Field>
      </div>
      {!fan && (
        <div className="max-w-xs">
          <Field label="Niveau">
            <select
              value={st.league ?? ""}
              onChange={(e) => onPatch({ league: e.target.value || undefined })}
              className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">–</option>
              {leaguesFor(st.sport, st.land).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-edge pt-3">
        <button
          type="button"
          onClick={onSave}
          className="rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          {isNew ? "Station speichern" : "Änderungen speichern"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-edge px-5 py-2 text-sm text-muted hover:text-ink">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted";

function SmallButton({
  onClick,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-edge px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-gold/60 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function bioSportLabel(key?: string): string {
  const s = BIO_SPORTS.find((x) => x.key === key);
  return s ? `${s.icon} ${s.label}` : "";
}

// Erfolge: Liste mit Löschen (mit Rückfrage) und Formular "Erfolg speichern".
// Der Verein kommt aus der eigenen Laufbahn (kein neuer Freitext).
function HonorsEditor({
  honors,
  clubs,
  leagues,
  onChange,
}: {
  honors: Honor[];
  clubs: string[];
  leagues: string[];
  onChange: (honors: Honor[]) => Promise<boolean>;
}) {
  const [t, setT] = useState(HONOR_TYPES[0].t);
  const [league, setLeague] = useState("");
  const [club, setClub] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const list = sortedHonors({ honors });

  async function add() {
    setErr(null);
    const h: Honor = { t };
    if (league) h.league = league;
    if (club) h.club = club;
    if (await onChange([...honors, h])) {
      setLeague("");
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {list.map((h) => {
        const idx = honors.indexOf(h);
        return (
          <div key={idx} className="flex flex-col gap-2 rounded-lg border border-edge bg-pitch px-3 py-2 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 text-sm text-ink">
              {honorIcon(h.t)} <b>{h.t}</b>
              {h.league ? ` · ${h.league}` : ""}
              <span className="text-muted">{h.club ? ` · ${h.club}` : ""}</span>
            </p>
            {confirmIdx === idx ? (
              <span className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">Wirklich löschen?</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (await onChange(honors.filter((_, j) => j !== idx))) setConfirmIdx(null);
                  }}
                  className="rounded-full bg-red-500/90 px-3 py-1 font-semibold text-white hover:bg-red-500"
                >
                  Ja, löschen
                </button>
                <button type="button" onClick={() => setConfirmIdx(null)} className="rounded-full border border-edge px-3 py-1 text-muted hover:text-ink">
                  Nein
                </button>
              </span>
            ) : (
              <SmallButton onClick={() => setConfirmIdx(idx)}>🗑️ Löschen</SmallButton>
            )}
          </div>
        );
      })}
      {honors.length < MAX_HONORS && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-edge p-3">
          <p className="text-xs font-semibold text-muted">Neuer Erfolg</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <select value={t} onChange={(e) => setT(e.target.value)} aria-label="Art des Erfolgs" className={INPUT}>
              {HONOR_TYPES.map((h) => (
                <option key={h.t} value={h.t}>
                  {h.icon} {h.t}
                </option>
              ))}
            </select>
            <select value={league} onChange={(e) => setLeague(e.target.value)} aria-label="Niveau" className={INPUT}>
              <option value="">Niveau (optional)</option>
              {leagues.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select value={club} onChange={(e) => setClub(e.target.value)} aria-label="Verein" className={INPUT}>
              <option value="">{clubs.length ? "Mit welchem Verein?" : "Verein (erst in Laufbahn eintragen)"}</option>
              {clubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button
            type="button"
            onClick={add}
            className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch hover:bg-action-hover"
          >
            Erfolg speichern
          </button>
        </div>
      )}
    </div>
  );
}

// Lieblingsverein/-sportler zu einem Interesse, mit eigenem Speichern-Knopf.
function FavRow({ label, value, onSave }: { label: string; value: string; onSave: (fav: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const dirty = text.trim() !== value;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-edge bg-pitch px-3 py-2 sm:flex-row sm:items-center">
      <span className="shrink-0 text-sm text-ink sm:w-36">{label}</span>
      <input
        value={text}
        maxLength={FAV_MAX}
        list="sport-bio-clubs"
        placeholder="Lieblingsverein oder Sportler (optional)"
        onChange={(e) => setText(e.target.value)}
        className={`${INPUT} min-w-0 flex-1`}
      />
      <button
        type="button"
        disabled={!dirty}
        onClick={() => onSave(text.trim())}
        className="shrink-0 rounded-full bg-action px-4 py-1.5 text-xs font-semibold text-pitch hover:bg-action-hover disabled:cursor-default disabled:bg-transparent disabled:text-muted disabled:ring-1 disabled:ring-edge"
      >
        Speichern
      </button>
    </div>
  );
}

function TextInput({
  value,
  maxLength,
  numeric = false,
  list,
  placeholder,
  onCommit,
}: {
  value: string;
  maxLength: number;
  numeric?: boolean;
  list?: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      value={text}
      list={list}
      maxLength={maxLength}
      inputMode={numeric ? "numeric" : undefined}
      placeholder={placeholder}
      onChange={(e) => setText(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
      onBlur={() => onCommit(text.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted"
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function Card({ title, text, saved = false, children }: { title: string; text: string; saved?: boolean; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <SavedHint saved={saved} />
      </div>
      <p className="text-xs text-muted">{text}</p>
      {children}
    </div>
  );
}

function Chip({
  active,
  small = false,
  onClick,
  children,
}: {
  active: boolean;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-display font-semibold transition-colors ${
        small ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-sm"
      } ${active ? "border-action bg-action text-pitch" : "border-edge bg-pitch text-muted hover:border-gold/60 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
