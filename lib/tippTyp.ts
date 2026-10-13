"use client";

// Dein Tipp-Typ (Rene, 13.10.2026): Was für ein Tipper ist jemand?
// Gerechnet wird in der Datenbank (supabase/tipp-typ.sql) aus den schon
// ausgewerteten Tipps. Hier stehen nur Namen, Emojis und Texte dazu.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { SPORT_ICONS, Sport, sportLabel } from "@/lib/types";

export interface TippTrait {
  id: string;
  value: number;
  sport?: string;
}

export type TippTypResult =
  | { state: "loading" }
  | { state: "missing" } // SQL noch nicht gelaufen
  | { state: "hidden" } // Spieler zeigt seine Statistik nicht
  | { state: "notEnough"; evaluated: number; needed: number }
  | { state: "ready"; evaluated: number; traits: TippTrait[] };

export interface TraitInfo {
  emoji: string;
  name: string;
  text: string;
}

const pct = (v: number) => `${Math.round(v).toLocaleString("de-DE")} %`;
const num = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Name, Emoji und Satz zu einer Eigenschaft (neutral formuliert: passt für dich und andere). */
export function traitInfo(t: TippTrait): TraitInfo {
  switch (t.id) {
    case "exakt":
      return { emoji: "🎯", name: "Exakt-Künstler", text: `${pct(t.value)} der Ergebnis-Tipps exakt richtig, viel mehr als im Schnitt.` };
    case "treffsicher":
      return { emoji: "💎", name: "Treffsicher", text: `${pct(t.value)} der Tipps richtig.` };
    case "aussenseiter":
      return { emoji: "🦁", name: "Mutiger Außenseiter", text: `${pct(t.value)} der Tipps gegen die Mehrheit.` };
    case "strom":
      return { emoji: "🐑", name: "Mit dem Strom", text: `Fast immer wie die Mehrheit getippt (nur ${pct(t.value)} dagegen).` };
    case "vereinsbrille":
      return { emoji: "❤️", name: "Vereinsbrille", text: `Bei Spielen des Herzensvereins zu ${pct(t.value)} auf seinen Sieg getippt 😅` };
    case "lastminute":
      return { emoji: "⏰", name: "Last-Minute-Tipper", text: `${pct(t.value)} der Tipps in der letzten Stunde vor Tippschluss.` };
    case "fruehplaner":
      return { emoji: "📅", name: "Früh-Planer", text: `${pct(t.value)} der Tipps mehr als einen Tag vor Tippschluss.` };
    case "remis":
      return { emoji: "🤝", name: "Unentschieden-Fan", text: `${pct(t.value)} der Fußball-Tipps auf Unentschieden.` };
    case "torfestival":
      return { emoji: "🎆", name: "Torfestival", text: `Im Schnitt ${num(t.value)} Tore pro Fußball-Tipp.` };
    case "defensiv":
      return { emoji: "🧱", name: "Defensiv-Denker", text: `Im Schnitt nur ${num(t.value)} Tore pro Fußball-Tipp.` };
    case "spezialist": {
      const sport = (t.sport ?? "") as Sport;
      const label = sportLabel(sport) || "Sport";
      return {
        emoji: SPORT_ICONS[sport] ?? "🏅",
        name: `${label}-Spezialist`,
        text: `${pct(t.value)} richtig bei ${label}, deutlich besser als in den anderen Sportarten.`,
      };
    }
    case "allrounder":
    default:
      return { emoji: "⚖️", name: "Allrounder", text: `Keine Ausreißer: überall solide getippt (${pct(t.value)} richtig).` };
  }
}

export function useTippTyp(userId: string | null | undefined, enabled = true): TippTypResult {
  const [result, setResult] = useState<TippTypResult>({ state: "loading" });

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelled = false;
    setResult({ state: "loading" });
    supabase.rpc("tipp_typ", { p_user: userId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        if (error) console.warn("Tipp-Typ konnte nicht geladen werden:", error.message);
        setResult({ state: "missing" });
        return;
      }
      const d = data as { visible?: boolean; enough?: boolean; evaluated?: number; needed?: number; traits?: TippTrait[] };
      if (d.visible === false) setResult({ state: "hidden" });
      else if (!d.enough) setResult({ state: "notEnough", evaluated: Number(d.evaluated) || 0, needed: Number(d.needed) || 15 });
      else
        setResult({
          state: "ready",
          evaluated: Number(d.evaluated) || 0,
          traits: (Array.isArray(d.traits) ? d.traits : []).filter((t) => t && typeof t.id === "string"),
        });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return result;
}
