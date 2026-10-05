"use client";

import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { setFlashToast } from "@/lib/flashToast";
import { mockUser } from "@/lib/mockData";
import { getAvailableRankIcons, getBestRankIcon, RankIconOption } from "@/lib/rankTiers";
import { PhotoVisibility } from "@/lib/mockUsers";
import { useAppData, SubmittedTip } from "@/lib/AppDataContext";
import { Sport, SPORTS } from "@/lib/types";
import { CURRENT_SEASON, seasonChangedSinceLoad, getPassHonors, splitClaimedMilestones, PassHonors } from "@/lib/seasons";
import {
  DAILY_BONUS_STARS,
  DAILY_BONUS_XP,
  DAILY_STAKE_BUDGET,
  RESCUE_BONUS_STARS,
  LOW_STARS_THRESHOLD,
  dailyBonusStarsFor,
  BOOSTER_STAKE,
} from "@/lib/poolScore";

function bonusActivityText(stars: number) {
  return stars > 0
    ? `Täglicher Bonus abgeholt: +${stars} Sterne, +${DAILY_BONUS_XP} Pass-XP.`
    : `Täglicher Bonus abgeholt: +${DAILY_BONUS_XP} Pass-XP (ab 500 Sternen gibt es nur noch XP).`;
}

// Start bei 0 statt Demo-Punkten: sonst zeigte die Kopfzeile kurz (oder
// bei Gästen dauerhaft) Rang-Icons aus erfundenen Werten.
function initialRangPunkte(): Record<Sport, number> {
  return Object.fromEntries(SPORTS.map((s) => [s, 0])) as Record<Sport, number>;
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
  // Rangliste-Punkte je Sportart (Rankingsystem), können steigen
  // UND fallen (auch durch die Strafe fürs Nicht-Tippen). Komplett von passXP entkoppelt.
  rangPunkte: Record<Sport, number>;
  canClaimDailyBonus: boolean;
  // Täglicher Bonus – rechnet die Datenbank (claim_daily_bonus). claimed:
  // false, wenn er heute schon abgeholt war.
  claimDailyBonus: () => Promise<{ claimed: boolean; error: string | null; starsAdded?: number }>;
  // Tipp abgeben: Einsatz, Tageslimit, Rettungs-Bonus und Tipp-Serie rechnet
  // die Datenbank. null = nicht gespeichert (z. B. Tippschluss).
  placeTip: (matchId: string, homeScore: number, awayScore: number) => Promise<SubmittedTip | null>;
  // Prämien-Shop: alles oder nichts. true = abgebucht.
  spendStarsInShop: (amount: number) => Promise<boolean>;
  // Holt Sterne, Rangpunkte, XP usw. neu aus der Datenbank (my_wallet), z. B.
  // nachdem die Datenbank selbst etwas gebucht hat (Duell, Auswertung).
  refreshStars: () => void;
  // Sterne, die heute noch für Duelle eingesetzt werden können (Tages-Limit,
  // siehe DAILY_STAKE_BUDGET). Tipps zählen nicht mehr mit.
  stakeBudgetRemainingToday: number;
  // Zeigt Warnfarben etc., wenn das Sterne-Guthaben knapp wird.
  isLowOnStars: boolean;
  tipsSubmitted: number;
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
  // false, solange beim Laden noch nicht feststeht, ob jemand eingeloggt ist.
  sessionChecked: boolean;
  logout: () => Promise<void>;
}

// Antwort von my_wallet() (supabase/auswertung-server.sql).
interface WalletRow {
  free_stars: number;
  rang_punkte: unknown;
  pass_xp: number;
  streak_count: number;
  last_tip_date: string | null;
  claimed_milestones: unknown;
  last_claimed_at: string | null;
  rescue_bonus_used: boolean;
  stake_budget_remaining: number;
}

const UserContext = createContext<UserContextValue | null>(null);

// Saisonwechsel (supabase/saisonwechsel.sql): Gehören die gespeicherten
// Saison-XP noch zu einer früheren Saison, setzt die Datenbank sie hier
// einmalig auf 0. Titel/Abzeichen (claimed_milestones) bleiben. Antwort: die
// gültigen Saison-XP – oder null, falls das SQL noch nicht ausgeführt wurde
// (dann bleibt alles wie bisher).
async function startPassSeason(): Promise<number | null> {
  const { data, error } = await supabase.rpc("start_pass_season", {
    p_season_id: CURRENT_SEASON.theme.id,
    p_starts_on: CURRENT_SEASON.startsOn,
  });
  if (error) {
    console.warn("Saisonwechsel nicht geprüft:", error.message);
    return null;
  }
  return typeof data?.pass_xp === "number" ? data.pass_xp : null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const {
    addActivity,
    myTips,
    submitTip,
    reloadMyTips,
    myTipsLoaded,
    matches,
    myBonusAnswers,
    reloadMyBonusAnswers,
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

  // Sterne, Rangpunkte, Saison-XP, Tipp-Serie, Pass-Level und Tages-Limit
  // rechnet seit supabase/auswertung-server.sql allein die Datenbank. Der
  // Browser zeigt nur an, was my_wallet() bzw. die Aktions-Funktionen
  // zurückgeben – er kann nichts davon mehr selbst speichern. Nur ohne
  // Konto (Gast) läuft eine kleine Demo-Rechnung rein im Browser.
  const [freeStars, setFreeStars] = useState(mockUser.freeStars);
  const [stakeBudgetRemainingToday, setStakeBudgetRemainingToday] = useState(DAILY_STAKE_BUDGET);
  const [passXP, setPassXP] = useState(mockUser.passXP);
  const [passClaims, setPassClaims] = useState<string[]>([]);
  const [rangPunkte, setRangPunkte] = useState<Record<Sport, number>>(initialRangPunkte);
  const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);
  const [streakCount, setStreakCount] = useState(0);
  // Nur für Gäste: Demo-Rettungs-Bonus (eingeloggt merkt sich das die Datenbank).
  const guestRescueUsedRef = useRef(false);

  const canClaimDailyBonus = lastClaimedAt === null || !isSameDay(lastClaimedAt, new Date().toISOString());

  // Aus den (in Supabase gespeicherten) eigenen Tipps abgeleitet statt als
  // eigener Zähler – der stand nach jedem Neuladen wieder auf 0.
  const tipsSubmitted = myTips.length;
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
  // Einmal zur Startseite wechseln, auch wenn Knopf und Abmelde-Meldung
  // beide auslösen.
  const leavingRef = useRef(false);
  function leaveToStart() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    window.location.replace("/");
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthEmail(data.session?.user.email ?? null);
      setAuthUserId(data.session?.user.id ?? null);
      setSessionChecked(true);
    });
    let hadUser = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Abgemeldet (Knopf, anderer Tab, abgelaufene Sitzung): Seite komplett
      // neu laden. Nur so verschwinden Name, Foto, Sterne und Tipps des
      // Kontos sicher aus dem Speicher, auch in Safari auf dem iPhone.
      if (event === "SIGNED_OUT" && hadUser) {
        leaveToStart();
        return;
      }
      if (session) hadUser = true;
      setAuthEmail(session?.user.email ?? null);
      setAuthUserId(session?.user.id ?? null);
      setSessionChecked(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const isRegistered = authEmail !== null;
  const authUserIdRef = useRef<string | null>(null);
  authUserIdRef.current = authUserId;

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
  // Ausloggen: Sitzung beenden und zur Startseite. Klappt das Abmelden beim
  // Server nicht (z. B. kein Netz), wird die Sitzung trotzdem auf diesem
  // Gerät gelöscht, damit niemand eingeloggt hängen bleibt.
  async function logout() {
    setFlashToast("👋 Du bist ausgeloggt.");
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: "local" });
    leaveToStart();
  }

  // Übernimmt den Kontostand aus der Datenbank (Antwort von my_wallet,
  // claim_daily_bonus, spend_stars). Nur die jüngste Anfrage zählt.
  const walletRequestRef = useRef(0);
  function applyWallet(wallet: WalletRow) {
    setFreeStars(wallet.free_stars);
    setStakeBudgetRemainingToday(wallet.stake_budget_remaining ?? DAILY_STAKE_BUDGET);
    // Fehlt eine Sportart, steht dort 0.
    setRangPunkte({
      ...(Object.fromEntries(SPORTS.map((s) => [s, 0])) as Record<Sport, number>),
      ...((wallet.rang_punkte as Partial<Record<Sport, number>> | null) ?? {}),
    });
    setPassXP(wallet.pass_xp ?? 0);
    setStreakCount(wallet.streak_count ?? 0);
    setPassClaims(splitClaimedMilestones(wallet.claimed_milestones).pass);
    setLastClaimedAt(wallet.last_claimed_at ?? null);
  }

  async function reloadWallet(): Promise<boolean> {
    if (!authUserId) return false;
    const requestId = ++walletRequestRef.current;
    const { data, error } = await supabase.rpc("my_wallet");
    if (error || !data) {
      if (error) console.warn("Kontostand konnte nicht geladen werden:", error.message);
      return false;
    }
    if (requestId === walletRequestRef.current) applyWallet(data as WalletRow);
    return true;
  }

  function refreshStars() {
    void reloadWallet();
  }

  // Profil laden, sobald eine echte Sitzung erkannt wird (oder einmalig
  // anlegen, falls die Zeile fehlt – z. B. bei sehr alten Konten). Die
  // Datenbank setzt dabei selbst die Startwerte (100 Sterne, 0 Punkte).
  const [profileLoaded, setProfileLoaded] = useState(false);
  useEffect(() => {
    setProfileLoaded(false);
    setPassClaims([]);
    if (!authUserId) return;
    let cancelled = false;
    (async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", authUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // Bewusst NICHT profileLoaded setzen: sonst würde der Namens-Sync
        // unten den Demo-Namen über das echte Profil schreiben.
        console.warn("Profil konnte nicht geladen werden:", error.message);
        return;
      }

      if (profile) {
        setDisplayName(profile.display_name);
      } else {
        await supabase.from("profiles").insert({ id: authUserId, display_name: displayName });
      }
      if (cancelled) return;
      // Saisonwechsel prüfen, bevor der Kontostand gelesen wird: setzt die
      // Saison-XP nach einem Wechsel einmalig auf 0 (supabase/saisonwechsel.sql).
      await startPassSeason();
      if (cancelled) return;
      const ok = await reloadWallet();
      if (cancelled || !ok) return;
      setProfileLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // Tab über einen Saisonwechsel hinweg offen gelassen: beim Zurückkehren
  // neu laden, damit die neue Saison (und der XP-Neustart) greift und keine
  // alten XP in die neue Saison geschrieben werden.
  useEffect(() => {
    function checkSeason() {
      if (document.visibilityState === "visible" && seasonChangedSinceLoad()) window.location.reload();
    }
    document.addEventListener("visibilitychange", checkSeason);
    window.addEventListener("focus", checkSeason);
    return () => {
      document.removeEventListener("visibilitychange", checkSeason);
      window.removeEventListener("focus", checkSeason);
    };
  }, []);

  // Den Anzeigenamen schreibt der Browser weiterhin selbst zurück – alles
  // andere im Profil (Sterne, Punkte, XP, Serie) ignoriert die Datenbank.
  useEffect(() => {
    if (!isRegistered || !authUserId || !profileLoaded) return;
    supabase
      .from("profiles")
      .update({ display_name: displayName, updated_at: new Date().toISOString() })
      .eq("id", authUserId)
      .then(({ error }) => {
        if (error) console.warn("Profil konnte nicht gespeichert werden:", error.message);
      });
  }, [displayName, isRegistered, authUserId, profileLoaded]);

  const passHonors = useMemo(() => getPassHonors(passXP, passClaims), [passXP, passClaims]);

  async function claimDailyBonus(): Promise<{ claimed: boolean; error: string | null; starsAdded?: number }> {
    if (!authUserId) {
      // Gast: Demo-Bonus nur im Browser.
      const now = new Date().toISOString();
      if (lastClaimedAt && isSameDay(lastClaimedAt, now)) return { claimed: false, error: null };
      const added = dailyBonusStarsFor(freeStars);
      setFreeStars((current) => current + added);
      setPassXP((current) => current + DAILY_BONUS_XP);
      setLastClaimedAt(now);
      addActivity("🎁", bonusActivityText(added));
      return { claimed: true, error: null, starsAdded: added };
    }
    const requestId = ++walletRequestRef.current;
    const { data, error } = await supabase.rpc("claim_daily_bonus");
    if (error || !data) {
      if (error) console.warn("Tagesbonus fehlgeschlagen:", error.message);
      return { claimed: false, error: "Der Bonus konnte gerade nicht abgeholt werden. Bitte versuch es gleich noch einmal." };
    }
    const result = data as WalletRow & { claimed: boolean; stars_added?: number };
    if (requestId === walletRequestRef.current) applyWallet(result);
    const starsAdded = result.stars_added ?? DAILY_BONUS_STARS;
    if (result.claimed) addActivity("🎁", bonusActivityText(starsAdded));
    return { claimed: result.claimed, error: null, starsAdded };
  }

  async function placeTip(matchId: string, homeScore: number, awayScore: number): Promise<SubmittedTip | null> {
    const match = matches.find((m) => m.id === matchId);
    // Einsatz nur bei Booster-Spielen (fest 20), normale Tipps sind gratis.
    const wanted = match?.booster ? BOOSTER_STAKE : 0;
    if (!authUserId) {
      // Gast: Demo-Einsatz nur im Browser (gleiche Regeln wie die Datenbank).
      if (wanted > freeStars) return null;
      const actual = wanted;
      let next = freeStars - actual;
      if (next <= 0 && actual > 0 && !guestRescueUsedRef.current) {
        next += RESCUE_BONUS_STARS;
        guestRescueUsedRef.current = true;
        addActivity("🎁", `Deine Sterne waren aufgebraucht – hier ${RESCUE_BONUS_STARS} Sterne geschenkt, damit's weitergeht.`);
      }
      setFreeStars(next);
      return submitTip(matchId, homeScore, awayScore, actual, displayName);
    }
    const saved = await submitTip(matchId, homeScore, awayScore, wanted, displayName);
    await reloadWallet();
    return saved;
  }

  async function spendStarsInShop(amount: number): Promise<boolean> {
    if (!authUserId) {
      if (freeStars < amount) return false;
      setFreeStars((current) => current - amount);
      return true;
    }
    const requestId = ++walletRequestRef.current;
    const { data, error } = await supabase.rpc("spend_stars", { p_amount: amount });
    if (error || !data) {
      if (error) console.warn("Einlösen fehlgeschlagen:", error.message);
      void reloadWallet();
      return false;
    }
    if (requestId === walletRequestRef.current) applyWallet(data as WalletRow);
    return true;
  }

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
  // Rahmenfarben) in einer eigenen Tabelle "profile_extras", die nur der
  // Besitzer selbst lesen darf (siehe supabase/profil-extras.sql). Fehlt die
  // Tabelle noch, bleibt alles wie bisher nur im Browser.
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  useEffect(() => {
    setExtrasLoaded(false);
    if (!authUserId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profile_extras")
        .select("photos, photo_visibility, rank_icon_id, frame_colors")
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
      }
      setExtrasLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) console.warn("Profil-Einstellungen konnten nicht gespeichert werden:", error.message);
      });
  }, [authUserId, extrasLoaded, photos, photoVisibility, selectedRankIconId, customFrameColors]);

  // Die Auswahl zusätzlich im öffentlichen Profil speichern, damit auch
  // andere Spieler sie in Rangliste, Chat und auf der Spielerseite sehen
  // (supabase/rang-icon-auswahl.sql). Erst nach dem Laden der gespeicherten
  // Auswahl, sonst würde die Standardauswahl sie überschreiben. Fehlt die
  // Spalte noch, bleibt es still bei der bisherigen Anzeige.
  useEffect(() => {
    if (!authUserId || !extrasLoaded || !profileLoaded || !selectedRankIconId) return;
    supabase
      .from("profiles")
      .update({ rank_icon_id: selectedRankIconId })
      .eq("id", authUserId)
      .then(({ error }) => {
        if (error) console.warn("Rang-Icon konnte nicht fürs Profil gespeichert werden:", error.message);
      });
  }, [authUserId, extrasLoaded, profileLoaded, selectedRankIconId]);

  const activeRankIcon =
    rankIconOptions.find((o) => o.id === selectedRankIconId) ?? getBestRankIcon(rankIconOptions);

  const isLowOnStars = freeStars <= LOW_STARS_THRESHOLD;

  // Auswertung, Endstand-Korrektur, Absage und Bonusfragen bucht die
  // Datenbank für alle Spieler selbst, sobald der Admin speichert. Sieht
  // dieser Browser ein Spiel, dessen Ergebnis beim eigenen Tipp noch nicht
  // angekommen ist, holt er Tipps und Kontostand neu – bei Bedarf noch zwei
  // Mal kurz danach, falls der Admin-Bereich gerade erst speichert.
  const syncedResultsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!authUserId || !profileLoaded || !myTipsLoaded || !contentLoaded) return;
    const outdated: string[] = [];
    for (const match of matches) {
      const tip = [...myTips].reverse().find((t) => t.matchId === match.id);
      if (tip) {
        if (match.status === "cancelled" && !tip.refunded) {
          outdated.push(`cancel:${tip.id}`);
        } else if (
          match.status === "finished" &&
          !tip.refunded &&
          match.liveHomeScore !== null &&
          match.liveAwayScore !== null &&
          (!tip.evaluated ||
            tip.evaluatedHomeScore !== match.liveHomeScore ||
            tip.evaluatedAwayScore !== match.liveAwayScore)
        ) {
          outdated.push(`tip:${tip.id}:${match.liveHomeScore}:${match.liveAwayScore}`);
        }
      }
      const correctIndex = match.bonusQuestion?.correctOptionIndex ?? null;
      const answer = myBonusAnswers.find((a) => a.matchId === match.id);
      if (
        answer &&
        correctIndex !== null &&
        (!answer.evaluated || answer.correct !== (answer.optionIndex === correctIndex))
      ) {
        outdated.push(`bonus:${answer.id}:${correctIndex}`);
      }
    }
    const fresh = outdated.filter((key) => !syncedResultsRef.current.has(key));
    if (fresh.length === 0) return;
    fresh.forEach((key) => syncedResultsRef.current.add(key));
    // Bewusst ohne Aufräumen beim nächsten Rendern: das erste Neuladen
    // ändert myTips, die späteren Versuche sollen trotzdem noch laufen.
    // Nach Logout/Kontowechsel verfallen sie (authUserIdRef).
    const scheduledFor = authUserId;
    for (const delay of [0, 3000, 10000]) {
      window.setTimeout(() => {
        if (authUserIdRef.current !== scheduledFor) return;
        void reloadMyTips();
        void reloadMyBonusAnswers();
        void reloadWallet();
      }, delay);
    }
    // reload* lesen bewusst den aktuellen Render-Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, myTips, myBonusAnswers, authUserId, profileLoaded, myTipsLoaded, contentLoaded]);

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
        placeTip,
        spendStarsInShop,
        refreshStars,
        stakeBudgetRemainingToday,
        isLowOnStars,
        tipsSubmitted,
        streakCount,
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
        sessionChecked,
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
