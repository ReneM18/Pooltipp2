"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { CoinIcon } from "@/components/CoinIcon";
import { Bag, BagTier, TASCHEN, TASCHEN_REIHE, useHerbstDesign } from "@/components/BagIcon";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { useJokers } from "@/lib/JokerContext";
import { TaschenArt, TaschenStueck, useTaschen } from "@/lib/TaschenContext";

// Abschnitt "Trainingstaschen" im Prämien-Shop (supabase/trainingstaschen.sql).
// Gleicher Schalter wie die Joker ("Kaufen freigeben" im Admin-Bereich).
// 1 Tasche pro Woche. Gekauft und ausgelost wird auf dem Server, danach
// zieht der Spieler hier den Reißverschluss auf und sieht, was drin war.

const INHALT: Record<TaschenArt, { icon: string; name: string; text: string }> = {
  coins: { icon: "🪙", name: "Coins zurück", text: "Ein Teil vom Preis kommt zurück aufs Konto." },
  gutschein: { icon: "🎟️", name: "Booster-Gutschein", text: "Dein nächster Booster-Tipp kostet keine 20\u00a0Coins." },
  pause: { icon: "⏸️", name: "Pause-Joker", text: "Schützt dich eine Woche lang vor der Strafe fürs Nicht-Tippen." },
  tag: { icon: "⏪", name: "Verpassten Tag nachholen", text: "+100 XP im Saison-Pass, wie ein Tagesbonus." },
};

// Gleiche Chancen wie buy_tasche in supabase/trainingstaschen.sql.
const CHANCEN: Record<BagTier, { art: TaschenArt; pct: string; detail?: string }[]> = {
  training: [
    { art: "coins", pct: "50 %", detail: "60 bis 100 Coins" },
    { art: "gutschein", pct: "35 %" },
    { art: "pause", pct: "12 %" },
    { art: "tag", pct: "3 %" },
  ],
  matchtag: [
    { art: "pause", pct: "40 %" },
    { art: "gutschein", pct: "30 %", detail: "2 Gutscheine" },
    { art: "tag", pct: "15 %" },
    { art: "coins", pct: "15 %", detail: "200 Coins" },
  ],
  profi: [
    { art: "pause", pct: "garantiert" },
    { art: "tag", pct: "garantiert" },
  ],
};

export function TaschenSection() {
  const { freeStars, isAdmin } = useUser();
  const { canBuy, shopOpen, stock } = useJokers();
  const { ready, gutscheine, wocheGekauft, tageSaison, buyTasche } = useTaschen();
  const { showToast } = useFeedback();
  const [confirm, setConfirm] = useState<BagTier | null>(null);
  const [buying, setBuying] = useState<BagTier | null>(null);
  const buyingRef = useRef(false);
  const [opening, setOpening] = useState<{ tier: BagTier; inhalt: TaschenStueck[] } | null>(null);
  const [showChances, setShowChances] = useState(false);

  const buyable = canBuy && ready;
  // Solange der Shop für alle gesperrt ist, darf der Admin öfter testen.
  const limitReached = wocheGekauft && !(isAdmin && !shopOpen);

  async function handleBuy(tier: BagTier) {
    if (buyingRef.current) return;
    buyingRef.current = true;
    setBuying(tier);
    const result = await buyTasche(tier);
    if (typeof result === "string") {
      showToast(`✗ ${result}`, "info");
    } else {
      setOpening({ tier, inhalt: result });
    }
    setConfirm(null);
    setBuying(null);
    buyingRef.current = false;
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-base font-semibold text-ink">Trainingstaschen</h2>
        <span className="text-xs text-muted">
          1 Tasche pro Woche{ready && <> · {wocheGekauft ? "diese Woche schon gekauft" : "diese Woche noch frei"}</>} ·{" "}
          <button
            onClick={() => setShowChances(true)}
            className="whitespace-nowrap font-semibold text-gold underline-offset-2 hover:underline"
          >
            Was kann drin sein?
          </button>
        </span>
      </div>

      {gutscheine > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-card border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-ink">
          <span aria-hidden className="text-lg leading-none">🎟️</span>
          <span>
            <span className="font-semibold">
              {gutscheine === 1 ? "1 Booster-Gutschein" : `${gutscheine} Booster-Gutscheine`}
            </span>{" "}
            im Vorrat: Dein nächster Booster-Tipp kostet nichts.
          </span>
        </div>
      )}

      {buyable && limitReached && (
        <div className="mb-3 rounded-card border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Diese Woche hast du schon eine Tasche gekauft.</span> Ab Montag geht wieder eine.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TASCHEN_REIHE.map((tier) => {
          const k = TASCHEN[tier];
          const afford = freeStars >= k.price;
          const confirming = confirm === tier;
          const isBuying = buying === tier;
          const label = !buyable
            ? "Bald verfügbar"
            : limitReached
              ? "Ab Montag"
              : isBuying
                ? "Wird gekauft…"
                : !afford
                  ? "Zu wenig Coins"
                  : confirming
                    ? "Jetzt kaufen"
                    : "Kaufen";
          return (
            <div key={tier} className="flex flex-col justify-between rounded-card border border-edge bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="shrink-0">
                  <Bag tier={tier} size={76} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold text-ink">{k.name}</h3>
                  <p className="mt-1 text-sm text-muted">{k.text}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-display font-semibold text-gold">
                  <CoinIcon className="h-5 w-5" />
                  {k.price.toLocaleString("de-DE")}
                </span>
                <div className="flex items-center gap-2">
                  {buyable && !limitReached && !afford && (
                    <span className="text-xs text-muted">noch {(k.price - freeStars).toLocaleString("de-DE")}</span>
                  )}
                  {confirming && !isBuying && (
                    <button
                      onClick={() => setConfirm(null)}
                      className="text-sm font-semibold text-muted transition-colors hover:text-ink"
                    >
                      Abbrechen
                    </button>
                  )}
                  <button
                    onClick={() => (confirming ? handleBuy(tier) : setConfirm(tier))}
                    disabled={!buyable || limitReached || !afford || buying !== null}
                    className="rounded-full bg-action px-4 py-1.5 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
                  >
                    {label}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        Ausgelost wird auf dem Server, die Chancen stehen offen. Coins und Taschen kann man nie mit Geld kaufen.
      </p>

      {showChances && (
        <ChancesDialog
          onClose={() => setShowChances(false)}
          pause={stock.pause}
          tage={tageSaison}
          ready={ready}
        />
      )}
      {opening && <OpenDialog tier={opening.tier} inhalt={opening.inhalt} onClose={() => setOpening(null)} />}
    </section>
  );
}

function Overlay({
  children,
  glow,
  onClose,
  leaves = true,
}: {
  children: ReactNode;
  glow?: string;
  onClose?: () => void;
  leaves?: boolean;
}) {
  const herbst = useHerbstDesign();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Seite dahinter nicht mitscrollen.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pitch/85 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-card border bg-surface px-5 py-7 text-center"
        style={{
          borderColor: glow ?? "rgb(var(--c-edge))",
          boxShadow: glow ? `0 0 30px ${glow}33 inset` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {herbst && leaves && <Leaves />}
        <div className="relative">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function Leaves() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {(
        [
          ["6%", "4%", "-20deg", 20],
          ["86%", "3%", "25deg", 18],
          ["4%", "58%", "40deg", 14],
          ["88%", "52%", "-35deg", 16],
        ] as const
      ).map(([l, t, r, s], i) => (
        <span key={i} className="absolute opacity-70" style={{ left: l, top: t, transform: `rotate(${r})`, fontSize: s }}>
          {i % 2 ? "🍁" : "🍂"}
        </span>
      ))}
    </span>
  );
}

function itemTitle(s: TaschenStueck): string {
  if (s.art === "coins") return `${s.menge} Coins zurück`;
  if (s.art === "gutschein") return s.menge > 1 ? `${s.menge} Booster-Gutscheine` : "Booster-Gutschein";
  return INHALT[s.art].name;
}

function itemText(s: TaschenStueck): string {
  if (s.art === "coins") return "Sind schon auf deinem Konto.";
  if (s.art === "gutschein")
    return s.menge > 1 ? "Deine nächsten 2 Booster-Tipps kosten keine 20\u00a0Coins." : INHALT.gutschein.text;
  if (s.art === "pause") return "Liegt in deinem Vorrat und wirkt von allein, wenn du eine Woche nicht tippst.";
  return INHALT.tag.text;
}

function ItemIcon({ art, glow, size }: { art: TaschenArt; glow: string; size: "lg" | "md" }) {
  const box = size === "lg" ? "h-20 w-20 text-5xl" : "h-16 w-16 text-4xl";
  return (
    <span className="relative inline-flex items-center justify-center">
      <span aria-hidden className="absolute rounded-full" style={{ inset: -18, background: `radial-gradient(circle, ${glow}55, transparent 70%)` }} />
      <span
        className={`relative flex items-center justify-center rounded-2xl border ${box}`}
        style={{ borderColor: glow, background: `${glow}22` }}
      >
        {art === "coins" ? <CoinIcon className={size === "lg" ? "h-12 w-12" : "h-10 w-10"} /> : INHALT[art].icon}
      </span>
    </span>
  );
}

// Nach dem Kauf: Tasche wackelt, antippen zieht den Reißverschluss auf.
// Gekauft und ausgelost ist schon (Inhalt liegt bereits im Vorrat), das
// Öffnen ist nur die Anzeige.
function OpenDialog({ tier, inhalt, onClose }: { tier: BagTier; inhalt: TaschenStueck[]; onClose: () => void }) {
  const k = TASCHEN[tier];
  const [open, setOpen] = useState(false);

  return (
    <Overlay glow={open ? k.glow : undefined}>
      <style>{`
        @keyframes taschenWackeln{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
        @keyframes taschenPop{0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.08)}100%{transform:scale(1)}}
      `}</style>
      {!open ? (
        <button onClick={() => setOpen(true)} className="block w-full" aria-label="Reißverschluss aufziehen">
          <p className="font-display text-xs font-semibold uppercase tracking-wider text-gold">{k.name}</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted">
            <CoinIcon className="h-4 w-4" />
            {k.price.toLocaleString("de-DE")} bezahlt
          </p>
          <span className="my-6 flex justify-center">
            <span className="inline-block" style={{ animation: "taschenWackeln 0.5s ease-in-out infinite" }}>
              <Bag tier={tier} size={190} />
            </span>
          </span>
          <span className="block font-display text-base font-semibold text-ink">Zieh den Reißverschluss auf</span>
          <span className="mt-1 block text-xs text-muted">Tippe auf die Tasche</span>
        </button>
      ) : (
        <div>
          <div className="-mt-2 flex justify-center">
            <Bag tier={tier} size={130} open />
          </div>
          <div
            className={`my-4 flex justify-center ${inhalt.length > 1 ? "gap-6" : ""}`}
            style={{ animation: "taschenPop 0.45s ease-out both" }}
          >
            {inhalt.map((s, i) => (
              <ItemIcon key={i} art={s.art} glow={k.glow} size={inhalt.length > 1 ? "md" : "lg"} />
            ))}
          </div>
          <div className="space-y-3" style={{ animation: "taschenPop 0.45s ease-out 0.1s both" }}>
            {inhalt.map((s, i) => (
              <div key={i}>
                <p className="font-display text-lg font-semibold text-ink">{itemTitle(s)}</p>
                <p className="mx-auto mt-0.5 max-w-[17rem] text-xs text-muted">{itemText(s)}</p>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-full bg-gold py-2.5 font-display text-sm font-semibold text-pitch transition-all hover:brightness-110"
          >
            Super!
          </button>
        </div>
      )}
    </Overlay>
  );
}

function ChancesDialog({ onClose, pause, tage, ready }: { onClose: () => void; pause: number; tage: number; ready: boolean }) {
  return (
    <Overlay onClose={onClose} leaves={false}>
      <div className="text-left">
        <h2 className="font-display text-lg font-bold text-ink">Was kann drin sein?</h2>
        <p className="mt-0.5 text-xs text-muted">Pro Tasche wird auf dem Server ausgelost, das sind die Chancen.</p>
        <div className="mt-4 space-y-3">
          {TASCHEN_REIHE.map((tier) => (
            <div key={tier} className="rounded-card border border-edge bg-pitch/40 p-3">
              <div className="mb-2 flex items-center gap-3">
                <Bag tier={tier} size={52} />
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-ink">{TASCHEN[tier].name}</div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                    <CoinIcon className="h-3.5 w-3.5" />
                    {TASCHEN[tier].price.toLocaleString("de-DE")}
                  </span>
                </div>
              </div>
              <ul className="space-y-1.5">
                {CHANCEN[tier].map((c) => (
                  <li key={c.art} className="flex items-start gap-2">
                    <span aria-hidden className="w-5 shrink-0 text-center text-base leading-5">
                      {INHALT[c.art].icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-ink">{INHALT[c.art].name}</span>
                        <span className="shrink-0 text-xs font-semibold text-gold">{c.pct}</span>
                      </span>
                      {c.detail && <span className="block text-xs text-muted">{c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted">
          <p>
            <span className="font-semibold text-ink">Grenzen:</span> 1 Tasche pro Woche, höchstens 2 Pause-Joker im
            Vorrat, „Tag nachholen“ höchstens 3 pro Saison. Ist eine Grenze voll, gibt es stattdessen einen
            Booster-Gutschein.
          </p>
          {ready && (
            <p>
              Bei dir gerade: {pause} von 2 Pause-Jokern im Vorrat, {tage} von 3 Tagen nachgeholt.
            </p>
          )}
          <p>Ein Booster-Tipp mit Gutschein bringt den Gewinn wie immer, daneben kostet er nichts.</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-edge py-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-edge/40"
        >
          Schließen
        </button>
      </div>
    </Overlay>
  );
}
