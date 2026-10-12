"use client";

// Kürbisse & Co. fürs laufende Event (supabase/halloween-event.sql). Der Stand
// kommt aus der Datenbank und per Realtime auf alle Geräte. Die erreichten
// Stufen selbst stehen in claimed_milestones (UserContext passClaims).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { EventData } from "@/lib/seasons";

export interface EventStatus {
  points: number;
  loginToday: boolean;
  tippToday: boolean;
}

type StatusRow = { points?: number; login_today?: boolean; tipp_today?: boolean };

function toStatus(row: StatusRow | null): EventStatus {
  return { points: Number(row?.points) || 0, loginToday: !!row?.login_today, tippToday: !!row?.tipp_today };
}

/** Kürbis fürs Reinschauen – einmal pro Tag (die Datenbank zählt ohnehin nur einen). */
export async function claimEventDay(event: EventData): Promise<EventStatus | null> {
  const { data, error } = await supabase.rpc("claim_event_day", { p_event: event.theme.id });
  if (error) return null;
  return toStatus(data as StatusRow);
}

export function useEventStatus(event: EventData, userId: string | null) {
  const [status, setStatus] = useState<EventStatus | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("my_event_status", { p_event: event.theme.id });
    if (error) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setStatus(toStatus(data as StatusRow));
  }, [event.theme.id, userId]);

  useEffect(() => {
    setStatus(null);
    if (!userId) return;
    void load();
    const channel = supabase
      .channel(`event_progress_${event.theme.id}_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_event_progress", filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.theme.id, userId, load]);

  return { status, missing, reload: load };
}
