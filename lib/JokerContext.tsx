"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAppRefresh } from "@/lib/appRefresh";
import { supabase } from "@/lib/supabaseClient";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";

// Joker-Vorrat und Joker-Shop (supabase/joker-shop.sql). Kaufen ist erst
// möglich, wenn der Admin den Shop freigibt (Schalter auf der Admin-Seite);
// der Admin selbst kann vorher schon testen. Fehlt das SQL noch, bleibt
// "ready" auf false und die App zeigt nur die Shop-Vorschau.

export type TipJoker = "schutz" | "doppel" | "toleranz";
export type ShopJoker = TipJoker | "pause" | "trend";

export interface JokerStock {
  schutz: number;
  doppel: number;
  toleranz: number;
  trend: number;
  pause: number;
}

export interface TrendResult {
  tipps: number;
  heim: number;
  remis: number;
  gast: number;
}

interface JokerRow extends JokerStock {
  shop_open: boolean;
  trend_matches: string[] | null;
}

const EMPTY: JokerStock = { schutz: 0, doppel: 0, toleranz: 0, trend: 0, pause: 0 };

export const TIP_JOKER_LABEL: Record<TipJoker, string> = {
  schutz: "Schutz-Joker",
  doppel: "Doppel-Joker",
  toleranz: "Toleranz-Joker",
};

// Kurze Wirkung, steht auf der Tipp-Karte unter dem gesetzten Joker.
export const TIP_JOKER_EFFECT: Record<TipJoker, string> = {
  schutz: "Liegst du daneben, zählt der Tipp 0 statt Minus.",
  doppel: "Feste Punkte zählen doppelt: 20 / 14 / 10.",
  toleranz: "Nur 1 Tor daneben zählt 0 statt Minus.",
};

interface JokerContextValue {
  ready: boolean;
  shopOpen: boolean;
  canBuy: boolean;
  stock: JokerStock;
  trendMatches: string[];
  buyJoker: (joker: ShopJoker) => Promise<string | null>;
  setTipJoker: (matchId: string, joker: TipJoker | null) => Promise<string | null>;
  revealTrend: (matchId: string) => Promise<TrendResult | string>;
  setShopOpen: (open: boolean) => Promise<string | null>;
  reloadJokers: () => Promise<void>;
}

const JokerContext = createContext<JokerContextValue | null>(null);

// Fehlertext der Datenbank in einen kurzen Satz für den Hinweis übersetzen.
function errorText(message: string | undefined): string {
  if (!message) return "Hat nicht geklappt – bitte nochmal versuchen.";
  if (message.includes("Nicht genug Sterne")) return "Nicht genug Coins.";
  const known = [
    "Der Joker-Shop ist noch gesperrt.",
    "Kein Joker dieser Art im Vorrat",
    "Kein Trend-Joker im Vorrat",
    "Erst tippen, dann den Joker setzen",
    "Der Toleranz-Joker gilt nur für Ergebnis-Tipps",
    "Tippschluss: Joker können nicht mehr geändert werden",
    "Tippschluss: Ab jetzt siehst du alle Tipps ohnehin",
  ];
  return known.find((k) => message.includes(k)) ?? "Hat nicht geklappt – bitte nochmal versuchen.";
}

export function JokerProvider({ children }: { children: ReactNode }) {
  const { authUserId, isAdmin, refreshStars } = useUser();
  const { reloadMyTips } = useAppData();
  const [ready, setReady] = useState(false);
  const [shopOpen, setShopOpenState] = useState(false);
  const [stock, setStock] = useState<JokerStock>(EMPTY);
  const [trendMatches, setTrendMatches] = useState<string[]>([]);
  const requestRef = useRef(0);

  function apply(row: JokerRow) {
    setStock({ schutz: row.schutz, doppel: row.doppel, toleranz: row.toleranz, trend: row.trend, pause: row.pause });
    setShopOpenState(row.shop_open);
    setTrendMatches(row.trend_matches ?? []);
    setReady(true);
  }

  async function reloadJokers() {
    if (!authUserId) return;
    const requestId = ++requestRef.current;
    const { data, error } = await supabase.rpc("my_jokers");
    if (requestId !== requestRef.current) return;
    if (error || !data) {
      // z. B. supabase/joker-shop.sql noch nicht ausgeführt
      setReady(false);
      return;
    }
    apply(data as JokerRow);
  }

  useEffect(() => {
    setReady(false);
    setStock(EMPTY);
    setTrendMatches([]);
    void reloadJokers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  // Joker-Bestand kann sich auf einem anderen Gerät geändert haben.
  useAppRefresh(() => reloadJokers());

  async function buyJoker(joker: ShopJoker): Promise<string | null> {
    const { data, error } = await supabase.rpc("buy_joker", { p_joker: joker });
    refreshStars();
    if (error || !data) {
      void reloadJokers();
      return errorText(error?.message);
    }
    ++requestRef.current;
    apply((data as { jokers: JokerRow }).jokers);
    return null;
  }

  async function setTipJoker(matchId: string, joker: TipJoker | null): Promise<string | null> {
    const { data, error } = await supabase.rpc("set_tip_joker", { p_match_id: matchId, p_joker: joker });
    await reloadMyTips();
    if (error || !data) {
      void reloadJokers();
      return errorText(error?.message);
    }
    ++requestRef.current;
    apply(data as JokerRow);
    return null;
  }

  async function revealTrend(matchId: string): Promise<TrendResult | string> {
    const { data, error } = await supabase.rpc("use_trend_joker", { p_match_id: matchId });
    void reloadJokers();
    if (error || !data) return errorText(error?.message);
    return data as TrendResult;
  }

  async function setShopOpen(open: boolean): Promise<string | null> {
    const { error } = await supabase.rpc("set_shop_open", { p_open: open });
    await reloadJokers();
    return error ? "Schalter konnte nicht gespeichert werden." : null;
  }

  return (
    <JokerContext.Provider
      value={{
        ready,
        shopOpen,
        canBuy: ready && (shopOpen || isAdmin),
        stock,
        trendMatches,
        buyJoker,
        setTipJoker,
        revealTrend,
        setShopOpen,
        reloadJokers,
      }}
    >
      {children}
    </JokerContext.Provider>
  );
}

export function useJokers(): JokerContextValue {
  const context = useContext(JokerContext);
  if (!context) throw new Error("useJokers muss innerhalb von JokerProvider verwendet werden");
  return context;
}
