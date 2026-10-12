"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/UserContext";

// Online-Status (Rene, 12.10.2026): grüner Punkt in der Freundesliste.
// Wer in der App ist und "Online-Status zeigen" an hat (profile_extras.
// show_online, supabase/online-status.sql), meldet sich im Realtime-Kanal
// "pooltipp_online" an (Presence). Alle eingeloggten Spieler hören mit und
// wissen so, wer gerade da ist. Ausgeschaltet: man meldet sich gar nicht an.

interface OnlineValue {
  /** Ob dieser Spieler gerade online ist (und es zeigt). */
  isOnline: (userId: string | null | undefined) => boolean;
  /** Eigene Einstellung (Standard: an). */
  showOnline: boolean;
  /** false, solange die Einstellung noch lädt; "missing" = SQL fehlt. */
  settingState: "loading" | "ready" | "missing";
  saveShowOnline: (show: boolean) => Promise<string | null>;
}

const OnlineContext = createContext<OnlineValue | null>(null);

export function OnlineProvider({ children }: { children: ReactNode }) {
  const { authUserId } = useUser();
  const [showOnline, setShowOnline] = useState(true);
  const [settingState, setSettingState] = useState<OnlineValue["settingState"]>("loading");
  const [online, setOnline] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackedRef = useRef(false);
  // true, sobald der Presence-Kanal verbunden ist (erst dann kann man sich anmelden).
  const [joined, setJoined] = useState(false);

  // Eigene Einstellung laden + bei Änderung auf einem anderen Gerät übernehmen.
  const loadSetting = useCallback(async () => {
    if (!authUserId) return;
    const { data, error } = await supabase.from("profile_extras").select("show_online").eq("id", authUserId).maybeSingle();
    if (error) {
      setSettingState("missing");
      setShowOnline(true);
      return;
    }
    setShowOnline(data?.show_online !== false);
    setSettingState("ready");
  }, [authUserId]);

  useEffect(() => {
    setSettingState("loading");
    if (!authUserId) return;
    void loadSetting();
    const ch = supabase
      .channel(`show_online_${authUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_extras", filter: `id=eq.${authUserId}` }, () =>
        void loadSetting()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [authUserId, loadSetting]);

  // Presence-Kanal: mithören (alle Eingeloggten), anmelden nur mit Einstellung "an".
  useEffect(() => {
    if (!authUserId) {
      setOnline(new Set());
      return;
    }
    const channel = supabase.channel("pooltipp_online", { config: { presence: { key: authUserId } } });
    channelRef.current = channel;
    trackedRef.current = false;
    setJoined(false);
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Nach einem Neu-Verbinden muss man sich wieder anmelden.
          trackedRef.current = false;
          setJoined(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setJoined(false);
        }
      });
    return () => {
      channelRef.current = null;
      trackedRef.current = false;
      setJoined(false);
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  // An- bzw. abmelden, sobald die Einstellung feststeht oder sich ändert.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !joined || !authUserId || settingState === "loading") return;
    let cancelled = false;
    const apply = async () => {
      if (cancelled) return;
      if (showOnline && !trackedRef.current) {
        trackedRef.current = true;
        await channel.track({ online_at: new Date().toISOString() });
      } else if (!showOnline && trackedRef.current) {
        trackedRef.current = false;
        await channel.untrack();
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [authUserId, showOnline, settingState, joined]);

  async function saveShowOnline(show: boolean): Promise<string | null> {
    if (!authUserId) return "Nicht eingeloggt";
    const { error } = await supabase.from("profile_extras").upsert({ id: authUserId, show_online: show }, { onConflict: "id" });
    if (error) return error.message;
    setShowOnline(show);
    return null;
  }

  const isOnline = (userId: string | null | undefined) => !!userId && userId !== authUserId && online.has(userId);

  return (
    <OnlineContext.Provider value={{ isOnline, showOnline, settingState, saveShowOnline }}>{children}</OnlineContext.Provider>
  );
}

export function useOnline(): OnlineValue {
  const ctx = useContext(OnlineContext);
  if (!ctx) throw new Error("useOnline muss innerhalb von OnlineProvider verwendet werden");
  return ctx;
}
