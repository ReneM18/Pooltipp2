"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BioData, normalizeBio, roleDef, stationPlace, stationTitle, stationYears } from "@/lib/sportBio";

// Admin -> "Steckbriefe": eingetippte Vereine freigeben (vorher sehen andere
// sie nicht) und Steckbriefe als "✓ bestätigt" markieren. Datenbank-Funktionen:
// supabase/sport-steckbrief.sql.
interface Row {
  kind: "club" | "bio";
  key: string;
  label: string;
  detail: string;
  status: string;
}

export function SportBioAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_sport_bio_overview");
    if (error) {
      setError("Konnte nicht laden. Ist das SQL „sport-steckbrief.sql“ schon ausgeführt?");
      setRows([]);
      return;
    }
    setError(null);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(id: string, call: () => PromiseLike<{ error: unknown }>) {
    setBusy(id);
    const { error } = await call();
    setBusy(null);
    if (error) setError("Speichern hat nicht geklappt.");
    load();
  }

  if (rows === null) return <p className="text-sm text-muted">Lädt …</p>;

  const clubs = rows.filter((r) => r.kind === "club");
  const pendingClubs = clubs.filter((r) => r.status === "pending");
  const doneClubs = clubs.filter((r) => r.status !== "pending");
  const bios = rows.filter((r) => r.kind === "bio");

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Vereine prüfen ({pendingClubs.length})</h2>
        <p className="mb-3 text-xs text-muted">
          Eingetippte Vereine, die es in der App nicht gibt. Erst nach „Freigeben“ sehen andere Spieler den Namen.
        </p>
        {pendingClubs.length === 0 ? (
          <p className="text-sm text-muted">Nichts zu prüfen.</p>
        ) : (
          <ul className="space-y-2">
            {pendingClubs.map((c) => (
              <ClubRow key={c.key} row={c} busy={busy === c.key} onSet={(st) => run(c.key, () => supabase.rpc("admin_set_sport_club", { p_key: c.key, p_status: st }))} />
            ))}
          </ul>
        )}
        {doneClubs.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">Schon entschieden ({doneClubs.length})</summary>
            <ul className="mt-2 space-y-2">
              {doneClubs.map((c) => (
                <ClubRow key={c.key} row={c} busy={busy === c.key} onSet={(st) => run(c.key, () => supabase.rpc("admin_set_sport_club", { p_key: c.key, p_status: st }))} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink">Steckbriefe ({bios.length})</h2>
        <p className="mb-3 text-xs text-muted">„Bestätigen“ zeigt beim Spieler „✓ bestätigt“ statt „eigene Angabe“.</p>
        {bios.length === 0 ? (
          <p className="text-sm text-muted">Noch niemand hat einen Steckbrief ausgefüllt.</p>
        ) : (
          <ul className="space-y-2">
            {bios.map((b) => {
              let data: BioData = {};
              try {
                data = normalizeBio(JSON.parse(b.detail));
              } catch {
                data = {};
              }
              const verified = b.status === "verified";
              return (
                <li key={b.key} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-edge bg-surface p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{b.label}</p>
                    <p className="text-xs text-muted">
                      {(data.stations ?? [])
                        .map((st) => {
                          const place = [stationPlace(st), stationYears(st)].filter(Boolean).join(", ");
                          return `${roleDef(st.role).icon} ${stationTitle(st)}${place ? ` (${place})` : ""}`;
                        })
                        .join(" · ") || "Nur Erfolge/Fan seit"}
                      {(data.honors?.length ?? 0) > 0 && <span className="block">{data.honors!.join(" · ")}</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === b.key}
                    onClick={() => run(b.key, () => supabase.rpc("admin_set_sport_bio_verified", { p_user: b.key, p_verified: !verified }))}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                      verified ? "border-action/60 text-action" : "border-gold/60 text-gold"
                    }`}
                  >
                    {verified ? "✓ bestätigt – zurücknehmen" : "Bestätigen"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClubRow({ row, busy, onSet }: { row: Row; busy: boolean; onSet: (status: "approved" | "rejected" | "pending") => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-edge bg-surface p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{row.label}</p>
        <p className="text-xs text-muted">
          zuerst von {row.detail}
          {row.status === "approved" ? " · freigegeben" : row.status === "rejected" ? " · abgelehnt" : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {row.status !== "approved" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSet("approved")}
            className="rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-pitch disabled:opacity-60"
          >
            Freigeben
          </button>
        )}
        {row.status !== "rejected" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSet("rejected")}
            className="rounded-full border border-edge px-3 py-1.5 text-xs font-semibold text-muted disabled:opacity-60"
          >
            Ablehnen
          </button>
        )}
      </div>
    </li>
  );
}
