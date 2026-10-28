"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { competitionCountry } from "@/lib/competitionFlag";
import { useFeedback } from "@/lib/FeedbackContext";
import { guestTeamData, GUEST_TEAM_GROUP } from "@/lib/guestTeam";
import { findDuplicateTeam } from "@/lib/teamName";
import type { Sport } from "@/lib/types";

// Admin -> Neues Spiel: unter der Team-Auswahl ein Gastteam nur mit Namen
// anlegen und gleich auswählen (siehe lib/guestTeam.ts). Kam das Spiel aus
// der API und fehlt dort ein eigenes Team, steht der API-Name schon drin.
export function GuestTeamButton({
  sport,
  competition,
  suggestedName,
  onCreated,
}: {
  sport: Sport;
  competition: string;
  suggestedName?: string;
  onCreated: (teamId: string) => void;
}) {
  const { teams, competitions, addTeam } = useAppData();
  const { showToast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Neuer API-Vorschlag: Feld gleich offen mit dem Namen.
  useEffect(() => {
    if (suggestedName) {
      setName(suggestedName);
      setOpen(true);
      setError(null);
    }
  }, [suggestedName]);

  const country = competitionCountry(sport, competition, competitions);
  const duplicate = findDuplicateTeam(teams, name, sport, country);

  async function create() {
    if (!name.trim() || saving) return;
    // Gibt es das Team schon, einfach das nehmen statt ein zweites anzulegen.
    if (duplicate) {
      onCreated(duplicate.id);
      setOpen(false);
      setName("");
      return;
    }
    setSaving(true);
    setError(null);
    const id = `team-${Date.now()}`;
    const data = guestTeamData(name, sport, country);
    const result = await addTeam(data, id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      showToast("✗ Gastteam nicht gespeichert", "info");
      return;
    }
    onCreated(id);
    setOpen(false);
    setName("");
    showToast(`✓ Gastteam „${data.name}“ angelegt.`, "success");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs font-semibold text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        + Gastteam (nur Name, graues Trikot)
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-edge bg-pitch p-3">
      <label className="mb-1.5 block text-xs text-muted">
        Gastteam: nur der Name, graues Trikot, steht in der Gruppe „{GUEST_TEAM_GROUP}“.
      </label>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            // Enter würde sonst das ganze Spiel-Formular abschicken.
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
          }}
          placeholder="z. B. SV Reichenau"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-base text-ink outline-none focus:border-gold"
        />
        <button
          type="button"
          onClick={create}
          disabled={!name.trim() || saving}
          className="shrink-0 rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-50"
        >
          {saving ? "Speichert…" : duplicate ? "Nehmen" : "Anlegen"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="shrink-0 text-xs text-muted hover:text-ink"
        >
          Abbrechen
        </button>
      </div>
      {duplicate && <p className="mt-1.5 text-xs text-muted">„{duplicate.name}“ gibt es schon, wird dann einfach ausgewählt.</p>}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
