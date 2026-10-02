"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PassHonors, getPassHonors, splitClaimedMilestones } from "@/lib/seasons";

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
// Titel/Abzeichen ANDERER Spieler (z. B. im Chat oder bei Kommentaren). Kommen
// aus deren Profil (pass_xp + claimed_milestones, für alle lesbar). Einmal
// geladene Werte werden für die ganze Sitzung gemerkt.
// ----------------------------------------------------------------------------
const honorsCache = new Map<string, PassHonors>();
const requested = new Set<string>();

export function useOtherPlayersHonors(userIds: (string | null | undefined)[]): Record<string, PassHonors> {
  const [, forceUpdate] = useState(0);
  const key = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort().join(",");

  useEffect(() => {
    if (!key) return;
    const missing = key.split(",").filter((id) => !requested.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.add(id));
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, pass_xp, claimed_milestones")
      .in("id", missing)
      .then(({ data, error }) => {
        if (error || !data) {
          missing.forEach((id) => requested.delete(id));
          return;
        }
        for (const row of data) {
          honorsCache.set(
            row.id,
            getPassHonors(
              typeof row.pass_xp === "number" ? row.pass_xp : null,
              splitClaimedMilestones(row.claimed_milestones).pass
            )
          );
        }
        if (!cancelled) forceUpdate((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const result: Record<string, PassHonors> = {};
  for (const id of key ? key.split(",") : []) {
    const h = honorsCache.get(id);
    if (h) result[id] = h;
  }
  return result;
}
