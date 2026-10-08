"use client";

import { useState, FormEvent } from "react";
import { TIPPRUNDEN_ENABLED } from "@/lib/types";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { setFlashToast } from "@/lib/flashToast";
import { supabase } from "@/lib/supabaseClient";
import { MIN_PASSWORD_LENGTH, translateAuthError } from "@/lib/authMessages";

// Im Profil unter "Konto": Passwort ändern und Konto löschen. Nur für
// eingeloggte Spieler sichtbar.
const CONFIRM_WORD = "LÖSCHEN";

const inputClass =
  "w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold";

export default function AccountSettings() {
  const { authEmail, authUserId, isAdmin } = useUser();
  const { showToast } = useFeedback();

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [repeatPw, setRepeatPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function closePw() {
    setPwOpen(false);
    setCurrentPw("");
    setNewPw("");
    setRepeatPw("");
    setPwError(null);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (!authEmail) return;
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      setPwError(`Das neue Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen haben.`);
      return;
    }
    if (newPw !== repeatPw) {
      setPwError("Die beiden neuen Passwörter stimmen nicht überein.");
      return;
    }
    setPwSaving(true);
    // Erst das aktuelle Passwort prüfen, damit niemand an einem kurz
    // unbeaufsichtigten Handy das Passwort ändern kann.
    const { error: checkError } = await supabase.auth.signInWithPassword({ email: authEmail, password: currentPw });
    if (checkError) {
      setPwSaving(false);
      setPwError(
        /invalid login credentials/i.test(checkError.message)
          ? "Dein aktuelles Passwort stimmt nicht."
          : translateAuthError(checkError.message)
      );
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (error) {
      setPwError(translateAuthError(error.message));
      return;
    }
    closePw();
    showToast("🔒 Passwort geändert", "gold");
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) return;
    setDeleting(true);
    setDeleteError(null);
    // Löscht ausschließlich das eigene Konto (supabase/konto-loeschen.sql).
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      setDeleteError(
        /could not find the function|does not exist/i.test(error.message)
          ? "Konto löschen ist noch nicht eingerichtet. Bitte melde dich beim PoolTipp-Team."
          : /admin/i.test(error.message)
          ? "Das Admin-Konto kann nicht gelöscht werden."
          : translateAuthError(error.message)
      );
      return;
    }
    // Das Login gibt es nicht mehr: nur noch die Sitzung auf diesem Gerät
    // beenden und gerätespezifische Merker des Kontos wegräumen.
    try {
      for (const key of Object.keys(localStorage)) {
        if (authUserId && key.includes(authUserId)) localStorage.removeItem(key);
      }
    } catch {
      // Ohne Zugriff auf den Speicher ist nichts aufzuräumen.
    }
    setFlashToast("Dein Konto wurde gelöscht. Danke fürs Mitspielen!");
    await supabase.auth.signOut({ scope: "local" });
    window.location.replace("/");
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="rounded-card border border-edge bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Passwort ändern</p>
            <p className="text-xs text-muted">Du brauchst dafür dein aktuelles Passwort.</p>
          </div>
          {!pwOpen && (
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              className="shrink-0 rounded-full border border-edge px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
            >
              Ändern
            </button>
          )}
        </div>
        {pwOpen && (
          <form onSubmit={handleChangePassword} className="mt-4 flex flex-col gap-3">
            <div>
              <label htmlFor="pw-current" className="mb-1 block text-xs text-muted">Aktuelles Passwort</label>
              <input
                id="pw-current"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="mb-1 block text-xs text-muted">
                Neues Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen)
              </label>
              <input
                id="pw-new"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pw-repeat" className="mb-1 block text-xs text-muted">Neues Passwort wiederholen</label>
              <input
                id="pw-repeat"
                type="password"
                value={repeatPw}
                onChange={(e) => setRepeatPw(e.target.value)}
                autoComplete="new-password"
                required
                className={inputClass}
              />
            </div>
            {pwError && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{pwError}</div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="submit"
                disabled={pwSaving}
                className="rounded-full bg-action px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
              >
                {pwSaving ? "Wird gespeichert…" : "Neues Passwort speichern"}
              </button>
              <button
                type="button"
                onClick={closePw}
                className="rounded-full border border-edge px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}
      </div>

      {!isAdmin && (
        <div className="rounded-card border border-red-500/30 bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Konto löschen</p>
              <p className="text-xs text-muted">Entfernt dein Konto und deine Daten endgültig.</p>
            </div>
            {!deleteOpen && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="shrink-0 rounded-full border border-red-500/50 px-4 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10"
              >
                Löschen…
              </button>
            )}
          </div>
          {deleteOpen && (
            <form onSubmit={handleDelete} className="mt-4 flex flex-col gap-3">
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-ink">
                <p className="font-semibold text-red-200">Das kann nicht rückgängig gemacht werden.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  <li>Gelöscht werden dein Profil, deine Coins, Rangpunkte und Saison-XP, deine Tipps, Freundschaften und Vereine.</li>
                  <li>Du verschwindest aus Rangliste, Vereinswertung{TIPPRUNDEN_ENABLED ? " und deinen Tipprunden" : ""}.</li>
                  <li>Offene Duelle werden abgebrochen, deine Gegner bekommen ihren Einsatz zurück.</li>
                  {TIPPRUNDEN_ENABLED && <li>Tipprunden, die du gegründet hast, übernimmt das Mitglied, das am längsten dabei ist.</li>}
                  <li>Deine Chat-Nachrichten und Kommentare bleiben stehen, aber als „Gelöschter Spieler“.</li>
                </ul>
              </div>
              <div>
                <label htmlFor="delete-confirm" className="mb-1 block text-xs text-muted">
                  Tippe <span className="font-semibold text-ink">{CONFIRM_WORD}</span> ein, um zu bestätigen
                </label>
                <input
                  id="delete-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className={inputClass}
                />
              </div>
              {deleteError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">{deleteError}</div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={deleting || confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                  className="rounded-full bg-red-600 px-5 py-2.5 font-display text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                >
                  {deleting ? "Wird gelöscht…" : "Konto endgültig löschen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                  className="rounded-full border border-edge px-5 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
