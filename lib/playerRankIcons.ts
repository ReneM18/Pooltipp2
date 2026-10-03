"use client";

// Rang-Icons ANDERER Spieler (Chat, Spielerseite) aus ihren echten
// Rangpunkten. Ersetzt die früheren ausgedachten Demo-Icons. Die Profile
// werden einmal pro Seitenaufruf geladen und von allen Stellen geteilt.

import { useEffect, useState } from "react";
import { getIconForPoints, RankIconOption } from "@/lib/rankTiers";
import { loadProfiles, ProfileRow, toPointsBySport } from "@/lib/globalLeaderboard";

let profilesPromise: Promise<ProfileRow[]> | null = null;

function loadOnce(): Promise<ProfileRow[]> {
  if (!profilesPromise) {
    profilesPromise = loadProfiles(() => false).then((res) => {
      if ("rows" in res) return res.rows;
      profilesPromise = null; // beim nächsten Mal nochmal versuchen
      return [];
    });
  }
  return profilesPromise;
}

/** Rang-Icon pro Spieler, nachschlagbar über Nutzer-ID und Anzeigenamen. */
export function usePlayerRankIcons(): {
  byId: (id: string | null | undefined) => RankIconOption | null;
  byName: (name: string) => RankIconOption | null;
} {
  const [rows, setRows] = useState<ProfileRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadOnce().then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const iconFor = (row: ProfileRow | undefined) =>
    row ? getIconForPoints(toPointsBySport(row.rang_punkte), `-${row.id}`) : null;

  return {
    byId: (id) => (id ? iconFor(rows.find((r) => r.id === id)) : null),
    byName: (name) => iconFor(rows.find((r) => r.display_name === name)),
  };
}
