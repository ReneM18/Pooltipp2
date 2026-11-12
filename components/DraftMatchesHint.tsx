"use client";

// Nur für den Admin (Rene, 12.11.2026: "Türkei–Belgien angelegt, aber unter
// Spiele zeigt es nix an"): Neue Spiele sind erst Entwurf und für niemanden
// sichtbar – weder unter Tippen noch mit "Tippen" im Matchcenter. Damit das
// nicht mehr übersehen wird, steht dieser Hinweis auch auf der Tipps-Seite und
// im Matchcenter, mit Knopf zum Veröffentlichen.
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { matchTitle } from "@/lib/teamOrder";
import { upcomingDrafts } from "@/lib/draftMatches";

function whenText(kickoff: string): string {
  return new Date(kickoff).toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DraftMatchesHint({ className = "" }: { className?: string }) {
  const { isAdmin } = useUser();
  const { allMatches, getTeam, orderFor, publishMatches, contentLoaded } = useAppData();
  const { showToast } = useFeedback();
  if (!isAdmin || !contentLoaded) return null;
  const drafts = upcomingDrafts(allMatches, Date.now());
  if (drafts.length === 0) return null;

  const titles = drafts.map((m) => {
    const home = getTeam(m.homeTeamId)?.name ?? "?";
    const away = getTeam(m.awayTeamId)?.name ?? "?";
    return { id: m.id, text: matchTitle(orderFor(m), home, away), when: whenText(m.kickoff) };
  });
  const shown = titles.slice(0, 3);
  const more = titles.length - shown.length;
  const one = drafts.length === 1;

  return (
    <div className={`rounded-card border border-gold/50 bg-gold/10 p-3.5 sm:p-4 ${className}`} role="status">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-ink sm:text-base">
            📝 {drafts.length} {one ? "Spiel ist" : "Spiele sind"} noch Entwurf – niemand sieht {one ? "es" : "sie"}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted">
            {shown.map((t) => (
              <li key={t.id} className="truncate">
                {t.text} <span className="text-muted/80">· {t.when}</span>
              </li>
            ))}
            {more > 0 && <li>und {more} weitere</li>}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin"
            className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Admin
          </Link>
          <button
            type="button"
            onClick={() => {
              if (
                !confirm(
                  `${drafts.length} ${one ? "Spiel" : "Spiele"} jetzt veröffentlichen? Danach sehen alle Spieler ${one ? "es" : "sie"} und können tippen.`
                )
              )
                return;
              publishMatches(drafts.map((m) => m.id));
              showToast(`✓ ${drafts.length} ${one ? "Spiel ist" : "Spiele sind"} jetzt online.`, "success");
            }}
            className="rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            🚀 Veröffentlichen
          </button>
        </div>
      </div>
    </div>
  );
}
