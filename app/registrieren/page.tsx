"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { supabase } from "@/lib/supabaseClient";

export default function RegistrierenPage() {
  const { isRegistered, register, displayName } = useUser();
  const { showToast, celebrate } = useFeedback();
  const router = useRouter();

  // "register" = Konto anlegen, "login" = mit bestehendem Konto einloggen.
  // Beides auf einer Seite, weil wir hier gerade nur testen, ob die
  // Supabase-Anbindung grundsätzlich funktioniert – noch keine echte
  // Verzahnung mit dem Rest der App (Rangliste, Tipps etc.).
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState(displayName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Nur für den Test: zeigt an, ob im Browser gerade eine echte
  // Supabase-Sitzung aktiv ist, und bietet einen Logout-Button dafür.
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    setLoggingOut(false);
    setResult({ kind: "success", text: "Ausgeloggt." });
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

    // Test-Erfolg: Der Account wurde bei Supabase angelegt. Ob man sich
    // sofort einloggen kann, hängt davon ab, ob "Confirm email" in den
    // Supabase-Auth-Einstellungen an ist (Standard: an -> erst nach Klick
    // auf den Bestätigungslink in der Mail nutzbar).
    setResult({
      kind: "success",
      text: data.user
        ? "Konto wurde bei Supabase angelegt! Prüf jetzt im Supabase-Dashboard unter Authentication -> Users, ob der Eintrag erscheint. Falls eine Bestätigungsmail nötig ist, bekommst du die gerade zugeschickt."
        : "Anfrage war erfolgreich, aber es kam keine User-Rückmeldung – bitte im Supabase-Dashboard nachschauen.",
    });

    // Bestehende, lokale "isRegistered"-Logik bleibt vorerst zusätzlich
    // aktiv, damit sich der Rest der App (z.B. Navbar) nicht anders verhält
    // als bisher, solange wir noch testen.
    register();
    celebrate();
    showToast("🎉 Bei Supabase registriert!", "gold");
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setResult(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (error) {
      setResult({ kind: "error", text: `Login fehlgeschlagen: ${error.message}` });
      return;
    }

    setResult({
      kind: "success",
      text: `Eingeloggt als ${data.user?.email}. Die Supabase-Verbindung funktioniert also auch fürs Einloggen.`,
    });
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">
        {mode === "register" ? "Registrieren" : "Einloggen"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {mode === "register"
          ? "Testseite: legt ein echtes Konto bei Supabase an (noch nicht mit dem Rest der App verknüpft)."
          : "Testseite: prüft, ob der Login mit einem bereits angelegten Konto funktioniert."}
      </p>

      {sessionEmail && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-ink">
          <span>
            Aktive Sitzung: <span className="font-semibold">{sessionEmail}</span>
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-full border border-edge px-3 py-1 text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
          >
            {loggingOut ? "…" : "Ausloggen"}
          </button>
        </div>
      )}

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
