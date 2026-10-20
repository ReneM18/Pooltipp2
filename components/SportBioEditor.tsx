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
  HONORS,
  isFanRole,
  leaguesFor,
  PALETTES,
  PLAYING_ROLES,
  POSITIONS,
  ROLE_CATS,
  roleDef,
  saveSportBio,
  SportBio,
  Station,
  stationTitle,
} from "@/lib/sportBio";

const THIS_YEAR = new Date().getFullYear();
const YEARS: string[] = [];
for (let y = THIS_YEAR; y >= 1950; y--) YEARS.push(String(y));
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
  bio,
  unavailable,
  onSaved,
}: {
  userId: string;
  name: string;
  photo?: string | null;
  rankIcon?: RankIconOption | null;
  place?: number | null;
  bio: SportBio | null;
  unavailable: boolean;
  onSaved: () => void;
}) {
  const { teams } = useAppData();
  const { hasPremiumPass, photos } = useUser();
  const [data, setData] = useState<BioData>(bio?.data ?? {});
  const [visibility, setVisibility] = useState<BioVisibility>(bio?.visibility ?? "friends");
  const [saved, setSaved] = useState(false);
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

  async function commit(nextData: BioData, nextVis: BioVisibility = visibility) {
    touched.current = true;
    setData(nextData);
    setVisibility(nextVis);
    setSaved(false);
    const err = await saveSportBio(userId, nextData, nextVis);
    setError(err);
    if (err) return;
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2500);
    onSaved();
  }

  const stations = data.stations ?? [];
  function setStations(next: Station[]) {
    commit({ ...data, stations: next });
  }
  function patch(i: number, p: Partial<Station>) {
    setStations(stations.map((st, j) => (j === i ? { ...st, ...p } : st)));
  }

  if (unavailable) {
    return (
      <section id="steckbrief" className="mb-8 scroll-mt-48">
        <h2 className="font-display text-lg font-semibold text-ink">Deine Sportlerkarte</h2>
        <p className="mt-1 text-xs text-muted">⚠️ Kommt gleich – es fehlt noch ein Datenbank-Update.</p>
      </section>
    );
  }

  const preview: SportBio = { data, verified: bio?.verified ?? false, visibility };
  const hasKnownClub = stations.some((st) => knownClub(st.club));
  const style = data.cardStyle ?? "standard";

  return (
    <section id="steckbrief" className="mb-8 scroll-mt-48">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">🃏 Deine Sportlerkarte</h2>
        <SavedHint saved={saved} />
      </div>
      <p className="mt-1 text-xs text-muted">
        Was hast du selbst mit Sport zu tun? Steht als „eigene Angabe“ auf deiner Karte und bringt keine Punkte. „✓ bestätigt“ kann
        nur der Admin setzen.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {stations.length > 0 && (
        <div className="mt-4">
          <SportCard bio={preview} name={name} photo={photo} rankIcon={rankIcon} place={place} />
          <p className="mt-2 text-center text-[11px] text-muted">Vorschau · antippen zum Umdrehen</p>
        </div>
      )}

      <Card title="Deine Laufbahn" text="Jede Station: was, welche Sportart, wo, von wann bis wann. Die oberste ist deine Hauptrolle auf der Karte.">
        <div className="mt-3 flex flex-col gap-3">
          {stations.map((st, i) => (
            <StationEditor
              key={i}
              st={st}
              index={i}
              known={knownClub(st.club)}
              onPatch={(p) => patch(i, p)}
              onUp={i > 0 ? () => setStations(swap(stations, i - 1, i)) : undefined}
              onRemove={() => setStations(stations.filter((_, j) => j !== i))}
            />
          ))}
        </div>
        <datalist id="sport-bio-clubs">
          {clubNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {stations.length < MAX_STATIONS && (
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="mt-3 rounded-full bg-gold px-4 py-2 font-display text-sm font-bold text-pitch transition-opacity hover:opacity-90"
          >
            {picking ? "Schließen" : "+ Station hinzufügen"}
          </button>
        )}
        {picking && (
          <div className="mt-3 flex flex-col gap-3 rounded-card border border-dashed border-edge p-3">
            <p className="text-xs text-muted">Was warst oder bist du?</p>
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
                        setStations([...stations, { role: r.key, ex: false, sport: "fb", land: isFanRole(r.key) ? undefined : "AT" }]);
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

      <Card title="Erfolge" text="Stehen auf der Rückseite deiner Karte.">
        <div className="mt-3 flex flex-wrap gap-2">
          {HONORS.map((h) => {
            const on = (data.honors ?? []).includes(h);
            return (
              <Chip
                key={h}
                active={on}
                onClick={() => commit({ ...data, honors: on ? data.honors!.filter((x) => x !== h) : [...(data.honors ?? []), h] })}
              >
                {h}
              </Chip>
            );
          })}
        </div>
      </Card>

      <Card title="Kartenfoto" text="Eigenes Foto für die Karte, z. B. im Vereinsdress. Ausschnitt verschieben und zoomen. Sieht jeder, der deine Karte sehen darf.">
        <CardPhotoEditor
          current={data.photo}
          profilePhotos={photos.filter((p): p is string => !!p && p.startsWith("data:image"))}
          onSave={(url) => commit({ ...data, photo: url })}
          onReset={() => commit({ ...data, photo: undefined })}
        />
      </Card>

      <Card title="Karte" text="Rückennummer, Fan seit und Farben.">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Rückennummer">
            <TextInput
              value={data.nr ?? ""}
              maxLength={2}
              numeric
              placeholder="z. B. 10"
              onCommit={(v) => v !== (data.nr ?? "") && commit({ ...data, nr: v || undefined })}
            />
          </Field>
          <Field label="Fan seit">
            <select
              value={data.since ?? ""}
              onChange={(e) => commit({ ...data, since: e.target.value || undefined })}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink"
            >
              <option value="">– keine Angabe –</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Kartenfarben</p>
        {hasKnownClub ? (
          <p className="mt-1 text-xs text-muted">Kommen automatisch von deinem Verein.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {PALETTES.map((p, i) => (
              <Chip key={p[0]} small active={(data.palette ?? 0) === i} onClick={() => commit({ ...data, palette: i })}>
                <span
                  aria-hidden
                  className="h-3 w-3 rounded-full ring-1 ring-white/30"
                  style={{ background: `linear-gradient(135deg, ${p[1]} 50%, ${p[2]} 50%)` }}
                />
                {p[0]}
              </Chip>
            ))}
          </div>
        )}
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
              <Chip key={c.key} small active={style === c.key} onClick={() => commit({ ...data, cardStyle: c.key as CardStyle })}>
                {c.label}
              </Chip>
            );
          })}
        </div>
        {!hasPremiumPass && <p className="mt-2 text-[11px] text-muted">Holo, Gold- und Saison-Edition gibt es mit dem Premium-Pass.</p>}
      </Card>

      <Card title="Wer sieht deine Karte?" text="Du siehst sie immer.">
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["public", "👁️ Alle"],
              ["friends", "👥 Nur Freunde"],
              ["private", "🔒 Niemand"],
            ] as [BioVisibility, string][]
          ).map(([v, l]) => (
            <Chip key={v} active={visibility === v} onClick={() => commit(data, v)}>
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
  index,
  known,
  onPatch,
  onUp,
  onRemove,
}: {
  st: Station;
  index: number;
  known: boolean;
  onPatch: (p: Partial<Station>) => void;
  onUp?: () => void;
  onRemove: () => void;
}) {
  const fan = isFanRole(st.role);
  const country = st.land ? COUNTRIES[st.land] : undefined;
  const positions = !fan && PLAYING_ROLES.includes(st.role) ? POSITIONS[st.sport ?? ""] : undefined;
  const pending = !!st.club && !known && st.clubApproved !== true;
  return (
    <div className="flex flex-col gap-3 rounded-card border border-gold/35 bg-pitch p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 font-display text-[15px] font-bold text-ink">
          {roleDef(st.role).icon} {stationTitle(st)}
          {index === 0 && <span className="ml-2 font-display text-[10px] font-bold uppercase tracking-wider text-gold">Hauptrolle</span>}
        </p>
        <span className="flex shrink-0 gap-3 text-xs text-muted">
          {onUp && (
            <button type="button" onClick={onUp} className="hover:text-gold">
              ↑ nach oben
            </button>
          )}
          <button type="button" onClick={onRemove} aria-label="Station entfernen" className="hover:text-ink">
            ✕
          </button>
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
          <TextInput
            value={st.club ?? ""}
            maxLength={CLUB_MAX}
            list="sport-bio-clubs"
            placeholder="Verein …"
            onCommit={(v) => v !== (st.club ?? "") && onPatch({ club: v || undefined, clubApproved: undefined })}
          />
          {pending && <p className="mt-1 text-[11px] text-gold">⏳ Wird vom Admin geprüft, bis dahin sehen andere den Verein nicht.</p>}
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label={fan ? "Fan seit" : "Von"}>
          <TextInput value={st.from ?? ""} maxLength={4} numeric placeholder="Jahr" onCommit={(v) => v !== (st.from ?? "") && onPatch({ from: validYear(v) })} />
        </Field>
        {!fan && (
          <>
            <Field label="Bis">
              <TextInput
                value={st.to ?? ""}
                maxLength={4}
                numeric
                placeholder={st.ex ? "Jahr" : "heute"}
                onCommit={(v) => v !== (st.to ?? "") && onPatch({ to: validYear(v) })}
              />
            </Field>
            <Field label="Höchste Klasse">
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
          </>
        )}
      </div>
    </div>
  );
}

function validYear(v: string): string | undefined {
  const n = Number(v);
  return v.length === 4 && n >= 1930 && n <= THIS_YEAR ? v : undefined;
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

function Card({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
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
