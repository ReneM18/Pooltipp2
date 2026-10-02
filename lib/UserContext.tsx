"use client";

import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { mockUser } from "@/lib/mockData";
import { getAvailableRankIcons, getBestRankIcon, RankIconOption } from "@/lib/rankTiers";
import { PhotoVisibility } from "@/lib/mockUsers";
import { useAppData, SubmittedBonusAnswer } from "@/lib/AppDataContext";
import { Sport, SPORTS } from "@/lib/types";
import { mockLeaderboardBySport } from "@/lib/mockLeaderboard";
import {
  CURRENT_SEASON,
  getPassHonors,
  passClaimKey,
  reachedLevels,
  splitClaimedMilestones,
  PassHonors,
} from "@/lib/seasons";
import {
  evaluatePoolScore,
  daysBetween,
  applyInactivityDecay,
  INACTIVITY_GRACE_DAYS,
  DAILY_BONUS_STARS,
  DAILY_BONUS_XP,
  DAILY_STAKE_BUDGET,
  RESCUE_BONUS_STARS,
  LOW_STARS_THRESHOLD,
  STREAK_MILESTONES,
} from "@/lib/poolScore";

const SPORT_ICON: Record<Sport, string> = { "Fußball": "⚽", NFL: "🏈", NBA: "🏀", NHL: "🏒" };

function initialRangPunkte(): Record<Sport, number> {
  const initial = {} as Record<Sport, number>;
  for (const sport of SPORTS) {
    initial[sport] = mockLeaderboardBySport[sport].find((e) => e.isCurrentUser)?.points ?? 0;
  }
  return initial;
}

function isSameDay(aIso: string, bIso: string): boolean {
  return new Date(aIso).toDateString() === new Date(bIso).toDateString();
}

// Stabile, sitzungsweite Kennung des aktuellen Users – bleibt gleich, auch
// wenn der Anzeigename geändert wird (anders als displayName, das sich
// jederzeit ändern kann). Wird z. B. gebraucht, damit man die
// Ersteller-Rechte einer eigenen Tipprunde nicht durch Umbenennen verliert.
function generateUserId(): string {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export type FriendRelation = "friend" | "outgoing" | "incoming" | "none";

export interface FriendEntry {
  id: string;
  name: string;
  number: number;
  relation: Exclude<FriendRelation, "none">;
}

export interface PlayerSearchResult {
  id: string;
  name: string;
  number: number;
  relation: FriendRelation;
}

// Fehlermeldungen der Freundes-Funktionen in einfache Sätze übersetzen.
function friendlyFriendsError(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  // Funktion/Tabelle fehlt: supabase/freunde.sql wurde noch nicht ausgeführt.
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42P01" || /does not exist|Could not find/i.test(message)) {
    return "Freunde sind noch nicht eingerichtet (Datenbank-Skript freunde.sql fehlt noch).";
  }
  if (/einloggen|Spieler gibt es nicht|nicht selbst/.test(message)) return message;
  return "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.";
}

interface UserContextValue {
  // Stabile Sitzungs-ID, unabhängig vom (änderbaren) Anzeigenamen.
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  freeStars: number;
  // Saison-Pass-XP – steigt AUSSCHLIESSLICH über den täglichen Bonus
  // (claimDailyBonus), niemals durch Tipp-Ergebnisse. Siehe PoolScore-Konzept:
  // der Pass darf nie wieder sinken bzw. ein Level "entsperren".
  passXP: number;
  // Dauerhaft gespeicherte Saison-Pass-Level (z. B. "herbst-2026:4"), siehe
  // lib/seasons/index.ts. Darüber laufen Titel, Abzeichen, Emotes und die
  // einmalige Sterne-Gutschrift.
  passClaims: string[];
  // Eigene Titel/Abzeichen/Emotes aus dem Saison-Pass.
  passHonors: PassHonors;
  // Rangliste-Punkte je Sportart – Elo-artig, kann durch PoolScore steigen
  // UND fallen (inkl. Inaktivitäts-Abklingen). Komplett von passXP entkoppelt.
  rangPunkte: Record<Sport, number>;
  canClaimDailyBonus: boolean;
  claimDailyBonus: () => void;
  // Gibt zurück, wie viele Sterne tatsächlich abgezogen wurden (Sicherheitsnetz:
  // nie mehr als das vorhandene Guthaben – ein User mit 0 Sternen kann so
  // trotzdem mit Einsatz 0 weiter mittippen, statt komplett ausgeschlossen zu sein).
  spendStars: (amount: number) => number;
  // Gegenstück zu spendStars – schreibt Sterne gut (z. B. Duell-Gewinn).
  // Bewusst öffentlich statt nur intern, damit auch DuelsContext Gewinne
  // gutschreiben kann, ohne den internen starsState-Setter zu kennen.
  creditStars: (amount: number) => void;
  // Holt den echten Sterne-Stand aus Supabase, z. B. nachdem die Datenbank
  // selbst Sterne gutgeschrieben hat (Duell gewonnen, Duell abgelehnt).
  refreshStars: () => void;
  // Sterne, die heute schon eingesetzt wurden bzw. noch bis zum Tages-Limit
  // eingesetzt werden können – unabhängig davon, wie viele Spiele heute
  // angeboten werden (siehe DAILY_STAKE_BUDGET).
  stakeBudgetRemainingToday: number;
  // Zeigt Warnfarben etc., wenn das Sterne-Guthaben knapp wird.
  isLowOnStars: boolean;
  evaluateMatchForCurrentUser: (
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) => void;
  // Für den Admin-Bereich: korrigiert die Auswertung eines Spiels, das schon
  // einmal ausgewertet wurde (z. B. weil der Endstand falsch eingetragen
  // war). Macht die alte Rangpunkte-/Sterne-Gutschrift rückgängig, bevor die
  // neue angewendet wird – sonst würden sich Korrekturen aufsummieren.
  correctMatchEvaluationForCurrentUser: (
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) => void;
  // Wertet die eigene (noch offene) Bonusfrage-Antwort zu diesem Spiel aus,
  // sobald der Admin die richtige Antwort gesetzt hat – tut nichts, wenn es
  // keine offene Antwort gibt oder noch keine richtige Antwort feststeht.
  evaluateBonusAnswerForCurrentUser: (matchId: string) => void;
  tipsSubmitted: number;
  recordTipSubmitted: () => void;
  // Anzahl aufeinanderfolgender Tage mit mindestens einem abgegebenen Tipp
  // (siehe STREAK_MILESTONES in lib/poolScore.ts für die Sterne-Boni).
  streakCount: number;
  // Eigene Nutzernummer (z. B. 1001) – damit andere einen in der
  // Freundesliste finden. null, solange nicht eingeloggt oder noch nicht
  // geladen (bzw. supabase/freunde.sql noch nicht ausgeführt).
  userNumber: number | null;
  // Echte Freunde und offene Anfragen aus der Datenbank
  // (supabase/freunde.sql).
  friendEntries: FriendEntry[];
  // Nur die Namen der bestätigten Freunde bzw. der eigenen offenen Anfragen
  // – für Seiten, die nur nach dem Namen fragen (z. B. Spieler-Profil).
  friends: string[];
  pendingRequests: string[];
  friendsLoaded: boolean;
  friendsError: string | null;
  refreshFriends: () => Promise<void>;
  searchPlayers: (query: string) => Promise<{ results: PlayerSearchResult[]; error: string | null }>;
  sendFriendRequest: (otherId: string) => Promise<string | null>;
  respondFriendRequest: (otherId: string, accept: boolean) => Promise<string | null>;
  removeFriend: (otherId: string) => Promise<string | null>;
  // Eigene hochgeladene Fotos, global verfügbar (z. B. auch auf der
  // öffentlichen Spieler-Profilseite sichtbar, nicht nur im eigenen Profil).
  photos: (string | null)[];
  setPhoto: (index: number, dataUrl: string) => void;
  removePhoto: (index: number) => void;
  photoVisibility: PhotoVisibility;
  setPhotoVisibility: (visibility: PhotoVisibility) => void;
  rankIconOptions: RankIconOption[];
  selectedRankIconId: string | null;
  setSelectedRankIconId: (id: string) => void;
  activeRankIcon: RankIconOption | null;
  hasPremiumPass: boolean;
  buyPremiumPass: () => void;
  // Eigene Rahmenfarben (Level 5 Premium: "Eigener Farbwähler") – null,
  // solange noch keine eigene Kombination gewählt wurde (siehe
  // lib/seasonPass.ts: fällt dann auf den Neon-Pulse-Rahmen zurück).
  customFrameColors: { from: string; to: string } | null;
  setCustomFrameColors: (from: string, to: string) => void;
  // Werbefrei ist kein eigener Kauf mehr, sondern seit der letzten Absprache
  // immer automatisch im Premium-Pass enthalten (siehe hasPremiumPass) –
  // blendet lokal die Demo-Werbebanner aus (siehe components/AdBanner.tsx).
  hasAdFreeSubscription: boolean;
  // Echter Login-Status, direkt aus der Supabase-Sitzung im Browser
  // abgeleitet (siehe lib/supabaseClient.ts) – kein lokaler Platzhalter
  // mehr. Steuert, ob der "Registrieren"-Button in der Navbar angezeigt
  // wird, und bleibt auch nach einem Neuladen der Seite erhalten.
  isRegistered: boolean;
  // E-Mail-Adresse des eingeloggten Supabase-Kontos, oder null wenn niemand
  // eingeloggt ist.
  authEmail: string | null;
  // Echte, stabile Supabase-Nutzer-ID (anders als "userId" oben, das nur
  // eine zufällige Sitzungs-ID ohne Konto-Bezug ist) – null, solange nicht
  // eingeloggt. Wird für alles gebraucht, was wirklich einen echten Account
  // auf der Gegenseite braucht (z. B. Duelle gegen einen anderen User).
  authUserId: string | null;
  // true, sobald das eigene Profil aus Supabase geladen ist (vorher sind
  // Name/Punkte noch lokale Startwerte).
  profileLoaded: boolean;
  // true nur für den Admin-Account. Kommt direkt aus der Datenbank-Funktion
  // is_admin() – dieselbe Prüfung, die auch das Speichern von Spielen,
  // Teams, News und Turnieren absichert.
  isAdmin: boolean;
  // false, solange die Admin-Prüfung noch läuft.
  adminChecked: boolean;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const {
    addActivity,
    myTips,
    hydrateTips,
    markTipEvaluated,
    matches,
    myBonusAnswers,
    markBonusAnswerEvaluated,
    hydrateBonusAnswers,
    contentLoaded,
  } = useAppData();
  // Startet leer statt sofort mit Math.random() zu würfeln: Server und
  // Browser würden beim allerersten Rendern sonst unterschiedliche IDs
  // erzeugen (Hydration-Fehler). Die echte ID wird gleich nach dem Laden,
  // rein im Browser, einmalig vergeben.
  const [userId, setUserId] = useState("");
  useEffect(() => {
    setUserId(generateUserId());
  }, []);
  const [displayName, setDisplayName] = useState(mockUser.displayName);
  // Erstes Foto ist zu Demo-Zwecken mit einem Platzhalter-Avatar vorbefüllt,
  // damit man gleich sieht, wie ein echtes Foto im Profil aussieht – einfach
  // über "Foto ändern" im Profil durch ein eigenes Foto ersetzen.
  const [photos, setPhotos] = useState<(string | null)[]>(["/demo-avatar.svg", null, null]);

  // Sterne-Guthaben UND alles, was direkt beim Einsetzen davon abhängt
  // (Tages-Limit, Rettungs-Bonus), leben bewusst in EINEM einzigen State-
  // Objekt statt in vier separaten useState-Aufrufen. Grund: Nur so sieht
  // spendStars() bei jedem Aufruf garantiert einen vollständig konsistenten,
  // aktuellen Stand – mit getrennten useStates könnte ein sehr schneller
  // zweiter Aufruf (bevor React neu gerendert hat) noch mit veralteten
  // Werten rechnen und das Tages-Limit falsch fortschreiben.
  const [starsState, setStarsStateRaw] = useState({
    freeStars: mockUser.freeStars,
    // Tages-Einsatz-Limit: unabhängig von der Anzahl heutiger Spiele, damit
    // ein Tag mit vielen Spielen das Guthaben nicht schneller leert als ein
    // Tag mit wenigen. stakedToday/stakeBudgetDay setzen sich beim ersten
    // Einsatz eines neuen Tages automatisch zurück.
    stakedToday: 0,
    stakeBudgetDay: null as string | null,
    rescueBonusUsed: false,
  });
  const { freeStars, stakedToday, stakeBudgetDay } = starsState;
  // Spiegel des Sterne-States, der SOFORT (nicht erst beim nächsten Rendern)
  // aktuell ist. Alle Änderungen laufen über setStarsState unten, das den
  // neuen Stand direkt hier ausrechnet. Vorher hing spendStars() davon ab,
  // dass React den Updater sofort ausführt – das tut React aber nicht immer;
  // dann meldete spendStars "0 Sterne abgezogen", obwohl kurz danach doch
  // abgezogen wurde (z. B. Duell annehmen: Sterne weg, Duell aber nicht
  // angenommen).
  const starsStateRef = useRef(starsState);
  function setStarsState(update: (current: typeof starsState) => typeof starsState) {
    const next = update(starsStateRef.current);
    starsStateRef.current = next;
    setStarsStateRaw(next);
  }

  const [passXP, setPassXP] = useState(mockUser.passXP);
  const [passClaims, setPassClaims] = useState<string[]>([]);
  const [rangPunkte, setRangPunkte] = useState<Record<Sport, number>>(initialRangPunkte);
  const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);

  const canClaimDailyBonus = lastClaimedAt === null || !isSameDay(lastClaimedAt, new Date().toISOString());

  function claimDailyBonus() {
    const now = new Date().toISOString();
    if (lastClaimedAt && isSameDay(lastClaimedAt, now)) return;

    // Inaktivitäts-Abklingen: gilt für ALLE Ränge, aber langsam (14 Tage
    // Schonfrist, danach nur -5 Punkte/Woche) – so fällt niemand schnell ab.
    if (lastClaimedAt) {
      const inactiveDays = daysBetween(lastClaimedAt, now);
      if (inactiveDays > INACTIVITY_GRACE_DAYS) {
        setRangPunkte((current) => {
          const next = { ...current };
          for (const sport of SPORTS) {
            next[sport] = applyInactivityDecay(current[sport], inactiveDays);
          }
          return next;
        });
      }
    }

    setStarsState((current) => ({ ...current, freeStars: current.freeStars + DAILY_BONUS_STARS }));
    setPassXP((current) => current + DAILY_BONUS_XP);
    setLastClaimedAt(now);
    addActivity(
      "🎁",
      `Täglicher Bonus abgeholt: +${DAILY_BONUS_STARS} Sterne, +${DAILY_BONUS_XP} Pass-XP.`
    );
  }

  // Aus den (in Supabase gespeicherten) eigenen Tipps abgeleitet statt als
  // eigener Zähler – der stand nach jedem Neuladen wieder auf 0.
  const tipsSubmitted = myTips.length;
  // Ein Objekt statt getrennter useStates (gleiches Muster wie starsState),
  // damit recordTipSubmitted bei schnell aufeinanderfolgenden Tipps immer
  // mit einem konsistenten Stand rechnet.
  const [streakState, setStreakState] = useState({
    count: 0,
    lastTipDate: null as string | null,
    claimedMilestones: [] as number[],
  });
  const [photoVisibility, setPhotoVisibility] = useState<PhotoVisibility>("friends");
  const [hasPremiumPass, setHasPremiumPass] = useState(false);

  // Platzhalter für die echte Zahlungsanbindung (z. B. Stripe/RevenueCat) –
  // schaltet die Premium-Spur des Saison-Passes lokal frei.
  function buyPremiumPass() {
    setHasPremiumPass(true);
  }

  const [customFrameColors, setCustomFrameColorsState] = useState<{ from: string; to: string } | null>(
    null
  );
  function setCustomFrameColors(from: string, to: string) {
    setCustomFrameColorsState({ from, to });
  }

  // Kein eigener State mehr: Werbefrei ist automatisch dabei, sobald man den
  // Premium-Pass hat – kein separater Kauf, keine eigene Kündigung.
  const hasAdFreeSubscription = hasPremiumPass;

  // Echte Supabase-Sitzung: wird beim ersten Laden geprüft und danach live
  // aktualisiert (Login, Logout, Ablauf der Sitzung – egal von welcher
  // Seite aus das passiert).
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthEmail(data.session?.user.email ?? null);
      setAuthUserId(data.session?.user.id ?? null);
      setSessionChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user.email ?? null);
      setAuthUserId(session?.user.id ?? null);
      setSessionChecked(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const isRegistered = authEmail !== null;

  // Admin-Prüfung über die Datenbank (is_admin() in
  // supabase/social-features.sql), statt einer PIN im Browser-Code.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckedFor, setAdminCheckedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!authUserId) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.warn("Admin-Prüfung fehlgeschlagen:", error.message);
      setIsAdmin(!error && data === true);
      setAdminCheckedFor(authUserId);
    });
    return () => {
      cancelled = true;
    };
  }, [authUserId]);
  // Fertig geprüft: Sitzung bekannt und – falls eingeloggt – Admin-Abfrage
  // für genau dieses Konto beantwortet.
  const adminChecked = sessionChecked && (authUserId === null || adminCheckedFor === authUserId);
  const isAdminNow = isAdmin && adminCheckedFor === authUserId && authUserId !== null;
  async function logout() {
    await supabase.auth.signOut();
  }

  // Profil-Abgleich mit Supabase: Sobald eine echte Sitzung erkannt wird,
  // wird die "profiles"-Zeile dieses Kontos geladen (oder einmalig angelegt,
  // falls sie noch fehlt – z.B. bei Konten, die vor dieser Umstellung
  // registriert wurden) und Name/Sterne von dort übernommen. profileLoaded
  // verhindert, dass der Sync-Effekt weiter unten direkt danach versehentlich
  // die frisch geladenen Werte wieder überschreibt, bevor sie angekommen sind.
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Letzter Sterne-Stand, der mit Supabase abgeglichen ist. Gespeichert wird
  // nur noch die Differenz dazu (siehe Sterne-Sync weiter unten), nie mehr
  // ein fester Wert – sonst würden Gutschriften, die die Datenbank selbst
  // gebucht hat (Duell-Gewinn, abgelehntes Duell), wieder überschrieben.
  const lastSyncedStarsRef = useRef<number | null>(null);
  const starsRequestRef = useRef(0);
  useEffect(() => {
    lastSyncedStarsRef.current = null;
    setProfileLoaded(false);
    setPassClaims([]);
    if (!authUserId) return;
    let cancelled = false;
    (async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select(
          "display_name, free_stars, rang_punkte, pass_xp, streak_count, last_tip_date, claimed_milestones, last_claimed_at"
        )
        .eq("id", authUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // Bewusst NICHT profileLoaded setzen: sonst würde der Sync-Effekt
        // unten die Demo-Werte (Name, Rangpunkte, XP) über das echte Profil
        // in der Datenbank schreiben. Nach dem nächsten Neuladen klappt es.
        console.warn("Profil konnte nicht geladen werden:", error.message);
        return;
      }

      if (profile) {
        setDisplayName(profile.display_name);
        lastSyncedStarsRef.current = profile.free_stars;
        setStarsState((current) => ({ ...current, freeStars: profile.free_stars }));
        // Echte Konten starten bei 0: fehlt eine Sportart im gespeicherten
        // Profil, darf dort NICHT der Demo-Wert (z. B. 980) stehen bleiben –
        // der Sync-Effekt unten würde ihn sonst als echte Punkte speichern.
        setRangPunkte({
          ...(Object.fromEntries(SPORTS.map((s) => [s, 0])) as Record<Sport, number>),
          ...((profile.rang_punkte as Partial<Record<Sport, number>> | null) ?? {}),
        });
        if (typeof profile.pass_xp === "number") setPassXP(profile.pass_xp);
        setStreakState((current) => ({
          ...current,
          count: profile.streak_count ?? current.count,
          lastTipDate: profile.last_tip_date ?? current.lastTipDate,
          claimedMilestones: profile.claimed_milestones
            ? splitClaimedMilestones(profile.claimed_milestones).streak
            : current.claimedMilestones,
        }));
        setPassClaims(splitClaimedMilestones(profile.claimed_milestones).pass);
        setLastClaimedAt(profile.last_claimed_at ?? null);
      } else {
        // Kein Profil-Eintrag vorhanden (z.B. Konto von vor dieser
        // Umstellung) -> jetzt einmalig mit den aktuellen, lokalen Werten
        // anlegen.
        lastSyncedStarsRef.current = freeStars;
        setRangPunkte(Object.fromEntries(SPORTS.map((s) => [s, 0])) as Record<Sport, number>);
        setPassXP(0);
        setPassClaims([]);
        await supabase.from("profiles").insert({
          id: authUserId,
          display_name: displayName,
          free_stars: freeStars,
          // Neue Konten starten bei 0 Rangliste-Punkten und 0 Pass-XP, nicht
          // mit den Demo-Werten, die vor dem Login angezeigt werden.
          rang_punkte: Object.fromEntries(SPORTS.map((s) => [s, 0])),
          pass_xp: 0,
          streak_count: streakState.count,
          last_tip_date: streakState.lastTipDate,
          claimed_milestones: streakState.claimedMilestones,
          last_claimed_at: lastClaimedAt,
        });
      }
      setProfileLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // Schreibt Name/Sterne automatisch in Supabase zurück, sobald sie sich
  // ändern – deckt damit alle bestehenden Änderungsstellen (Tages-Bonus,
  // Tipp-Auswertung, Einsatz, Streak-Boni, ...) ab, ohne dass jede einzeln
  // um einen eigenen Datenbank-Aufruf ergänzt werden musste.
  useEffect(() => {
    if (!isRegistered || !authUserId || !profileLoaded) return;
    supabase
      .from("profiles")
      .update({
        display_name: displayName,
        rang_punkte: rangPunkte,
        pass_xp: passXP,
        streak_count: streakState.count,
        last_tip_date: streakState.lastTipDate,
        // Streak-Meilensteine (Zahlen) und Saison-Pass-Level (Text) teilen
        // sich diese Liste, siehe lib/seasons/index.ts.
        claimed_milestones: [...streakState.claimedMilestones, ...passClaims],
        last_claimed_at: lastClaimedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authUserId)
      .then(({ error }) => {
        if (error) console.warn("Profil konnte nicht gespeichert werden:", error.message);
      });
  }, [
    displayName,
    rangPunkte,
    passXP,
    streakState,
    passClaims,
    lastClaimedAt,
    isRegistered,
    authUserId,
    profileLoaded,
  ]);

  // Sterne-Sync: schickt nur die Änderung seit dem letzten Abgleich an
  // Supabase (add_stars, siehe supabase/fixes-features40.sql). Die Antwort
  // ist der echte Stand in der Datenbank – weicht er ab (weil die Datenbank
  // inzwischen selbst etwas gutgeschrieben hat), wird er übernommen.
  useEffect(() => {
    if (!isRegistered || !authUserId || !profileLoaded) return;
    const last = lastSyncedStarsRef.current;
    if (last === null || freeStars === last) return;
    const delta = freeStars - last;
    lastSyncedStarsRef.current = freeStars;
    const requestId = ++starsRequestRef.current;
    const localStars = freeStars;
    supabase.rpc("add_stars", { p_delta: delta }).then(({ data, error }) => {
      if (error) {
        // Fallback, solange das SQL-Skript noch nicht ausgeführt wurde:
        // alter Weg mit festem Wert.
        supabase
          .from("profiles")
          .update({ free_stars: localStars, updated_at: new Date().toISOString() })
          .eq("id", authUserId)
          .then(({ error: updateError }) => {
            if (updateError) console.warn("Sterne konnten nicht gespeichert werden:", updateError.message);
          });
        return;
      }
      // Nur die Antwort auf die jüngste Anfrage zählt – ältere Antworten
      // kennen spätere Änderungen noch nicht.
      if (requestId !== starsRequestRef.current || typeof data !== "number") return;
      if (data !== localStars) {
        lastSyncedStarsRef.current = data;
        setStarsState((current) => ({ ...current, freeStars: data }));
      }
    });
  }, [freeStars, isRegistered, authUserId, profileLoaded]);

  // Saison-Pass: neu erreichte Level dauerhaft speichern und erst DANACH
  // deren Sterne gutschreiben. Weil der Eintrag ("herbst-2026:10") zuerst in
  // der Datenbank steht, gibt es die Sterne garantiert nur einmal – auch
  // nicht erneut nach Neuladen der Seite oder auf einem zweiten Gerät.
  // Schlägt das Speichern fehl, gibt es (noch) keine Sterne; beim nächsten
  // Laden wird es erneut versucht.
  const claimingRef = useRef(false);
  useEffect(() => {
    if (!isRegistered || !authUserId || !profileLoaded || claimingRef.current) return;
    const seasonId = CURRENT_SEASON.theme.id;
    const newLevels = reachedLevels(passXP).filter(
      (l) => !passClaims.includes(passClaimKey(seasonId, l.level))
    );
    if (newLevels.length === 0) return;
    claimingRef.current = true;
    const nextClaims = [...passClaims, ...newLevels.map((l) => passClaimKey(seasonId, l.level))];
    const stars = newLevels.reduce((sum, l) => sum + (l.starsReward ?? 0), 0);
    supabase
      .from("profiles")
      .update({ claimed_milestones: [...streakState.claimedMilestones, ...nextClaims] })
      .eq("id", authUserId)
      .then(({ error }) => {
        claimingRef.current = false;
        if (error) {
          console.warn("Saison-Pass-Level konnten nicht gespeichert werden:", error.message);
          return;
        }
        setPassClaims(nextClaims);
        if (stars > 0) {
          creditStars(stars);
          addActivity("🏅", `Saison-Pass ${CURRENT_SEASON.theme.name}: +${stars} Sterne gutgeschrieben.`);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passXP, passClaims, isRegistered, authUserId, profileLoaded]);

  const passHonors = useMemo(() => getPassHonors(passXP, passClaims), [passXP, passClaims]);

  function refreshStars() {
    if (!authUserId) return;
    const requestId = ++starsRequestRef.current;
    supabase
      .from("profiles")
      .select("free_stars")
      .eq("id", authUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data || requestId !== starsRequestRef.current) return;
        lastSyncedStarsRef.current = data.free_stars;
        setStarsState((current) => ({ ...current, freeStars: data.free_stars }));
      });
  }

  // Tipp-Abgleich mit Supabase (gleiches Muster wie oben beim Profil): Sobald
  // eine echte Sitzung erkannt wird, werden die bisher abgegebenen Tipps
  // dieses Kontos aus der "tips"-Tabelle geladen und in den lokalen State
  // übernommen (hydrateTips ergänzt nur, überschreibt nichts) – so bleiben
  // eigene Tipps auch nach einem Neuladen der Seite oder einem Login auf
  // einem anderen Gerät sichtbar. tipsLoaded verhindert, dass der Sync-Effekt
  // weiter unten die frisch geladenen Tipps sofort wieder (unnötig) zurück an
  // Supabase schreibt, bevor sie angekommen sind.
  const [tipsLoaded, setTipsLoaded] = useState(false);
  useEffect(() => {
    if (!authUserId) {
      setTipsLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("tips").select("*").eq("user_id", authUserId);

      if (cancelled) return;

      if (error) {
        console.warn("Tipps konnten nicht geladen werden:", error.message);
        setTipsLoaded(true);
        return;
      }

      if (data && data.length > 0) {
        hydrateTips(
          data.map((row) => ({
            id: row.id,
            matchId: row.match_id,
            predictedHomeScore: row.predicted_home_score,
            predictedAwayScore: row.predicted_away_score,
            stake: row.stake,
            submittedAt: row.submitted_at,
            evaluated: row.evaluated ?? false,
            resultTier: row.result_tier ?? undefined,
            rangDelta: row.rang_delta ?? undefined,
            starsDelta: row.stars_delta ?? undefined,
            beatPercent: row.beat_percent ?? undefined,
            narration: row.narration ?? undefined,
            evaluatedHomeScore: row.evaluated_home_score ?? undefined,
            evaluatedAwayScore: row.evaluated_away_score ?? undefined,
          }))
        );
      }
      setTipsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // Schreibt eigene Tipps (neue wie nachträglich ausgewertete) automatisch
  // nach Supabase zurück, sobald sich myTips ändert – gleiches
  // Zentral-Sync-Muster wie beim Profil, damit nicht jede einzelne Stelle
  // (submitTip, markTipEvaluated in AppDataContext) selbst einen
  // Datenbank-Aufruf kennen muss.
  useEffect(() => {
    if (!isRegistered || !authUserId || !tipsLoaded || myTips.length === 0) return;
    const rows = myTips.map((t) => ({
      id: t.id,
      user_id: authUserId,
      match_id: t.matchId,
      predicted_home_score: t.predictedHomeScore,
      predicted_away_score: t.predictedAwayScore,
      stake: t.stake,
      submitted_at: t.submittedAt,
      evaluated: t.evaluated ?? false,
      result_tier: t.resultTier ?? null,
      rang_delta: t.rangDelta ?? null,
      stars_delta: t.starsDelta ?? null,
      beat_percent: t.beatPercent ?? null,
      narration: t.narration ?? null,
      evaluated_home_score: t.evaluatedHomeScore ?? null,
      evaluated_away_score: t.evaluatedAwayScore ?? null,
    }));
    supabase
      .from("tips")
      .upsert(rows, { onConflict: "id" })
      .then(({ error }) => {
        if (!error) return;
        // Spalten evaluated_home/away_score gibt es erst nach
        // supabase/fixes-features40.sql – bis dahin ohne sie speichern.
        if (error.code === "PGRST204") {
          const legacyRows = rows.map(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ({ evaluated_home_score, evaluated_away_score, ...rest }) => rest
          );
          supabase
            .from("tips")
            .upsert(legacyRows, { onConflict: "id" })
            .then(({ error: legacyError }) => {
              if (legacyError) console.warn("Tipps konnten nicht gespeichert werden:", legacyError.message);
            });
          return;
        }
        console.warn("Tipps konnten nicht gespeichert werden:", error.message);
      });
  }, [myTips, isRegistered, authUserId, tipsLoaded]);

  const rankIconOptions = useMemo(() => getAvailableRankIcons(rangPunkte), [rangPunkte]);
  const [selectedRankIconId, setSelectedRankIconId] = useState<string | null>(null);

  // Standardmäßig das beste verfügbare Icon (Elite, sonst höchster Sport-Rang) anzeigen.
  useEffect(() => {
    if (selectedRankIconId === null && rankIconOptions.length > 0) {
      const best = getBestRankIcon(rankIconOptions);
      if (best) setSelectedRankIconId(best.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankIconOptions]);

  // Weitere Profil-Einstellungen (Fotos, Foto-Sichtbarkeit, Rang-Icon,
  // Rahmenfarben, Bonusfrage-Antworten, Tages-Einsatz) in einer eigenen
  // Tabelle "profile_extras", die nur der Besitzer selbst lesen darf (siehe
  // supabase/profil-extras.sql). Fehlt die Tabelle noch, bleibt alles wie
  // bisher nur im Browser – Profil, Sterne und Tipps speichern trotzdem.
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  useEffect(() => {
    setExtrasLoaded(false);
    if (!authUserId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profile_extras")
        .select("photos, photo_visibility, rank_icon_id, frame_colors, bonus_answers, stake_state")
        .eq("id", authUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("Profil-Einstellungen konnten nicht geladen werden:", error.message);
        return;
      }
      if (data) {
        if (Array.isArray(data.photos)) setPhotos(data.photos as (string | null)[]);
        if (data.photo_visibility) setPhotoVisibility(data.photo_visibility as PhotoVisibility);
        if (data.rank_icon_id) setSelectedRankIconId(data.rank_icon_id);
        if (data.frame_colors) setCustomFrameColorsState(data.frame_colors as { from: string; to: string });
        if (Array.isArray(data.bonus_answers)) hydrateBonusAnswers(data.bonus_answers as SubmittedBonusAnswer[]);
        const stake = data.stake_state as {
          stakedToday?: number;
          stakeBudgetDay?: string | null;
          rescueBonusUsed?: boolean;
        } | null;
        if (stake) {
          setStarsState((current) => ({
            ...current,
            stakedToday: stake.stakedToday ?? current.stakedToday,
            stakeBudgetDay: stake.stakeBudgetDay ?? current.stakeBudgetDay,
            rescueBonusUsed: stake.rescueBonusUsed ?? current.rescueBonusUsed,
          }));
        }
      }
      setExtrasLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId || !extrasLoaded) return;
    supabase
      .from("profile_extras")
      .upsert(
        {
          id: authUserId,
          photos,
          photo_visibility: photoVisibility,
          rank_icon_id: selectedRankIconId,
          frame_colors: customFrameColors,
          bonus_answers: myBonusAnswers,
          stake_state: {
            stakedToday: starsState.stakedToday,
            stakeBudgetDay: starsState.stakeBudgetDay,
            rescueBonusUsed: starsState.rescueBonusUsed,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) console.warn("Profil-Einstellungen konnten nicht gespeichert werden:", error.message);
      });
  }, [
    authUserId,
    extrasLoaded,
    photos,
    photoVisibility,
    selectedRankIconId,
    customFrameColors,
    myBonusAnswers,
    starsState.stakedToday,
    starsState.stakeBudgetDay,
    starsState.rescueBonusUsed,
  ]);

  const activeRankIcon =
    rankIconOptions.find((o) => o.id === selectedRankIconId) ?? getBestRankIcon(rankIconOptions);

  function spendStars(amount: number): number {
    // setStarsState rechnet sofort mit dem aktuellsten Stand (siehe
    // starsStateRef) – auch wenn spendStars zweimal sehr schnell
    // hintereinander aufgerufen wird. Dadurch sind "actual" und
    // "rescueBonusGranted" direkt nach dem Aufruf verlässlich gesetzt.
    let actual = 0;
    let rescueBonusGranted = false;

    setStarsState((current) => {
      const now = new Date().toISOString();
      const isNewBudgetDay = current.stakeBudgetDay === null || !isSameDay(current.stakeBudgetDay, now);
      const alreadyStakedToday = isNewBudgetDay ? 0 : current.stakedToday;
      const remainingBudget = Math.max(0, DAILY_STAKE_BUDGET - alreadyStakedToday);

      actual = Math.max(0, Math.min(amount, current.freeStars, remainingBudget));
      let nextFreeStars = Math.max(0, current.freeStars - actual);
      let nextRescueUsed = current.rescueBonusUsed;

      // Rettungs-Bonus: fällt das Guthaben nach diesem Einsatz auf 0, bekommt
      // der User einmalig einen kleinen Polster, damit sich niemand komplett
      // ausgeschlossen fühlt. Danach nicht mehr (kein Dauer-Selbstläufer).
      if (!current.rescueBonusUsed && nextFreeStars <= 0 && actual > 0) {
        nextFreeStars += RESCUE_BONUS_STARS;
        nextRescueUsed = true;
        rescueBonusGranted = true;
      }

      return {
        freeStars: nextFreeStars,
        stakedToday: alreadyStakedToday + actual,
        stakeBudgetDay: isNewBudgetDay ? now : current.stakeBudgetDay,
        rescueBonusUsed: nextRescueUsed,
      };
    });

    if (rescueBonusGranted) {
      addActivity("🎁", `Deine Sterne waren aufgebraucht – hier ${RESCUE_BONUS_STARS} Sterne geschenkt, damit's weitergeht.`);
    }

    return actual;
  }

  function creditStars(amount: number) {
    if (amount <= 0) return;
    setStarsState((current) => ({ ...current, freeStars: current.freeStars + amount }));
  }

  const stakeBudgetRemainingToday =
    stakeBudgetDay === null || !isSameDay(stakeBudgetDay, new Date().toISOString())
      ? DAILY_STAKE_BUDGET
      : Math.max(0, DAILY_STAKE_BUDGET - stakedToday);

  const isLowOnStars = freeStars <= LOW_STARS_THRESHOLD;

  // Kern der PoolScore-Auswertung: sucht den (noch nicht ausgewerteten) Tipp
  // des aktuellen Users zu diesem Spiel, berechnet Rangliste-Punkte- und
  // Sterne-Änderung sowie den Prozent-Vergleich gegen die simulierten
  // Mitspieler, schreibt alles fort und hinterlässt eine narrierte
  // Feed-Meldung für den "Reveal"-Moment in MatchCard.
  function evaluateMatchForCurrentUser(
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) {
    const tip = [...myTips].reverse().find((t) => t.matchId === matchId && !t.evaluated);
    if (!tip) return;

    const match = matches.find((m) => m.id === matchId);

    const result = evaluatePoolScore({
      predictedHome: tip.predictedHomeScore,
      predictedAway: tip.predictedAwayScore,
      actualHome,
      actualAway,
      stake: tip.stake,
      isOneXTwo: match?.tipMode === "1x2",
    });

    setRangPunkte((current) => ({
      ...current,
      [sport]: Math.max(0, current[sport] + result.rangDelta),
    }));
    setStarsState((current) => ({
      ...current,
      freeStars: Math.max(0, current.freeStars + result.starsCredit),
    }));

    const deltaLabel = result.rangDelta >= 0 ? `+${result.rangDelta}` : `${result.rangDelta}`;
    const narration =
      result.tier === "exakt"
        ? `🎯 Exakt getroffen! ${deltaLabel} Rangpunkte.`
        : result.tier === "tendenz"
        ? match?.tipMode === "1x2"
          ? `👍 Richtig getippt – ${deltaLabel} Rangpunkte.`
          : `👍 Tendenz richtig erkannt – ${deltaLabel} Rangpunkte.`
        : `😬 Daneben getippt (${deltaLabel} Rangpunkte).`;

    markTipEvaluated(tip.id, {
      tier: result.tier,
      rangDelta: result.rangDelta,
      starsDelta: result.starsNet,
      narration,
      actualHome,
      actualAway,
    });

    addActivity(SPORT_ICON[sport], narration);
  }

  // Gegenstück zu evaluateMatchForCurrentUser, aber für einen bereits
  // ausgewerteten Tipp: sucht bewusst einen Tipp MIT evaluated:true (nicht
  // ohne), macht dessen alte Gutschrift rückgängig und wendet die neu
  // berechnete an. So bleibt eine spätere Endstand-Korrektur im Admin-Bereich
  // fair, statt die alte (falsche) Gutschrift einfach stehen zu lassen oder
  // eine zweite obendrauf zu addieren.
  function correctMatchEvaluationForCurrentUser(
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) {
    const tip = [...myTips].reverse().find((t) => t.matchId === matchId && t.evaluated);
    if (!tip) return;

    const match = matches.find((m) => m.id === matchId);
    const oldRangDelta = tip.rangDelta ?? 0;
    const oldStarsDelta = tip.starsDelta ?? 0;

    const result = evaluatePoolScore({
      predictedHome: tip.predictedHomeScore,
      predictedAway: tip.predictedAwayScore,
      actualHome,
      actualAway,
      stake: tip.stake,
      isOneXTwo: match?.tipMode === "1x2",
    });

    setRangPunkte((current) => ({
      ...current,
      [sport]: Math.max(0, current[sport] - oldRangDelta + result.rangDelta),
    }));
    setStarsState((current) => ({
      ...current,
      // starsDelta ist der NETTO-Wert (Gutschrift minus Einsatz) – also auch
      // netto korrigieren. Vorher wurde die neue BRUTTO-Gutschrift addiert,
      // wodurch jede Korrektur den Einsatz ein zweites Mal gutschrieb.
      freeStars: Math.max(0, current.freeStars - oldStarsDelta + result.starsNet),
    }));

    const deltaLabel = result.rangDelta >= 0 ? `+${result.rangDelta}` : `${result.rangDelta}`;
    const tierText =
      result.tier === "exakt"
        ? "jetzt exakt getroffen"
        : result.tier === "tendenz"
        ? match?.tipMode === "1x2"
          ? "jetzt richtig"
          : "jetzt Tendenz richtig"
        : "jetzt daneben";
    const narration = `🔧 Ein Admin hat den Endstand korrigiert – dein Tipp gilt ${tierText} (${deltaLabel} Rangpunkte).`;

    markTipEvaluated(tip.id, {
      tier: result.tier,
      rangDelta: result.rangDelta,
      starsDelta: result.starsNet,
      narration,
      actualHome,
      actualAway,
    });

    addActivity(SPORT_ICON[sport], narration);
  }

  // Automatische Auswertung für JEDEN Spieler (nicht nur für den Admin, der
  // das Spiel beendet): Sobald ein Spiel mit Endstand "beendet" ist, wertet
  // jeder Browser beim Laden die eigenen, noch offenen Tipps dazu aus. Hat
  // der Admin den Endstand später korrigiert, wird die Auswertung
  // entsprechend nachgezogen. Läuft erst, wenn Profil, Tipps und Spiele aus
  // Supabase geladen sind – sonst würde mit Demo-Daten oder einem veralteten
  // Sterne-Stand gerechnet.
  const handledEvaluationsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!authUserId || !profileLoaded || !tipsLoaded || !contentLoaded) return;
    // Bonusfragen: sobald der Admin die richtige Antwort gesetzt hat, wertet
    // jeder Spieler seine eigene (gespeicherte) Antwort selbst aus – vorher
    // passierte das nur im Browser des Admins.
    if (extrasLoaded) {
      for (const match of matches) {
        if (match.bonusQuestion && match.bonusQuestion.correctOptionIndex !== null) {
          evaluateBonusAnswerForCurrentUser(match.id);
        }
      }
    }
    for (const match of matches) {
      if (match.status !== "finished" || match.liveHomeScore === null || match.liveAwayScore === null) continue;
      const actualHome = match.liveHomeScore;
      const actualAway = match.liveAwayScore;
      const openTip = [...myTips].reverse().find((t) => t.matchId === match.id && !t.evaluated);

      if (openTip) {
        const key = `${openTip.id}:${actualHome}:${actualAway}`;
        if (handledEvaluationsRef.current.has(key)) continue;
        handledEvaluationsRef.current.add(key);
        claimTipForEvaluation(openTip.id).then((claimed) => {
          if (claimed) evaluateMatchForCurrentUser(match.id, match.sport, actualHome, actualAway);
        });
        continue;
      }

      const evaluatedTip = [...myTips].reverse().find((t) => t.matchId === match.id && t.evaluated);
      if (
        evaluatedTip &&
        evaluatedTip.evaluatedHomeScore !== undefined &&
        evaluatedTip.evaluatedAwayScore !== undefined &&
        (evaluatedTip.evaluatedHomeScore !== actualHome || evaluatedTip.evaluatedAwayScore !== actualAway)
      ) {
        const key = `${evaluatedTip.id}:${actualHome}:${actualAway}`;
        if (handledEvaluationsRef.current.has(key)) continue;
        handledEvaluationsRef.current.add(key);
        correctMatchEvaluationForCurrentUser(match.id, match.sport, actualHome, actualAway);
      }
    }
    // evaluate*/correct* lesen bewusst den aktuellen Render-Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, myTips, myBonusAnswers, authUserId, profileLoaded, tipsLoaded, contentLoaded, extrasLoaded]);

  // Verhindert doppelte Auswertung, wenn dasselbe Konto gleichzeitig in zwei
  // Browsern/Geräten offen ist: Nur wer den Tipp in Supabase als erster von
  // "offen" auf "ausgewertet" umstellt, wertet ihn aus.
  async function claimTipForEvaluation(tipId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("tips")
      .update({ evaluated: true })
      .eq("id", tipId)
      .eq("evaluated", false)
      .select("id");
    if (error) return true;
    if (data && data.length > 0) return true;
    // Nichts umgestellt: entweder war ein anderes Gerät schneller, oder der
    // Tipp ist (noch) gar nicht in Supabase angekommen – dann lokal auswerten.
    const { data: existing } = await supabase.from("tips").select("*").eq("id", tipId).maybeSingle();
    if (!existing) return true;
    // Das andere Gerät hat schon ausgewertet: Ergebnis hier übernehmen, damit
    // dieser Browser den Tipp nicht später als "offen" zurückschreibt.
    if (existing.result_tier) {
      markTipEvaluated(tipId, {
        tier: existing.result_tier,
        rangDelta: existing.rang_delta ?? 0,
        starsDelta: existing.stars_delta ?? 0,
        narration: existing.narration ?? "",
        actualHome: existing.evaluated_home_score ?? undefined,
        actualAway: existing.evaluated_away_score ?? undefined,
      });
    }
    return false;
  }

  // Merkt sich bereits ausgewertete Bonus-Antworten, damit der Admin-Klick
  // und die automatische Auswertung unten nie doppelt Sterne gutschreiben.
  const handledBonusAnswersRef = useRef(new Set<string>());
  function evaluateBonusAnswerForCurrentUser(matchId: string) {
    const answer = [...myBonusAnswers].reverse().find((a) => a.matchId === matchId && !a.evaluated);
    if (!answer || handledBonusAnswersRef.current.has(answer.id)) return;

    const match = matches.find((m) => m.id === matchId);
    if (!match?.bonusQuestion || match.bonusQuestion.correctOptionIndex === null) return;
    handledBonusAnswersRef.current.add(answer.id);

    const correct = answer.optionIndex === match.bonusQuestion.correctOptionIndex;
    const starsDelta = correct ? match.bonusQuestion.bonusStars : 0;

    if (starsDelta > 0) {
      setStarsState((current) => ({ ...current, freeStars: current.freeStars + starsDelta }));
    }

    markBonusAnswerEvaluated(answer.id, { correct, starsDelta });

    addActivity(
      correct ? "🎁" : "🤔",
      correct
        ? `🎁 Bonusfrage richtig beantwortet – +${starsDelta} Sterne!`
        : "Bonusfrage leider daneben – kein Sterne-Bonus diesmal."
    );
  }

  function recordTipSubmitted() {
    // Tipp-Streak fortschreiben: derselbe Kalendertag zählt nur einmal, der
    // Folgetag verlängert die Serie, ein übersprungener Tag setzt sie zurück
    // auf 1. Meilenstein-Bonus wird außerhalb des Updaters vergeben (addActivity
    // ist kein State-Setter und gehört da nicht rein – gleiches Muster wie der
    // Rettungs-Bonus in spendStars).
    const now = new Date().toISOString();
    let milestoneBonus = 0;
    let milestoneDays = 0;

    setStreakState((current) => {
      if (current.lastTipDate && isSameDay(current.lastTipDate, now)) {
        return { ...current, lastTipDate: now };
      }
      const isNextDay = current.lastTipDate !== null && daysBetween(current.lastTipDate, now) === 1;
      const nextCount = isNextDay ? current.count + 1 : 1;

      const milestone = STREAK_MILESTONES.find(
        (m) => m.days === nextCount && !current.claimedMilestones.includes(m.days)
      );
      if (milestone) {
        milestoneBonus = milestone.bonusStars;
        milestoneDays = milestone.days;
      }

      return {
        count: nextCount,
        lastTipDate: now,
        claimedMilestones: milestone
          ? [...current.claimedMilestones, milestone.days]
          : current.claimedMilestones,
      };
    });

    if (milestoneBonus > 0) {
      setStarsState((current) => ({ ...current, freeStars: current.freeStars + milestoneBonus }));
      addActivity(
        "🔥",
        `${milestoneDays} Spieltage in Folge getippt – +${milestoneBonus} Sterne Bonus!`
      );
    }
  }

  // Nutzernummer getrennt vom restlichen Profil laden: fehlt die Spalte noch
  // (freunde.sql nicht ausgeführt), darf das das Profil nicht kaputt machen.
  const [userNumber, setUserNumber] = useState<number | null>(null);
  useEffect(() => {
    setUserNumber(null);
    if (!authUserId || !profileLoaded) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_number")
      .eq("id", authUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("Nutzernummer konnte nicht geladen werden:", error.message);
          return;
        }
        if (data && typeof data.user_number === "number") setUserNumber(data.user_number);
      });
    return () => {
      cancelled = true;
    };
  }, [authUserId, profileLoaded]);

  // Echte Freunde aus der Datenbank (Funktion my_friends in
  // supabase/freunde.sql) – live aktualisiert, sobald jemand eine Anfrage
  // schickt, annimmt oder einen entfernt.
  const [friendEntries, setFriendEntries] = useState<FriendEntry[]>([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const friendsRequestRef = useRef(0);

  async function refreshFriends() {
    if (!authUserId) return;
    const requestId = ++friendsRequestRef.current;
    const { data, error } = await supabase.rpc("my_friends");
    if (requestId !== friendsRequestRef.current) return;
    if (error) {
      console.warn("Freunde konnten nicht geladen werden:", error.message);
      setFriendsError(friendlyFriendsError(error));
    } else {
      setFriendsError(null);
      setFriendEntries(
        ((data ?? []) as { other_id: string; display_name: string; user_number: number; relation: FriendEntry["relation"] }[]).map(
          (row) => ({ id: row.other_id, name: row.display_name, number: row.user_number, relation: row.relation })
        )
      );
    }
    setFriendsLoaded(true);
  }

  useEffect(() => {
    friendsRequestRef.current++;
    setFriendEntries([]);
    setFriendsError(null);
    setFriendsLoaded(false);
    if (!authUserId) return;
    refreshFriends();
    const channel = supabase
      .channel(`friendships-${authUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        refreshFriends();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  const friends = useMemo(
    () => friendEntries.filter((f) => f.relation === "friend").map((f) => f.name),
    [friendEntries]
  );
  const pendingRequests = useMemo(
    () => friendEntries.filter((f) => f.relation === "outgoing").map((f) => f.name),
    [friendEntries]
  );

  async function searchPlayers(query: string): Promise<{ results: PlayerSearchResult[]; error: string | null }> {
    if (!authUserId) return { results: [], error: "Bitte zuerst einloggen." };
    const { data, error } = await supabase.rpc("search_players", { p_query: query });
    if (error) return { results: [], error: friendlyFriendsError(error) };
    return {
      results: ((data ?? []) as { id: string; display_name: string; user_number: number; relation: FriendRelation }[]).map(
        (row) => ({ id: row.id, name: row.display_name, number: row.user_number, relation: row.relation })
      ),
      error: null,
    };
  }

  // Gibt null zurück, wenn es geklappt hat, sonst eine Fehlermeldung.
  async function sendFriendRequest(otherId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc("send_friend_request", { p_other: otherId });
    if (error) return friendlyFriendsError(error);
    const other = friendEntries.find((f) => f.id === otherId);
    if (data === "friend" && other) addActivity("🤝", `Du bist jetzt mit ${other.name} befreundet.`);
    await refreshFriends();
    return null;
  }

  async function respondFriendRequest(otherId: string, accept: boolean): Promise<string | null> {
    const { error } = await supabase.rpc("respond_friend_request", { p_other: otherId, p_accept: accept });
    if (error) return friendlyFriendsError(error);
    const other = friendEntries.find((f) => f.id === otherId);
    if (accept && other) addActivity("🤝", `Du bist jetzt mit ${other.name} befreundet.`);
    await refreshFriends();
    return null;
  }

  async function removeFriend(otherId: string): Promise<string | null> {
    const { error } = await supabase.rpc("remove_friend", { p_other: otherId });
    if (error) return friendlyFriendsError(error);
    await refreshFriends();
    return null;
  }

  // Eigene hochgeladene Fotos – global im UserContext statt nur lokal auf
  // der Profilseite, damit sie z. B. auch auf der eigenen öffentlichen
  // Spieler-Profilseite sichtbar sind.
  function setPhoto(index: number, dataUrl: string) {
    setPhotos((current) => {
      const next = [...current];
      next[index] = dataUrl;
      return next;
    });
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  }

  return (
    <UserContext.Provider
      value={{
        userId,
        displayName,
        setDisplayName,
        photos,
        setPhoto,
        removePhoto,
        freeStars,
        passXP,
        passClaims,
        passHonors,
        rangPunkte,
        canClaimDailyBonus,
        claimDailyBonus,
        spendStars,
        creditStars,
        refreshStars,
        stakeBudgetRemainingToday,
        isLowOnStars,
        evaluateMatchForCurrentUser,
        correctMatchEvaluationForCurrentUser,
        evaluateBonusAnswerForCurrentUser,
        tipsSubmitted,
        recordTipSubmitted,
        streakCount: streakState.count,
        userNumber,
        friendEntries,
        friends,
        pendingRequests,
        friendsLoaded,
        friendsError,
        refreshFriends,
        searchPlayers,
        sendFriendRequest,
        respondFriendRequest,
        removeFriend,
        photoVisibility,
        setPhotoVisibility,
        rankIconOptions,
        selectedRankIconId,
        setSelectedRankIconId,
        activeRankIcon,
        hasPremiumPass,
        buyPremiumPass,
        customFrameColors,
        setCustomFrameColors,
        hasAdFreeSubscription,
        isRegistered,
        authEmail,
        authUserId,
        profileLoaded,
        isAdmin: isAdminNow,
        adminChecked,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser muss innerhalb von <UserProvider> verwendet werden");
  }
  return context;
}
