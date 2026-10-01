"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { supabase } from "@/lib/supabaseClient";
import { readPendingInvite } from "@/lib/leagueInvite";

export default function RegistrierenPage() {
  // isRegistered/authEmail/logout kommen jetzt direkt aus der echten
  // Supabase-Sitzung (siehe lib/UserContext.tsx) – gelten dadurch in der
  // ganzen App einheitlich, nicht nur auf dieser Seite.
  const { isRegistered, authEmail, logout, displayName } = useUser();
  const { showToast, celebrate } = useFeedback();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState(displayName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  // Kam man über einen Tipprunden-Einladungslink hierher, geht es nach dem
  // Einloggen direkt zurück zum Beitreten.
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  useEffect(() => {
    setPendingInvite(readPendingInvite());
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setSubmitting(true);
    setResult(null);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });

    setSubmitting(false);

    if (error) {
      setResult({ kind: "error", text: `Fehler von Supabase: ${error.message}` });
      return;
    }

    // War "Confirm email" in Supabase aktiviert, ist man nach dem Signup
    // noch NICHT eingeloggt (isRegistered bleibt false, bis die Mail
    // bestätigt und danach eingeloggt wird). Ist es deaktiviert, greift der
    // useEffect in UserContext sofort und isRegistered springt automatisch
    // auf true, ganz ohne Zutun dieser Seite.
    setResult({
      kind: "success",
      text: "Konto wurde bei Supabase angelegt! Falls eine Bestätigungsmail nötig ist, schau in dein Postfach und klick den Link – danach kannst du dich einloggen.",
    });
    celebrate();
    showToast("🎉 Bei Supabase registriert!", "gold");
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setResult(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (error) {
      setResult({ kind: "error", text: `Login fehlgeschlagen: ${error.message}` });
      return;
    }
    // Kein manuelles State-Update nötig – der Login löst automatisch das
    // onAuthStateChange in UserContext aus, isRegistered/authEmail
    // aktualisieren sich von selbst.
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

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">
        {mode === "register" ? "Registrieren" : "Einloggen"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {mode === "register"
          ? "Leg dein Spieler-Profil an, damit du in Rangliste, Feed und bei Freunden mit deinem Namen erkennbar bist."
          : "Melde dich mit deinem bestehenden Konto an."}
      </p>

      <form
        onSubmit={mode === "register" ? handleRegister : handleLogin}
        className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-5"
      >
        {mode === "register" && (
          <div>
            <label className="mb-1 block text-xs text-muted">Anzeigename</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Passwort {mode === "register" && "(mind. 6 Zeichen)"}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-gold py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
        >
          {submitting ? "Wird verarbeitet…" : mode === "register" ? "Jetzt registrieren" : "Einloggen"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            result.kind === "success" ? "border-gold/50 bg-gold/10 text-ink" : "border-red-500/50 bg-red-500/10 text-red-200"
          }`}
        >
          {result.text}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "register" ? "login" : "register");
          setResult(null);
        }}
        className="mt-4 w-full text-center text-xs text-muted underline underline-offset-2"
      >
        {mode === "register" ? "Schon ein Konto? Zum Login wechseln" : "Noch kein Konto? Zur Registrierung wechseln"}
      </button>
    </main>
  );
}
