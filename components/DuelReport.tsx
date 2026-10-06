"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ReportRow {
  art: string;
  text: string;
}

// Admin: "Auffällige Duelle" der letzten 30 Tage (supabase/duelle-gruppen.sql,
// admin_duel_report). Nur Anzeige – gesperrt wird niemand automatisch.
export function DuelReport() {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("admin_duel_report");
    setLoading(false);
    if (rpcError) {
      setError(
        /admin_duel_report/.test(rpcError.message)
          ? "Noch nicht eingerichtet: zuerst supabase/duelle-gruppen.sql ausführen."
          : "Bericht konnte nicht geladen werden."
      );
      return;
    }
    setRows((data as ReportRow[] | null) ?? []);
  }

  return (
    <div className="mb-7 rounded-card border border-edge bg-surface px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink">🕵️ Auffällige Duelle</p>
          <p className="text-sm text-muted">
            Hinweise auf Absprachen in den letzten 30 Tagen. Nur zum Anschauen, gesperrt wird niemand automatisch.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 self-start rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-wait sm:self-auto"
        >
          {loading ? "Wird geprüft…" : rows ? "Neu prüfen" : "Prüfen"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {rows && rows.length === 0 && <p className="mt-2 text-sm text-muted">✓ Nichts Auffälliges gefunden.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={i} className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm">
              <span className="block text-xs font-semibold text-gold">{row.art}</span>
              <span className="text-ink">{row.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
