"use client";

// Abstimmungen in den News (supabase/abstimmungen.sql). Frage und Antworten
// stehen in der News selbst (NewsItem.poll), die Stimmen in der Datenbank.
// Ergebnisse und die eigene Stimme kommen per Realtime auf alle Geräte.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface NewsPoll {
  question: string;
  options: string[]; // 2–4 Antworten
  endsAt: string | null; // null = läuft ohne Ende
}

export const POLL_MAX_OPTIONS = 4;

export function pollEnded(poll: NewsPoll, now = Date.now()) {
  return !!poll.endsAt && new Date(poll.endsAt).getTime() <= now;
}

// Admin-Eingabe aufräumen: leere Antworten raus; ungültig → null.
export function cleanPoll(poll: NewsPoll | null): NewsPoll | null {
  if (!poll) return null;
  const question = poll.question.trim();
  const options = poll.options.map((o) => o.trim()).filter(Boolean).slice(0, POLL_MAX_OPTIONS);
  if (!question || options.length < 2) return null;
  return { question, options, endsAt: poll.endsAt || null };
}

// newsId null = nichts laden (z. B. im Admin-Formular für eine neue News).
export function useNewsPoll(newsId: string | null, userId: string | null) {
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0]);
  const [total, setTotal] = useState(0);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);

  const loadResults = useCallback(async () => {
    if (!newsId) return;
    const { data, error } = await supabase
      .from("news_poll_results")
      .select("counts, total")
      .eq("news_id", newsId)
      .maybeSingle();
    if (error) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setCounts(((data?.counts as number[] | undefined) ?? [0, 0, 0, 0]).map((n) => Number(n) || 0));
    setTotal(Number(data?.total) || 0);
    setLoaded(true);
  }, [newsId]);

  const loadMine = useCallback(async () => {
    if (!userId || !newsId) {
      setMyVote(null);
      return;
    }
    const { data } = await supabase
      .from("news_poll_votes")
      .select("option_index")
      .eq("news_id", newsId)
      .eq("user_id", userId)
      .maybeSingle();
    setMyVote(typeof data?.option_index === "number" ? data.option_index : null);
  }, [newsId, userId]);

  useEffect(() => {
    if (!newsId) return;
    void loadResults();
    void loadMine();
    const channel = supabase
      .channel(`news_poll_${newsId}_${userId ?? "gast"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "news_poll_results", filter: `news_id=eq.${newsId}` }, () =>
        void loadResults()
      );
    if (userId) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "news_poll_votes", filter: `user_id=eq.${userId}` }, () =>
        void loadMine()
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [newsId, userId, loadResults, loadMine]);

  async function vote(option: number): Promise<string | null> {
    if (!newsId) return "Keine Abstimmung";
    const before = myVote;
    setMyVote(option);
    const { error } = await supabase.rpc("vote_news_poll", { p_news_id: newsId, p_option: option });
    if (error) {
      setMyVote(before);
      return error.message;
    }
    void loadResults();
    return null;
  }

  return { counts, total, myVote, loaded, missing, vote };
}
