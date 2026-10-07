"use client";

// Rang-Icons ANDERER Spieler (Chat, Spielerseite) aus ihren echten
// Rangpunkten und dem Icon, das sie im Profil gewählt haben. Die Profile
// werden einmal pro Seitenaufruf geladen und von allen Stellen geteilt.
// Für den eingeloggten Spieler selbst gilt immer die Auswahl im Browser,
// damit eine Änderung sofort überall zu sehen ist.

import { useEffect, useState } from "react";
import { getChosenIconForPoints, RankIconOption } from "@/lib/rankTiers";
import { useUser } from "@/lib/UserContext";
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
  const { authUserId, displayName, activeRankIcon } = useUser();

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
    row ? getChosenIconForPoints(toPointsBySport(row.rang_punkte), row.rank_icon_id, `-${row.id}`, row.prestige) : null;

  return {
    byId: (id) => (!id ? null : id === authUserId ? activeRankIcon : iconFor(rows.find((r) => r.id === id))),
    byName: (name) =>
      authUserId && name === displayName ? activeRankIcon : iconFor(rows.find((r) => r.display_name === name)),
  };
}
