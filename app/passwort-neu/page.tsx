"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import StartLink from "@/components/StartLink";
import { supabase } from "@/lib/supabaseClient";
import { useFeedback } from "@/lib/FeedbackContext";
import { MIN_PASSWORD_LENGTH, translateAuthError } from "@/lib/authMessages";

// Ziel des Links aus der "Passwort vergessen?"-Mail
// (/passwort-neu?reset=1#access_token=…&type=recovery). Der Supabase-Client
// liest den Link selbst aus und meldet die Person damit vorübergehend an;
// hier legt sie dann ihr neues Passwort fest.
type Phase = "checking" | "ready" | "expired" | "noLink" | "done";

function linkError(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return params.get("error_code") || params.get("error") || query.get("error_code") || query.get("error");
}

export default function PasswortNeuPage() {
  const { showToast } = useFeedback();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Abgelaufener oder schon benutzter Link: Supabase hängt dann einen
    // Fehler an die Adresse statt einer Anmeldung.
    if (linkError()) {
      setPhase("expired");
      return;
    }
    const fromResetMail =
      new URLSearchParams(window.location.search).get("reset") === "1" || /type=recovery/.test(window.location.hash);
    let cancelled = false;
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setPhase("ready");
    });
    // getSession wartet, bis der Client den Link ausgewertet hat.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setPhase((current) => {
        if (current === "ready") return current;
        if (!fromResetMail) return "noLink";
        return data.session ? "ready" : "expired";
      });
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
      return;
    }
    if (password !== repeat) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }
    setPhase("done");
    showToast("🔒 Neues Passwort gespeichert", "gold");
  }

  const inputClass =
    "w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold";
  const primaryClass =
    "block w-full rounded-full bg-action py-3 text-center font-display text-base font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60";

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      {phase === "checking" && <p className="py-10 text-center text-sm text-muted">Link wird geprüft…</p>}

      {phase === "expired" && (
        <div className="rounded-card border border-edge bg-surface p-5">
          <p className="text-4xl">⏰</p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">Link abgelaufen</h1>
          <p className="mt-2 text-sm text-muted">
            Dieser Link funktioniert nicht mehr. Er gilt nur kurze Zeit und nur einmal. Fordere einfach einen neuen an.
          </p>
          <Link href="/registrieren?modus=passwort-vergessen" className={`mt-5 ${primaryClass}`}>
            Neuen Link anfordern
          </Link>
        </div>
      )}

      {phase === "noLink" && (
        <div className="rounded-card border border-edge bg-surface p-5">
          <h1 className="font-display text-2xl font-bold text-ink">Neues Passwort</h1>
          <p className="mt-2 text-sm text-muted">
            Diese Seite öffnest du über den Link in der Mail „Passwort zurücksetzen“. Bist du eingeloggt, kannst du dein
            Passwort auch im Profil unter „Einstellungen“ ändern.
          </p>
          <Link href="/registrieren?modus=passwort-vergessen" className={`mt-5 ${primaryClass}`}>
            Passwort vergessen?
          </Link>
          <Link
            href="/profil#einstellungen"
            className="mt-3 block w-full rounded-full border border-edge py-3 text-center font-display text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
          >
            Zum Profil
          </Link>
        </div>
      )}

      {phase === "ready" && (
        <>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">Neues Passwort festlegen</h1>
          <p className="mb-6 text-sm text-muted">Wähle ein neues Passwort mit mindestens {MIN_PASSWORD_LENGTH} Zeichen.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-5">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-xs text-muted">Neues Passwort</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="new-password-repeat" className="mb-1 block text-xs text-muted">Neues Passwort wiederholen</label>
              <input
                id="new-password-repeat"
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>
            <button type="submit" disabled={saving} className={`mt-1 ${primaryClass}`}>
              {saving ? "Wird gespeichert…" : "Passwort speichern"}
            </button>
          </form>
          {error && (
            <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
          )}
        </>
      )}

      {phase === "done" && (
        <div className="rounded-card border border-gold/60 bg-gold/10 p-5 text-center">
          <p className="text-5xl">✓</p>
          <h1 className="mt-3 font-display text-2xl font-bold text-ink">Passwort geändert</h1>
          <p className="mt-2 text-sm text-ink">Ab jetzt loggst du dich mit dem neuen Passwort ein. Du bist schon angemeldet.</p>
          <StartLink className={`mt-5 ${primaryClass}`}>
            Weiter zu PoolTipp
          </StartLink>
        </div>
      )}
    </main>
  );
}
