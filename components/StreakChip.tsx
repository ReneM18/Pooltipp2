"use client";

import { CoinIcon } from "@/components/CoinIcon";
import { daysDative, daysLabel, StreakState } from "@/lib/streak";

// Tipp-Serie auf der Spieltag-Seite: das Abzeichen neben der Überschrift
// plus eine ruhige Zeile darunter, was heute zählt. Bewusst ohne Druck:
// kein Countdown, keine Warnfarben, ein ausgelassener Tag pro Woche wird
// vom Serien-Schutz überbrückt.

export function StreakBadge({ streak }: { streak: StreakState }) {
  if (streak.count <= 0) return null;
  return (
    <span
      title="Aufeinanderfolgende Tage mit mindestens einem Tipp"
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 font-display text-xs font-bold text-gold"
    >
      🔥 {daysLabel(streak.count)} in Folge
      {streak.status === "today" && <span aria-label="heute getippt">✓</span>}
    </span>
  );
}

export function StreakHint({ streak }: { streak: StreakState }) {
  if (streak.status === "none") return null;
  const milestone = streak.nextMilestone;
  let text: string;
  if (streak.status === "today") {
    text = "Heute bist du dabei.";
  } else if (streak.status === "shield") {
    text = `Gestern ohne Tipp: Dein Serien-Schutz hält die Serie, wenn du heute tippst (dann ${daysLabel(streak.countAfterTip)}).`;
  } else {
    text = `Ein Tipp heute, dann sind es ${daysLabel(streak.countAfterTip)}.`;
  }
  // Meilenstein nur, solange er wirklich bevorsteht (nach dem Tipp heute).
  const showMilestone = milestone && milestone.remaining <= 5;
  return (
    <p className="text-xs text-muted">
      {text}
      {showMilestone && (
        <>
          {" "}
          Bei {daysDative(milestone.days)} in Folge gibt es{" "}
          <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-gold">
            +{milestone.bonusStars} <CoinIcon className="h-3 w-3" />
          </span>
          .
        </>
      )}
    </p>
  );
}
