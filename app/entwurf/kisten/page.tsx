"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CoinIcon } from "@/components/CoinIcon";
import { Chest, KISTEN, type Tier } from "@/components/ChestIcon";

// ============================================================================
// ENTWURF Kisten (mit Coins öffnen). Nur zum Ansehen mit Beispieldaten,
// speichert nichts, nicht mergen.
// Szenen: ?szene=shop | limit | inhalt | oeffnen | gewinn | trost
// ============================================================================

const KONTO = 340; // gleich wie oben in der Kopfzeile (Beispiel)

// Mögliche Inhalte (bewusst wenige, alles ohne Geldwert)
const INHALT = {
  coins: { icon: "🪙", name: "Coins zurück", text: "Ein Teil vom Preis kommt zurück aufs Konto" },
  booster: { icon: "🚀", name: "Booster-Gutschein", text: "Ein Booster-Tipp ohne Einsatz (spart 20 Coins)" },
  pause: { icon: "⏸️", name: "Pause-Joker", text: "Schützt eine Woche vor der Strafe fürs Nicht-Tippen" },
  tag: { icon: "⏪", name: "Verpassten Tag nachholen", text: "Holt einen verpassten Tagesbonus im Saison-Pass nach (+100 XP)" },
};

const CHANCEN: Record<Tier, [keyof typeof INHALT, string][]> = {
  holz: [
    ["coins", "50 %  (60 bis 100 Coins)"],
    ["booster", "35 %"],
    ["pause", "12 %"],
    ["tag", "3 %"],
  ],
  silber: [
    ["coins", "15 %  (200 Coins)"],
    ["booster", "30 %  (2 Gutscheine)"],
    ["pause", "40 %"],
    ["tag", "15 %"],
  ],
  gold: [
    ["pause", "100 %"],
    ["tag", "100 %"],
  ],
};

function useHerbst() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = () => setOn(document.documentElement.hasAttribute("data-season-design"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true });
    return () => obs.disconnect();
  }, []);
  return on;
}

function Leaves() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {[
        ["8%", "16%", "-20deg", 22],
        ["84%", "10%", "25deg", 20],
        ["14%", "64%", "40deg", 16],
        ["80%", "56%", "-35deg", 18],
        ["50%", "3%", "10deg", 18],
      ].map(([l, t, r, s], i) => (
        <span key={i} className="absolute" style={{ left: l as string, top: t as string, transform: `rotate(${r})`, fontSize: s as number }}>
          {i % 2 ? "🍁" : "🍂"}
        </span>
      ))}
    </span>
  );
}

function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h1>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Draft() {
  return (
    <p className="mb-4 rounded-full border border-dashed border-edge px-3 py-1 text-center text-[11px] text-muted">
      Entwurf mit Beispieldaten
    </p>
  );
}

function Coins({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}>
      <CoinIcon className="h-4 w-4" />
      {n.toLocaleString("de-DE")}
    </span>
  );
}

function ChestCard({ tier, limitReached }: { tier: Tier; limitReached: boolean }) {
  const k = KISTEN[tier];
  const missing = k.price - KONTO;
  const canBuy = missing <= 0 && !limitReached;
  return (
    <div
      className="flex items-center gap-3 rounded-card border bg-surface p-3 sm:flex-col sm:p-5 sm:text-center"
      style={{ borderColor: canBuy ? k.glow : "rgb(var(--c-edge))" }}
    >
      <span className="relative shrink-0" style={{ opacity: canBuy ? 1 : 0.55 }}>
        <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${k.glow}44, transparent 70%)` }} />
        <span className="relative block sm:hidden">
          <Chest tier={tier} size={72} />
        </span>
        <span className="relative hidden sm:block">
          <Chest tier={tier} size={110} />
        </span>
      </span>
      <div className="min-w-0 flex-1 sm:w-full">
        <div className="font-display text-base font-semibold text-ink">{k.name}</div>
        <div className="text-xs text-muted">{k.text}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-center">
          {canBuy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 font-display text-sm font-semibold text-pitch">
              Öffnen · <Coins n={k.price} />
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1 font-display text-sm font-semibold text-muted">
                <Coins n={k.price} />
              </span>
              <span className="text-xs text-muted">
                {limitReached ? "Nächste Woche wieder" : <>Zu wenig Coins · noch {missing.toLocaleString("de-DE")}</>}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Shop({ limitReached = false }: { limitReached?: boolean }) {
  return (
    <>
      <Title title="Kisten" sub="Mit Coins aus Booster-Tipps, Tagesbonus und Serie" />
      <Draft />
      <div className="mb-4 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface px-4 py-3">
        <span className="text-sm text-muted">Dein Kontostand</span>
        <Coins n={KONTO} className="font-display text-lg font-bold text-ink" />
      </div>
      <div
        className={`mb-4 rounded-card border px-4 py-3 text-sm ${
          limitReached ? "border-gold/50 bg-gold/10 text-ink" : "border-edge bg-surface text-muted"
        }`}
      >
        {limitReached ? (
          <>
            <span className="font-semibold">Diese Woche hast du schon eine Kiste geöffnet.</span> Ab Montag geht wieder eine.
          </>
        ) : (
          <>
            <span className="font-semibold text-ink">1 Kiste pro Woche.</span> Diese Woche noch frei.
          </>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["holz", "silber", "gold"] as Tier[]).map((t) => (
          <ChestCard key={t} tier={t} limitReached={limitReached} />
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Was kann drin sein? ⓘ · Coins und Kisten kann man nie mit Geld kaufen.
      </p>
    </>
  );
}

function SceneInhalt() {
  return (
    <>
      <Title title="Was kann drin sein?" sub="Die Chancen stehen offen. Ausgelost wird auf dem Server." />
      <Draft />
      <div className="grid gap-3 lg:grid-cols-3">
        {(["holz", "silber", "gold"] as Tier[]).map((t) => (
          <div key={t} className="rounded-card border border-edge bg-surface p-4">
            <div className="mb-3 flex items-center gap-3">
              <Chest tier={t} size={48} />
              <div className="min-w-0">
                <div className="font-display text-base font-semibold text-ink">{KISTEN[t].name}</div>
                <Coins n={KISTEN[t].price} className="text-xs font-semibold text-muted" />
              </div>
            </div>
            <ul className="space-y-2">
              {CHANCEN[t].map(([key, pct]) => (
                <li key={key} className="flex items-start gap-2.5">
                  <span className="w-6 shrink-0 text-center text-lg leading-6">{INHALT[key].icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-ink">{INHALT[key].name}</span>
                      <span className="shrink-0 whitespace-pre text-xs font-semibold text-gold">{pct.split("  ")[0]}</span>
                    </span>
                    {pct.includes("  ") && <span className="block text-xs text-muted">{pct.split("  ")[1].replace(/[()]/g, "")}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-card border border-edge bg-surface p-4 text-xs leading-relaxed text-muted">
        <p>
          <span className="font-semibold text-ink">Grenzen:</span> 1 Kiste pro Woche · höchstens 2 Pause-Joker im Vorrat · „Tag nachholen“
          höchstens 3 pro Saison. Ist eine Grenze voll, gibt es stattdessen einen Booster-Gutschein.
        </p>
        <p className="mt-2">Kein Stück bringt Rangpunkte. Coins gibt der Tagesbonus nur bis 500, darüber kommen sie nur aus Booster-Gewinnen.</p>
      </div>
    </>
  );
}

function Overlay({ children, border }: { children: React.ReactNode; border?: string }) {
  const herbst = useHerbst();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-card border bg-surface px-5 py-7 text-center"
        style={{ borderColor: border ?? "rgb(var(--c-edge))", boxShadow: border ? `0 0 30px ${border}33 inset` : undefined }}
      >
        {herbst && <Leaves />}
        {children}
      </div>
    </div>
  );
}

function SceneOeffnen() {
  return (
    <>
      <Shop />
      <Overlay>
        <p className="font-display text-xs font-semibold uppercase tracking-wider text-gold">Silber-Kiste</p>
        <p className="mt-1 text-sm text-muted">400 Coins bezahlt</p>
        <div className="my-6 flex justify-center">
          <span className="inline-block" style={{ animation: "chestShake 0.5s ease-in-out infinite", transform: "rotate(-6deg)" }}>
            <Chest tier="silber" size={150} />
          </span>
        </div>
        <p className="font-display text-base font-semibold text-ink">Tippe auf die Kiste</p>
        <p className="mt-1 text-xs text-muted">Pause-Joker 40 % · Tag nachholen 15 % · Booster 30 % · Coins 15 %</p>
      </Overlay>
    </>
  );
}

function Prize({ tier, k, extra }: { tier: Tier; k: keyof typeof INHALT; extra?: string }) {
  const c = KISTEN[tier].glow;
  return (
    <>
      <Shop />
      <Overlay border={c}>
            <div className="-mt-2 flex justify-center">
              <Chest tier={tier} size={90} open />
            </div>
            <div className="my-4 flex justify-center">
              <span className="relative inline-flex items-center justify-center">
                <span aria-hidden className="absolute rounded-full" style={{ inset: -20, background: `radial-gradient(circle, ${c}55, transparent 70%)` }} />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-2xl border text-5xl" style={{ borderColor: c, background: `${c}22` }}>
                  {INHALT[k].icon}
                </span>
              </span>
            </div>
            <p className="font-display text-lg font-semibold text-ink">{extra ?? INHALT[k].name}</p>
            <p className="mx-auto mt-1 max-w-[16rem] text-xs text-muted">{INHALT[k].text}</p>
            <div className="mt-5 rounded-full bg-gold py-2.5 font-display text-sm font-semibold text-pitch">Super!</div>
      </Overlay>
    </>
  );
}

function Scenes() {
  const szene = useSearchParams().get("szene") ?? "shop";
  let content: JSX.Element;
  if (szene === "limit") content = <Shop limitReached />;
  else if (szene === "inhalt") content = <SceneInhalt />;
  else if (szene === "oeffnen") content = <SceneOeffnen />;
  else if (szene === "gewinn") content = <Prize tier="silber" k="pause" />;
  else if (szene === "trost") content = <Prize tier="holz" k="coins" extra="80 Coins zurück" />;
  else content = <Shop />;
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:max-w-4xl">
      <style>{`@keyframes chestShake{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}`}</style>
      {content}
    </main>
  );
}

export default function EntwurfKisten() {
  return (
    <Suspense fallback={null}>
      <Scenes />
    </Suspense>
  );
}
