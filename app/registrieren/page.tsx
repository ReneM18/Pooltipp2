"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { supabase } from "@/lib/supabaseClient";
import { readPendingInvite } from "@/lib/leagueInvite";
import { translateAuthError } from "@/lib/authMessages";

// "forgot" = "Passwort vergessen?": nur E-Mail eingeben, Link anfordern.
type Mode = "login" | "register" | "forgot";

type Notice =
  | { kind: "error"; text: string }
  | { kind: "confirm"; email: string }
  | { kind: "unconfirmed"; email: string }
  | { kind: "exists" }
  | { kind: "resetSent"; email: string };

export default function RegistrierenPage() {
  // isRegistered/authEmail/logout kommen jetzt direkt aus der echten
  // Supabase-Sitzung (siehe lib/UserContext.tsx) – gelten dadurch in der
  // ganzen App einheitlich, nicht nur auf dieser Seite.
  const { isRegistered, authEmail, logout } = useUser();
  const { showToast, celebrate } = useFeedback();
  const router = useRouter();

  // Standard ist "Einloggen": Wer schon ein Konto hat, soll nicht erst an
  // der Registrierung vorbei müssen. Neue Spieler wechseln oben mit dem
  // gleich großen Reiter "Registrieren" (oder kommen per
  // /registrieren?modus=registrieren direkt dorthin).
  const [mode, setMode] = useState<Mode>("login");
  // Leer starten: Neue Besucher sollen ihren eigenen Namen eintippen, statt
  // einen vorausgefüllten Demo-Namen zu übernehmen.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resending, setResending] = useState(false);
  // Kam man über einen Tipprunden-Einladungslink hierher, geht es nach dem
  // Einloggen direkt zurück zum Beitreten.
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  useEffect(() => {
    setPendingInvite(readPendingInvite());
    const modus = new URLSearchParams(window.location.search).get("modus");
    if (modus === "registrieren") setMode("register");
    if (modus === "passwort-vergessen") setMode("forgot");
  }, []);

  // Nach dem Einloggen mit offener Einladung automatisch zur Tipprunde.
  useEffect(() => {
    if (isRegistered && pendingInvite) {
      router.replace(`/teams?code=${encodeURIComponent(pendingInvite)}`);
    }
  }, [isRegistered, pendingInvite, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setNotice(null);
  }

  // Wohin der Link in der Bestätigungsmail zurückführt. Muss in Supabase
  // unter Authentication -> URL Configuration -> Redirect URLs erlaubt sein,
  // sonst nimmt Supabase die dort eingestellte "Site URL".
  function confirmRedirectUrl() {
    const origin = window.location.origin;
    return pendingInvite ? `${origin}/teams?code=${encodeURIComponent(pendingInvite)}` : `${origin}/registrieren`;
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setSubmitting(true);
    setNotice(null);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: confirmRedirectUrl() },
    });

    setSubmitting(false);

    // Bereits registrierte E-Mail: Bei abgeschalteter Mail-Bestätigung kommt
    // ein Fehler, bei eingeschalteter liefert Supabase (aus Datenschutz-
    // gründen) einen Nutzer ohne "identities" zurück.
    const alreadyRegistered =
      (error && /already registered|already exists/i.test(error.message)) ||
      (!error && data.user && data.user.identities?.length === 0);
    if (alreadyRegistered) {
      setNotice({ kind: "exists" });
      return;
    }

    if (error) {
      setNotice({ kind: "error", text: translateAuthError(error.message) });
      return;
    }

    if (data.session) {
      // Mail-Bestätigung ist in Supabase aus: Man ist sofort eingeloggt,
      // UserContext bekommt das über onAuthStateChange mit.
      celebrate();
      showToast("🎉 Willkommen bei PoolTipp!", "gold");
      return;
    }

    // Mail-Bestätigung ist an: Klar sagen, was jetzt zu tun ist, und das
    // Formular schon auf "Einloggen" mit vorbefüllter E-Mail umstellen.
    setMode("login");
    setPassword("");
    setNotice({ kind: "confirm", email: email.trim() });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setNotice(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (error) {
      if (/not confirmed/i.test(error.message)) {
        setNotice({ kind: "unconfirmed", email: email.trim() });
      } else {
        setNotice({ kind: "error", text: translateAuthError(error.message) });
      }
      return;
    }
    // Kein manuelles State-Update nötig – der Login löst automatisch das
    // onAuthStateChange in UserContext aus, isRegistered/authEmail
    // aktualisieren sich von selbst.
  }

  // "Passwort vergessen?": Supabase schickt eine Mail mit einem Link zu
  // /passwort-neu. Die Meldung danach ist bewusst immer gleich – sie verrät
  // nicht, ob zu dieser E-Mail überhaupt ein Konto existiert.
  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setNotice(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/passwort-neu?reset=1`,
    });
    setSubmitting(false);
    if (error && !/user not found|not registered/i.test(error.message)) {
      setNotice({ kind: "error", text: translateAuthError(error.message) });
      return;
    }
    setNotice({ kind: "resetSent", email: email.trim() });
  }

  async function handleResend(address: string) {
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: confirmRedirectUrl() },
    });
    setResending(false);
    if (error) {
      setNotice({ kind: "error", text: translateAuthError(error.message) });
    } else {
      showToast("📧 Bestätigungsmail neu verschickt", "gold");
    }
  }

  if (isRegistered) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center">
        <p className="text-5xl">✓</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Du bist eingeloggt</h1>
        <p className="mt-2 text-sm text-muted">
          Angemeldet als <span className="font-semibold text-ink">{authEmail}</span>
        </p>
        {pendingInvite && (
          <Link
            href={`/teams?code=${encodeURIComponent(pendingInvite)}`}
            className="mt-6 block rounded-full bg-blue-500 px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
          >
            Weiter zur Tipprunde
          </Link>
        )}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-6 rounded-full border border-edge px-5 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          {loggingOut ? "…" : "Ausloggen"}
        </button>
      </main>
    );
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-full py-2.5 font-display text-base font-semibold transition-colors ${
      active ? "bg-gold text-pitch" : "text-muted hover:text-ink"
    }`;

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div role="tablist" className="mb-6 flex gap-1 rounded-full border border-edge bg-surface p-1">
        <button type="button" role="tab" aria-selected={mode !== "register"} onClick={() => switchMode("login")} className={tabClass(mode !== "register")}>
          Einloggen
        </button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")} className={tabClass(mode === "register")}>
          Registrieren
        </button>
      </div>

      <h1 className="mb-1 font-display text-2xl font-bold text-ink">
        {mode === "register" ? "Neues Konto anlegen" : mode === "forgot" ? "Passwort vergessen?" : "Willkommen zurück"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {mode === "register"
          ? "Leg dein Spieler-Profil an, damit du in Rangliste, Feed und bei Freunden mit deinem Namen erkennbar bist."
          : mode === "forgot"
          ? "Kein Problem. Gib deine E-Mail ein, wir schicken dir einen Link, mit dem du ein neues Passwort festlegst."
          : "Melde dich mit deiner E-Mail und deinem Passwort an."}
      </p>

      {notice?.kind === "confirm" && (
        <div className="mb-5 rounded-card border border-gold/60 bg-gold/10 p-4 text-sm text-ink">
          <p className="font-display text-base font-semibold">📧 Fast geschafft! Bitte bestätige deine <span className="whitespace-nowrap">E-Mail</span>.</p>
          <p className="mt-2">
            Wir haben dir eine Mail an <span className="font-semibold [overflow-wrap:anywhere]">{notice.email}</span> geschickt.
            Öffne sie und tippe auf den Bestätigungslink. Danach logge dich hier mit deinem Passwort ein.
          </p>
          <p className="mt-2 text-xs text-muted">Keine Mail da? Schau auch im Spam-Ordner nach.</p>
          <button
            type="button"
            onClick={() => handleResend(notice.email)}
            disabled={resending}
            className="mt-3 text-sm font-semibold text-gold underline underline-offset-2 disabled:opacity-60"
          >
            {resending ? "Wird verschickt…" : "Mail nochmal schicken"}
          </button>
        </div>
      )}

      {notice?.kind === "resetSent" && (
        <div className="mb-5 rounded-card border border-gold/60 bg-gold/10 p-4 text-sm text-ink">
          <p className="font-display text-base font-semibold">📧 Schau in dein Postfach</p>
          <p className="mt-2">
            Wenn es zu <span className="font-semibold [overflow-wrap:anywhere]">{notice.email}</span> ein Konto gibt, ist
            jetzt eine Mail mit einem Link unterwegs. Tippe darauf und lege dein neues Passwort fest.
          </p>
          <p className="mt-2 text-xs text-muted">
            Keine Mail da? Schau auch im Spam-Ordner nach. Der Link gilt nur kurze Zeit und nur einmal.
          </p>
        </div>
      )}

      {mode === "forgot" ? (
        <form onSubmit={handleForgot} className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-5">
          <div>
            <label htmlFor="forgot-email" className="mb-1 block text-xs text-muted">E-Mail</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-full bg-gold py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
          >
            {submitting ? "Wird verschickt…" : notice?.kind === "resetSent" ? "Link nochmal schicken" : "Link zum Zurücksetzen schicken"}
          </button>
        </form>
      ) : (
      <form
        onSubmit={mode === "register" ? handleRegister : handleLogin}
        className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-5"
      >
        {mode === "register" && (
          <div>
            <label htmlFor="reg-name" className="mb-1 block text-xs text-muted">Anzeigename</label>
            <input
              id="reg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wie sollen dich andere sehen?"
              autoComplete="nickname"
              required
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="mb-1 block text-xs text-muted">E-Mail</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label htmlFor="auth-password" className="mb-1 block text-xs text-muted">
            Passwort {mode === "register" && "(mind. 6 Zeichen)"}
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={6}
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="mt-2 text-sm font-semibold text-gold underline underline-offset-2"
            >
              Passwort vergessen?
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-gold py-3 font-display text-base font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
        >
          {submitting ? "Wird verarbeitet…" : mode === "register" ? "Jetzt registrieren" : "Einloggen"}
        </button>
      </form>
      )}

      {notice?.kind === "error" && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{notice.text}</div>
      )}

      {notice?.kind === "unconfirmed" && (
        <div className="mt-4 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm text-ink">
          <p>
            Deine E-Mail ist noch nicht bestätigt. Öffne die Mail von PoolTipp und tippe auf den Link, dann klappt das
            Einloggen.
          </p>
          <button
            type="button"
            onClick={() => handleResend(notice.email)}
            disabled={resending}
            className="mt-2 font-semibold text-gold underline underline-offset-2 disabled:opacity-60"
          >
            {resending ? "Wird verschickt…" : "Mail nochmal schicken"}
          </button>
        </div>
      )}

      {notice?.kind === "exists" && (
        <div className="mt-4 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm text-ink">
          <p>Diese E-Mail ist schon registriert. Bitte logge dich ein.</p>
          <button
            type="button"
            onClick={() => {
              switchMode("login");
              setPassword("");
            }}
            className="mt-3 w-full rounded-full bg-gold py-2.5 font-display text-base font-semibold text-pitch transition-colors hover:bg-gold/90"
          >
            Zum Einloggen
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => switchMode(mode === "login" ? "register" : "login")}
        className="mt-5 w-full rounded-full border border-edge px-4 py-3 text-center font-display text-sm sm:text-base font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
      >
        {mode === "register"
          ? "Schon ein Konto? Hier einloggen"
          : mode === "forgot"
          ? "Passwort wieder eingefallen? Zum Einloggen"
          : "Noch kein Konto? Hier registrieren"}
      </button>
    </main>
  );
}
