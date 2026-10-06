"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAppRefresh } from "@/lib/appRefresh";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/UserContext";
import { useJokers } from "@/lib/JokerContext";
import type { BagTier } from "@/components/BagIcon";

// Trainingstaschen im Prämien-Shop (supabase/trainingstaschen.sql). Kaufen
// und Auslosen passieren in einem Schritt auf dem Server, der Browser zeigt
// danach nur das Öffnen. Gleicher Schalter wie der Joker-Shop. Fehlt das SQL
// noch, bleibt "ready" auf false und der Shop zeigt die Taschen nur an.

export type TaschenArt = "coins" | "gutschein" | "pause" | "tag";

export interface TaschenStueck {
  art: TaschenArt;
  // Coins: Anzahl, Gutschein: Anzahl, Pause-Joker: 1, Tag nachholen: XP
  menge: number;
}

interface TaschenRow {
  gutscheine: number;
  woche_gekauft: boolean;
  tage_saison: number;
}

interface TaschenContextValue {
  ready: boolean;
  // Booster-Gutscheine im Vorrat (der nächste Booster-Tipp kostet nichts)
  gutscheine: number;
  // Diese Woche (Montag bis Sonntag) schon eine Tasche gekauft
  wocheGekauft: boolean;
  // "Tag nachholen" in dieser Saison schon bekommen (höchstens 3)
  tageSaison: number;
  buyTasche: (tasche: BagTier) => Promise<TaschenStueck[] | string>;
  reloadTaschen: () => Promise<void>;
}

const TaschenContext = createContext<TaschenContextValue | null>(null);

function errorText(message: string | undefined): string {
  if (!message) return "Hat nicht geklappt – bitte nochmal versuchen.";
  if (message.includes("Nicht genug Sterne")) return "Nicht genug Coins.";
  const known = ["Der Shop ist noch gesperrt.", "Diese Woche hast du schon eine Tasche gekauft."];
  return known.find((k) => message.includes(k)) ?? "Hat nicht geklappt – bitte nochmal versuchen.";
}

export function TaschenProvider({ children }: { children: ReactNode }) {
  const { authUserId, refreshStars } = useUser();
  const { reloadJokers } = useJokers();
  const [ready, setReady] = useState(false);
  const [row, setRow] = useState<TaschenRow>({ gutscheine: 0, woche_gekauft: false, tage_saison: 0 });
  const requestRef = useRef(0);

  function apply(data: TaschenRow) {
    setRow({ gutscheine: data.gutscheine ?? 0, woche_gekauft: !!data.woche_gekauft, tage_saison: data.tage_saison ?? 0 });
    setReady(true);
  }

  async function reloadTaschen() {
    if (!authUserId) return;
    const requestId = ++requestRef.current;
    const { data, error } = await supabase.rpc("my_taschen");
    if (requestId !== requestRef.current) return;
    if (error || !data) {
      // z. B. supabase/trainingstaschen.sql noch nicht ausgeführt
      setReady(false);
      return;
    }
    apply(data as TaschenRow);
  }

  useEffect(() => {
    setReady(false);
    setRow({ gutscheine: 0, woche_gekauft: false, tage_saison: 0 });
    void reloadTaschen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // Neue Woche oder Kauf auf einem anderen Gerät: beim Zurückkehren neu holen.
  useAppRefresh(() => reloadTaschen());

  // Sofort-Abgleich: Kauf auf einem anderen Gerät, Gutschein beim Tippen
  // eingelöst oder zurückgegeben. Coins und Joker gleich mit nachladen.
  const reloadRef = useRef(reloadTaschen);
  reloadRef.current = reloadTaschen;
  const syncRef = useRef(() => {});
  syncRef.current = () => {
    void reloadRef.current();
    void reloadJokers();
    refreshStars();
  };
  useEffect(() => {
    if (!authUserId) return;
    let timer: number | undefined;
    const changed = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => syncRef.current(), 300);
    };
    const filter = `user_id=eq.${authUserId}`;
    const channel = supabase
      .channel(`my_taschen_live_${authUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "taschen_kaeufe", filter }, changed)
      .on("postgres_changes", { event: "*", schema: "public", table: "booster_gutscheine", filter }, changed)
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  async function buyTasche(tasche: BagTier): Promise<TaschenStueck[] | string> {
    const { data, error } = await supabase.rpc("buy_tasche", { p_tasche: tasche });
    refreshStars();
    void reloadJokers();
    if (error || !data) {
      void reloadTaschen();
      return errorText(error?.message);
    }
    const result = data as { inhalt: TaschenStueck[]; taschen: TaschenRow };
    ++requestRef.current;
    apply(result.taschen);
    return result.inhalt;
  }

  return (
    <TaschenContext.Provider
      value={{
        ready,
        gutscheine: row.gutscheine,
        wocheGekauft: row.woche_gekauft,
        tageSaison: row.tage_saison,
        buyTasche,
        reloadTaschen,
      }}
    >
      {children}
    </TaschenContext.Provider>
  );
}

export function useTaschen(): TaschenContextValue {
  const context = useContext(TaschenContext);
  if (!context) throw new Error("useTaschen muss innerhalb von TaschenProvider verwendet werden");
  return context;
}
