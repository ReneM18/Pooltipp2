"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PassHonors, getPassHonors, splitClaimedMilestones, CURRENT_SEASON } from "@/lib/seasons";
import { useUser } from "@/lib/UserContext";
import { getActiveFrame } from "@/lib/seasonPass";
import { applyPassDisplay, parsePassDisplay, PublicPassDisplay, verifiedOtherFrame } from "@/lib/passDisplay";

// Titel und Abzeichen aus dem Saison-Pass (Belohnungsarten "title" und
// "badge"). size "sm" für den Chat neben dem Namen, "md" fürs Profil.
export default function PassHonorTags({
  honors,
  size = "md",
}: {
  honors: Pick<PassHonors, "title" | "badges">;
  size?: "sm" | "md";
}) {
  if (!honors.title && honors.badges.length === 0) return null;
  const pill =
    size === "sm"
      ? "px-1.5 py-px text-[10px]"
      : "px-2.5 py-0.5 text-xs";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {honors.badges.map((b) => (
        <span
          key={b.label}
          title={`Abzeichen aus dem Saison-Pass: ${b.label}`}
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gold bg-gold/15 font-display font-bold text-gold ${pill}`}
        >
          <span aria-hidden>{b.icon}</span>
          {b.label}
        </span>
      ))}
      {honors.title && (
        <span
          title={`Titel aus dem Saison-Pass: ${honors.title.label}`}
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-edge bg-surface-hover font-display font-semibold text-ink ${pill}`}
        >
          <span aria-hidden>{honors.title.icon}</span>
          {honors.title.label}
        </span>
      )}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Titel/Abzeichen/Rahmen ANDERER Spieler (Chat, Kommentare, Rangliste,
// Spielerseite). Kommen aus deren Profil (pass_xp + claimed_milestones +
// pass_display, für alle lesbar) und zeigen nur, was der Besitzer zeigen will.
// Einmal geladene Werte werden für die ganze Sitzung gemerkt.
// Hat man unter Profil -> Einstellungen "Deko anderer Spieler" ausgeschaltet,
// liefern die Hooks nichts (nur die eigene Ansicht, den anderen bleibt alles).
// Für die eigene ID gelten immer die eigenen, aktuellen Werte.
// ----------------------------------------------------------------------------
export type OtherFrame = NonNullable<PublicPassDisplay["shownFrame"]>;

interface OtherDeco {
  honors: PassHonors;
  frame: OtherFrame | null;
}

const decoCache = new Map<string, OtherDeco>();

type HonorRow = {
  id: string;
  pass_xp: unknown;
  claimed_milestones: unknown;
  pass_season_id?: string | null;
  pass_display?: unknown;
};

// pass_season_id gibt es erst nach supabase/saisonwechsel.sql, pass_display
// erst nach supabase/pass-deko.sql – bis dahin ohne diese Spalten laden.
async function loadHonorRows(ids: string[]): Promise<HonorRow[] | null> {
  const selects = [
    "id, pass_xp, claimed_milestones, pass_season_id, pass_display",
    "id, pass_xp, claimed_milestones, pass_season_id",
    "id, pass_xp, claimed_milestones",
  ];
  for (const columns of selects) {
    const res = await supabase.from("profiles").select(columns).in("id", ids);
    if (!res.error) return res.data as unknown as HonorRow[];
  }
  return null;
}
const requested = new Set<string>();

function useOtherPlayersDeco(userIds: (string | null | undefined)[]): Record<string, OtherDeco> {
  const [, forceUpdate] = useState(0);
  const { authUserId, hideOthersDeco, shownPassHonors, passXP, hasPremiumPass, customFrameColors, passDisplay } =
    useUser();
  const key = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort().join(",");

  useEffect(() => {
    if (!key) return;
    const missing = key.split(",").filter((id) => !requested.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.add(id));
    let cancelled = false;
    loadHonorRows(missing).then((data) => {
      if (!data) {
        missing.forEach((id) => requested.delete(id));
        return;
      }
      for (const row of data) {
        // XP aus einer früheren Saison zählen nicht für die laufende (der
        // Spieler war seit dem Saisonwechsel noch nicht da). Was er damals
        // erreicht hat, steht ohnehin in claimed_milestones.
        const xpCounts =
          typeof row.pass_xp === "number" &&
          (row.pass_season_id === undefined || row.pass_season_id === CURRENT_SEASON.theme.id);
        const xp = xpCounts ? (row.pass_xp as number) : null;
        const owned = getPassHonors(xp, splitClaimedMilestones(row.claimed_milestones).pass);
        const display = parsePassDisplay(row.pass_display);
        const shown = (row.pass_display as PublicPassDisplay | null | undefined)?.shownFrame;
        decoCache.set(row.id, {
          honors: applyPassDisplay(owned, display),
          frame: verifiedOtherFrame(shown, xp) ?? null,
        });
      }
      if (!cancelled) forceUpdate((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const result: Record<string, OtherDeco> = {};
  for (const id of key ? key.split(",") : []) {
    if (id === authUserId) {
      result[id] = {
        honors: shownPassHonors,
        frame: getActiveFrame(passXP, hasPremiumPass, customFrameColors, passDisplay.frame),
      };
      continue;
    }
    if (hideOthersDeco) continue;
    const d = decoCache.get(id);
    if (d) result[id] = d;
  }
  return result;
}

/** Titel/Abzeichen anderer Spieler, so wie sie sie zeigen wollen. */
export function useOtherPlayersHonors(userIds: (string | null | undefined)[]): Record<string, PassHonors> {
  const deco = useOtherPlayersDeco(userIds);
  const result: Record<string, PassHonors> = {};
  for (const [id, d] of Object.entries(deco)) result[id] = d.honors;
  return result;
}

/** Rahmen anderer Spieler (null = trägt keinen). */
export function useOtherPlayersFrames(userIds: (string | null | undefined)[]): Record<string, OtherFrame | null> {
  const deco = useOtherPlayersDeco(userIds);
  const result: Record<string, OtherFrame | null> = {};
  for (const [id, d] of Object.entries(deco)) result[id] = d.frame;
  return result;
}
