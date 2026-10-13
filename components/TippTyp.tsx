"use client";

import { ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import Emoji from "@/components/Emoji";
import { ShareImageDialog } from "@/components/ShareTipCard";
import { drawTypeCard } from "@/lib/shareCard";
import { traitInfo, useTippTyp } from "@/lib/tippTyp";

// Kästchen "Dein Tipp-Typ" (Profil) bzw. "Tipp-Typ" (Spielerseite, kleiner,
// ohne Teilen). Daten aus supabase/tipp-typ.sql.
export default function TippTypCard(props: {
  userId: string | null | undefined;
  playerName: string;
  own: boolean;
  heading?: ReactNode;
}) {
  const result = useTippTyp(props.userId);
  if (result.state === "hidden") return null;
  if (!props.own && result.state === "missing") return null;
  return (
    <div className={props.own ? "" : "mt-4"}>
      {props.heading}
      <TippTypBox result={result} playerName={props.playerName} own={props.own} />
    </div>
  );
}

function TippTypBox({
  result,
  playerName,
  own,
}: {
  result: ReturnType<typeof useTippTyp>;
  playerName: string;
  own: boolean;
}) {
  const [sharing, setSharing] = useState(false);

  if (result.state === "hidden") return null;

  const box = "rounded-card border border-edge bg-surface p-4";

  if (result.state === "loading") {
    return (
      <div className={box} aria-busy="true">
        <div className="flex items-center gap-3">
          <span className="h-12 w-12 animate-pulse rounded-full bg-surface-hover" />
          <span className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
        </div>
      </div>
    );
  }

  if (result.state === "missing") {
    return <p className={`${box} text-sm text-muted`}>Der Tipp-Typ wird gerade freigeschaltet.</p>;
  }

  if (result.state === "notEnough") {
    const left = Math.max(0, result.needed - result.evaluated);
    const percent = Math.min(100, Math.round((result.evaluated / Math.max(1, result.needed)) * 100));
    return (
      <div className={box}>
        <p className="text-sm font-semibold text-ink">
          <Emoji e="🔍" />{" "}
          {own
            ? `Noch ${left} ausgewertete ${left === 1 ? "Tipp" : "Tipps"} bis zu deinem Tipp-Typ`
            : "Noch zu wenige Tipps für einen Tipp-Typ"}
        </p>
        {own && (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-pitch">
              <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {result.evaluated} von {result.needed} · Danach zeigt dir PoolTipp, was für ein Tipper du bist.
            </p>
          </>
        )}
      </div>
    );
  }

  const [mainTrait, ...rest] = result.traits;
  if (!mainTrait) return null;
  const main = traitInfo(mainTrait);
  const extras = rest.slice(0, 3).map(traitInfo);

  return (
    <div className={box}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 leading-none ${own ? "text-5xl" : "text-4xl"}`} aria-hidden>
          <Emoji e={main.emoji} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-display font-bold leading-tight text-gold ${own ? "text-xl" : "text-lg"}`}>{main.name}</p>
          <p className="mt-0.5 text-sm text-muted">{main.text}</p>
        </div>
      </div>

      {extras.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-edge pt-3">
          {extras.map((t) => (
            <li key={t.name} className="flex items-start gap-2 text-sm">
              <span className="shrink-0" aria-hidden>
                <Emoji e={t.emoji} />
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="text-muted"> · {t.text}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">Aus {result.evaluated.toLocaleString("de-DE")} ausgewerteten Tipps</p>
        {own && (
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="whitespace-nowrap rounded-full border border-gold/50 px-3 py-1 text-xs font-bold text-gold transition-colors hover:bg-gold/10"
          >
            📤 Teilen
          </button>
        )}
      </div>

      {sharing &&
        typeof document !== "undefined" &&
        createPortal(
          <ShareImageDialog
            title="Tipp-Typ teilen"
            alt="Dein Tipp-Typ"
            fileName="pooltipp-tipp-typ.png"
            shareText={`Ich bin ${main.emoji} ${main.name} bei PoolTipp! Was für ein Tipper bist du?`}
            draw={() =>
              drawTypeCard({
                playerName,
                main,
                traits: extras.map((t) => ({ emoji: t.emoji, name: t.name })),
                evaluated: result.evaluated,
              })
            }
            onClose={() => setSharing(false)}
          />,
          document.body
        )}
    </div>
  );
}
