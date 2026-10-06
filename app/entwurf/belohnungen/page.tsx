"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CoinIcon } from "@/components/CoinIcon";

// ============================================================================
// ENTWURF Belohnungssystem (Wundertüte, Erfolge, Vitrine, Sticker-Orte).
// Nur zum Ansehen mit Beispieldaten, speichert nichts, nicht mergen.
// Szenen: ?szene=start | oeffnen | gewinn | stufen | erfolge | vitrine | tueten | sticker
// ============================================================================

type Stufe = "gewoehnlich" | "selten" | "episch" | "legendaer";
const STUFE: Record<Stufe, { name: string; color: string }> = {
  gewoehnlich: { name: "Gewöhnlich", color: "#A3ADB8" },
  selten: { name: "Selten", color: "#5AA9F5" },
  episch: { name: "Episch", color: "#B694F6" },
  legendaer: { name: "Legendär", color: "#F5C542" },
};

// Herbst-Design an? (wird vom Saison-Design an <html> gesetzt)
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

// Tüten-Sticker (eigener, zeitloser Vorrat, NIE Saison-Sticker)
type Sticker = { emoji: string; accent?: string; label: string };
const TORJUBEL: Sticker[] = [
  { emoji: "🥳", label: "Party" },
  { emoji: "😱", label: "Schock" },
  { emoji: "🎯", label: "Volltreffer" },
  { emoji: "🔥", label: "Heiß" },
  { emoji: "🐐", label: "GOAT" },
  { emoji: "🤯", label: "Wahnsinn" },
  { emoji: "🙏", label: "Bitte, bitte" },
  { emoji: "🧤", label: "Glanzparade" },
];
const HERBST: Sticker[] = [
  { emoji: "🍂", label: "Herbstblatt" },
  { emoji: "🎃", label: "Kürbis" },
  { emoji: "🍄", label: "Pilz" },
  { emoji: "🌰", label: "Kastanie" },
  { emoji: "☔", label: "Regenspiel" },
  { emoji: "🍵", label: "Tasse Tee" },
  { emoji: "⚽", accent: "🍂", label: "Fußball im Laub" },
  { emoji: "🏆", accent: "🍁", label: "Pokal" },
  { emoji: "🙌", accent: "🧣", label: "Torjubel mit Schal" },
  { emoji: "👍", accent: "🧤", label: "Daumen hoch" },
  { emoji: "😬", accent: "🍃", label: "Gänsehaut" },
  { emoji: "🌪️", label: "Sturm" },
];

function StickerTile({
  s,
  size = 52,
  tone = "#4FB3A9",
  locked = false,
}: {
  s: Sticker;
  size?: number;
  tone?: string;
  locked?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={s.label}
      className="relative inline-flex shrink-0 items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: locked ? "rgba(255,255,255,0.04)" : `radial-gradient(circle at 30% 25%, ${tone}66, ${tone}22 70%)`,
        border: `1px ${locked ? "dashed" : "solid"} ${locked ? "rgba(255,255,255,0.15)" : tone + "88"}`,
        fontSize: size * 0.52,
        lineHeight: 1,
      }}
    >
      {locked ? <span style={{ fontSize: size * 0.34, opacity: 0.5 }}>?</span> : s.emoji}
      {!locked && s.accent && (
        <span className="absolute" style={{ right: size * 0.04, bottom: size * 0.02, fontSize: size * 0.3 }}>
          {s.accent}
        </span>
      )}
    </span>
  );
}

// Die Tüte als Bild: Papiertüte mit gefaltetem Rand und Fragezeichen.
function Bag({ size = 120, open = false, color = "#F5C542" }: { size?: number; open?: boolean; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <linearGradient id="bagBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E7B866" />
          <stop offset="1" stopColor="#B9843A" />
        </linearGradient>
      </defs>
      {open && (
        <>
          <circle cx="60" cy="28" r="26" fill={color} opacity="0.25" />
          <circle cx="60" cy="28" r="15" fill={color} opacity="0.35" />
        </>
      )}
      <path d="M24 44 L96 44 L102 108 Q102 112 98 112 L22 112 Q18 112 18 108 Z" fill="url(#bagBody)" />
      {open ? (
        <path d="M24 44 L34 34 L42 44 L52 32 L60 44 L70 33 L78 44 L88 34 L96 44 Z" fill="#E7B866" />
      ) : (
        <path d="M22 36 L98 36 L96 46 L24 46 Z" fill="#D29E50" />
      )}
      <path d="M30 56 Q60 62 90 56" stroke="#9A6A2A" strokeWidth="2" fill="none" opacity="0.5" />
      <circle cx="60" cy="80" r="17" fill={color} />
      <text x="60" y="88" textAnchor="middle" fontSize="24" fontWeight="800" fill="#2A1C08" fontFamily="sans-serif">
        ?
      </text>
    </svg>
  );
}

function Leaves() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {[
        ["8%", "18%", "-20deg", 22],
        ["82%", "10%", "25deg", 20],
        ["18%", "62%", "40deg", 16],
        ["78%", "58%", "-35deg", 18],
        ["50%", "2%", "10deg", 18],
      ].map(([l, t, r, s], i) => (
        <span key={i} className="absolute" style={{ left: l as string, top: t as string, transform: `rotate(${r})`, fontSize: s as number }}>
          {i % 2 ? "🍁" : "🍂"}
        </span>
      ))}
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-card border border-edge bg-surface p-4 sm:p-5 ${className}`}>{children}</div>;
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

// ---------------------------------------------------------------------------
// 1) Startseite: Hinweis auf die Tüte
// ---------------------------------------------------------------------------
function BagHint() {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-card border border-gold/50 bg-gold/10 p-3 sm:p-4">
      <span className="shrink-0">
        <Bag size={48} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-semibold text-ink">Du hast eine Wundertüte!</span>
        <span className="block text-xs text-muted">
          Für deinen exakten Tipp <span className="whitespace-nowrap">Bayern – Dortmund 2:1</span>
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap rounded-full bg-gold px-3 py-1.5 font-display text-sm font-semibold text-pitch">
        Öffnen
      </span>
    </div>
  );
}

function MockMatch({ home, away, time, sport = "⚽" }: { home: string; away: string; time: string; sport?: string }) {
  return (
    <div className="match-card-rand mb-3 rounded-card border border-edge bg-surface p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>
          {sport} Bundesliga · 7. Spieltag
        </span>
        <span>{time}</span>
      </div>
      <div className="flex items-center justify-between gap-3 font-display text-sm font-semibold text-ink">
        <span className="min-w-0 flex-1 break-words">{home}</span>
        <span className="flex shrink-0 gap-1.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-pitch text-muted">–</span>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-pitch text-muted">–</span>
        </span>
        <span className="min-w-0 flex-1 text-right">{away}</span>
      </div>
    </div>
  );
}

function SceneStart() {
  return (
    <>
      <Title title="Spieltag" sub="Woche 41 · noch 4 Spiele offen" />
      <BagHint />
      <p className="mb-3 text-xs text-muted">Diese Woche: 1 von 3 Zufalls-Tüten bekommen</p>
      <MockMatch home="SK Rapid Wien" away="VfB Stuttgart" time="Sa 15:30" />
      <MockMatch home="SC Freiburg" away="Borussia Dortmund" time="So 17:30" />
    </>
  );
}

// ---------------------------------------------------------------------------
// 2) Öffnen: Tüte wackelt
// ---------------------------------------------------------------------------
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-edge bg-surface px-5 py-7 text-center">
        {children}
      </div>
    </div>
  );
}

function SceneOeffnen() {
  const herbst = useHerbst();
  return (
    <>
      <SceneStart />
      <Overlay>
        {herbst && <Leaves />}
        <p className="font-display text-xs font-semibold uppercase tracking-wider text-gold">Wundertüte</p>
        <p className="mt-1 text-sm text-muted">Für deinen exakten Tipp Bayern – Dortmund</p>
        <div className="my-6 flex justify-center">
          <span className="inline-block" style={{ animation: "bagWiggle 0.6s ease-in-out infinite", transform: "rotate(-8deg)" }}>
            <Bag size={140} />
          </span>
        </div>
        <p className="font-display text-base font-semibold text-ink">Tippe auf die Tüte</p>
        <p className="mt-1 text-xs text-muted">Was kann drin sein? ⓘ</p>
      </Overlay>
    </>
  );
}

// ---------------------------------------------------------------------------
// 3) Gewinn je Stufe
// ---------------------------------------------------------------------------
type Prize = { stufe: Stufe; big: React.ReactNode; name: string; text: string };
const PRIZES: Prize[] = [
  {
    stufe: "gewoehnlich",
    big: (
      <span className="inline-flex items-center gap-2 font-display text-4xl font-bold text-ink">
        +8 <CoinIcon className="h-9 w-9" />
      </span>
    ),
    name: "8 Coins",
    text: "Sofort auf deinem Konto",
  },
  {
    stufe: "selten",
    big: <StickerTile s={TORJUBEL[4]} size={84} tone="#5AA9F5" />,
    name: "Sticker „GOAT“",
    text: "Set „Torjubel“ · 5 von 8",
  },
  {
    stufe: "episch",
    big: (
      <span
        className="inline-flex h-[84px] w-[84px] items-center justify-center rounded-full font-display text-3xl font-bold text-ink"
        style={{ boxShadow: "0 0 0 5px #B694F6, 0 0 22px #B694F6aa", background: "#1E2A26" }}
      >
        R
      </span>
    ),
    name: "Rahmen-Farbe „Polarlicht“",
    text: "Um dein Profilbild",
  },
  {
    stufe: "legendaer",
    big: (
      <span className="inline-flex items-center gap-2 rounded-full border-2 border-gold bg-gold/15 px-4 py-2 font-display text-lg font-bold text-gold animate-elite-glow-shape">
        🍀 Glückspilz
      </span>
    ),
    name: "Abzeichen „Glückspilz“",
    text: "Haben nur 1 % aller Spieler",
  },
];

function PrizeReveal({ p, compact = false, withBag = false }: { p: Prize; compact?: boolean; withBag?: boolean }) {
  const herbst = useHerbst();
  const c = STUFE[p.stufe].color;
  return (
    <div
      className={`relative overflow-hidden rounded-card border bg-surface text-center ${compact ? "px-3 py-5" : "px-5 py-7"}`}
      style={{ borderColor: c, boxShadow: `0 0 28px ${c}33 inset` }}
    >
      {herbst && <Leaves />}
      {withBag && (
        <div className="-mt-2 mb-2 flex justify-center">
          <Bag size={72} open color={c} />
        </div>
      )}
      <span
        className="inline-block rounded-full px-3 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider"
        style={{ background: `${c}26`, color: c }}
      >
        {STUFE[p.stufe].name}
      </span>
      <div className={`flex items-center justify-center ${compact ? "my-4 min-h-[90px]" : "my-6 min-h-[110px]"}`}>
        <span className="relative inline-flex items-center justify-center">
          <span aria-hidden className="absolute rounded-full" style={{ inset: -18, background: `radial-gradient(circle, ${c}40, transparent 70%)` }} />
          <span className="relative">{p.big}</span>
        </span>
      </div>
      <p className="font-display text-base font-semibold leading-snug text-ink">{p.name}</p>
      <p className="mt-0.5 text-xs text-muted">{p.text}</p>
    </div>
  );
}

function SceneGewinn() {
  return (
    <>
      <SceneStart />
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4">
        <div className="w-full max-w-sm">
          <PrizeReveal p={PRIZES[3]} withBag />
          <div className="mt-3 rounded-full bg-gold py-2.5 text-center font-display text-sm font-semibold text-pitch">In die Vitrine</div>
        </div>
      </div>
    </>
  );
}

function SceneStufen() {
  return (
    <>
      <Title title="Was kann drin sein?" sub="Die Chancen stehen offen. Tüten kann man nie kaufen." />
      <Draft />
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-4">
        {PRIZES.map((p) => (
          <PrizeReveal key={p.stufe} p={p} compact />
        ))}
      </div>
      <Card className="mt-4">
        <ul className="space-y-1.5 text-sm">
          {(
            [
              ["gewoehnlich", "60 %", "5 bis 10 Coins oder ein Sticker"],
              ["selten", "30 %", "15 Coins, Sticker oder Pause-Joker"],
              ["episch", "9 %", "Rahmen-Farbe oder Trikot-Muster"],
              ["legendaer", "1 %", "seltenes Abzeichen"],
            ] as [Stufe, string, string][]
          ).map(([s, pct, txt]) => (
            <li key={s} className="flex items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STUFE[s].color }} />
              <span className="min-w-0">
                <span className="font-display font-semibold text-ink">{STUFE[s].name}</span>{" "}
                <span className="text-muted">· {pct}</span>
                <span className="block text-xs text-muted">{txt}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Höchstens 3 Zufalls-Tüten pro Woche. Tüten aus Erfolgen und Wochen-Aufträgen kommen dazu.</p>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// 4) Erfolge im Profil
// ---------------------------------------------------------------------------
const STEP_COLORS = ["#C98A4B", "#C0C7CF", "#F5C542", "#8FE3F5"]; // Bronze, Silber, Gold, Diamant
const ERFOLGE = [
  { icon: "🎯", name: "Exakt-Profi", what: "Exakte Ergebnis-Tipps", have: 7, steps: [1, 10, 50, 100] },
  { icon: "🦊", name: "Außenseiter-Jäger", what: "Richtig gegen die Mehrheit", have: 3, steps: [1, 5, 20, 50] },
  { icon: "🔥", name: "Treffer-Serie", what: "Richtige Tipps am Stück", have: 5, steps: [3, 5, 10, 15] },
  { icon: "🌍", name: "Allrounder", what: "Sportarten mit Treffer", have: 2, steps: [2, 3, 4, 5] },
  { icon: "👑", name: "Wochensieger", what: "Wochen auf Platz 1", have: 0, steps: [1, 3, 10, 25] },
  { icon: "🤝", name: "Rundenheld", what: "Gemeinsame Ziele geschafft", have: 0, steps: [1, 5, 15, 30] },
];

function ErfolgRow({ e }: { e: (typeof ERFOLGE)[number] }) {
  const reached = e.steps.filter((s) => e.have >= s).length;
  const next = e.steps[reached];
  const prev = reached > 0 ? e.steps[reached - 1] : 0;
  const pct = next ? Math.max(4, Math.round((e.have / next) * 100)) : 100;
  void prev;
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{
          background: reached ? `${STEP_COLORS[reached - 1]}22` : "rgba(255,255,255,0.04)",
          border: `1px solid ${reached ? STEP_COLORS[reached - 1] : "rgba(255,255,255,0.12)"}`,
          filter: reached ? undefined : "grayscale(1)",
          opacity: reached ? 1 : 0.6,
        }}
      >
        {e.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-sm font-semibold text-ink">{e.name}</span>
          <span className="shrink-0 text-xs font-semibold text-ink">
            {next ? `${e.have} von ${next}` : "Fertig"}
          </span>
        </div>
        <div className="text-xs text-muted">{e.what}</div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-edge">
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex gap-1">
          {e.steps.map((s, i) => (
            <span
              key={s}
              className="rounded-full px-1.5 py-px text-[10px] font-semibold"
              style={
                i < reached
                  ? { background: `${STEP_COLORS[i]}2a`, color: STEP_COLORS[i] }
                  : { background: "rgba(255,255,255,0.05)", color: "rgb(var(--c-muted))" }
              }
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SceneErfolge() {
  return (
    <>
      <Title title="Erfolge" sub="Jede neue Stufe gibt eine Wundertüte" />
      <Draft />
      <Card className="py-1 sm:py-2">
        <div className="divide-y divide-edge">
          {ERFOLGE.map((e) => (
            <ErfolgRow key={e.name} e={e} />
          ))}
        </div>
      </Card>
      <p className="mt-3 text-xs text-muted">Stufen: Bronze, Silber, Gold, Diamant. Erfolge geben keine Rangpunkte.</p>
    </>
  );
}

// ---------------------------------------------------------------------------
// 5) Vitrine
// ---------------------------------------------------------------------------
function Pinned() {
  const items: { label: string; node: React.ReactNode; src: string }[] = [
    {
      label: "Glückspilz",
      src: "Tüte · legendär",
      node: <span className="font-display text-3xl">🍀</span>,
    },
    { label: "Herbstmeister 2026", src: "Saison-Pass", node: <span className="text-3xl">🏆</span> },
    { label: "Exakt-Profi Silber", src: "Erfolg", node: <span className="text-3xl">🎯</span> },
  ];
  return (
    <div className="mb-4">
      <p className="mb-2 font-display text-sm font-semibold text-ink">Meine 3 Lieblingsstücke</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i, n) => (
          <div
            key={i.label}
            className="flex flex-col items-center rounded-card border bg-surface px-1.5 py-3 text-center"
            style={{ borderColor: n === 0 ? STUFE.legendaer.color : "rgb(var(--c-edge))" }}
          >
            {i.node}
            <span className="mt-1.5 font-display text-xs font-semibold leading-tight text-ink">{i.label}</span>
            <span className="mt-0.5 text-[10px] leading-tight text-muted">{i.src}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const FAECHER = ["Pass", "Events", "Erfolge", "Tüten"] as const;

function Tabs({ active }: { active: (typeof FAECHER)[number] }) {
  const counts: Record<string, string> = { Pass: "14", Events: "0", Erfolge: "5", Tüten: "9" };
  return (
    <div className="mb-4 grid grid-cols-4 gap-1.5">
      {FAECHER.map((f) => (
        <span
          key={f}
          className={`flex flex-col items-center rounded-xl border px-1 py-1.5 text-center font-display text-xs font-semibold sm:flex-row sm:justify-center sm:gap-1.5 sm:text-sm ${
            f === active ? "border-gold bg-gold/15 text-gold" : "border-edge bg-surface text-muted"
          }`}
        >
          {f}
          <span className="text-[10px] font-normal opacity-80 sm:text-xs">{counts[f]}</span>
        </span>
      ))}
    </div>
  );
}

function SetBox({
  title,
  sub,
  stickers,
  have,
  tone,
  reward,
}: {
  title: string;
  sub: string;
  stickers: Sticker[];
  have: number;
  tone: string;
  reward: string;
}) {
  return (
    <Card className="mb-3">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-display text-sm font-semibold text-ink">{title}</span>
        <span className="shrink-0 text-xs font-semibold text-gold">
          {have} von {stickers.length}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted">{sub}</p>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-edge">
        <div className="h-full rounded-full bg-gold" style={{ width: `${(have / stickers.length) * 100}%` }} />
      </div>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-12">
        {stickers.map((s, i) => (
          <span key={s.label} className="flex justify-center">
            <StickerTile s={s} size={42} tone={tone} locked={i >= have} />
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Set komplett: {reward}</p>
    </Card>
  );
}

function SceneVitrine() {
  return (
    <>
      <Title title="Vitrine" sub="Alles, was du gesammelt hast" />
      <Draft />
      <Pinned />
      <Tabs active="Pass" />
      <SetBox
        title="🍂 Herbst 2026 · Sticker"
        sub="Nur im Saison-Pass Herbst 2026, kommt nie wieder"
        stickers={HERBST}
        have={8}
        tone="#D9822B"
        reward="Rahmen „Herbstlaub“"
      />
      <Card>
        <div className="mb-2 font-display text-sm font-semibold text-ink">Herbst 2026 · Rahmen und Titel</div>
        <div className="flex flex-wrap gap-1.5">
          {["🥉 Saison-Bronze", "🥈 Saison-Silber", "🍂 Herbstläufer", "🍁 Laubjäger"].map((t) => (
            <span key={t} className="whitespace-nowrap rounded-full border border-gold/60 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
              {t}
            </span>
          ))}
          {["Saison-Gold", "Nebeltipper", "Saison-Diamant", "Herbstmeister 2026"].map((t) => (
            <span key={t} className="whitespace-nowrap rounded-full border border-dashed border-edge px-2.5 py-0.5 text-xs text-muted">
              🔒 {t}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

function SceneTueten() {
  return (
    <>
      <Title title="Vitrine" sub="Alles, was du gesammelt hast" />
      <Draft />
      <Tabs active="Tüten" />
      <SetBox
        title="🎉 Torjubel · Sticker"
        sub="Aus Wundertüten, gibt es immer"
        stickers={TORJUBEL}
        have={5}
        tone="#4FB3A9"
        reward="Abzeichen „Jubel-Sammler“"
      />
      <Card>
        <div className="mb-3 font-display text-sm font-semibold text-ink">Looks aus Tüten</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            { n: "Polarlicht", c: "#B694F6", on: true },
            { n: "Eisblau", c: "#5AA9F5", on: true },
            { n: "Lava", c: "#F2643A", on: false },
            { n: "Smaragd", c: "#3DBE7A", on: true },
            { n: "Nacht", c: "#5B6CB8", on: false },
            { n: "Gold-Glanz", c: "#F5C542", on: false },
          ].map((l) => (
            <div key={l.n} className="flex flex-col items-center text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full bg-pitch font-display text-base font-bold text-ink"
                style={l.on ? { boxShadow: `0 0 0 3px ${l.c}` } : { border: "2px dashed rgba(255,255,255,0.18)", color: "rgb(var(--c-muted))" }}
              >
                {l.on ? "R" : "?"}
              </span>
              <span className={`mt-1.5 text-[11px] leading-tight ${l.on ? "text-ink" : "text-muted"}`}>{l.n}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// 6) Sticker-Orte: Rangliste, Profil, Reaktion auf den Tipp eines Freundes
// ---------------------------------------------------------------------------
function Avatar({ name, ring }: { name: string; ring?: string }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-sm font-bold text-ink"
      style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
    >
      {name[0]}
    </span>
  );
}

function SceneSticker() {
  const rows = [
    { r: 1, n: "Doris", p: 312, s: TORJUBEL[4] },
    { r: 2, n: "Rene", p: 287, s: HERBST[7], me: true },
    { r: 3, n: "Maximilian", p: 240, s: TORJUBEL[2] },
    { r: 4, n: "Lena", p: 198, s: null },
  ];
  return (
    <>
      <Draft />
      <h2 className="mb-2 font-display text-base font-semibold text-ink">Rangliste</h2>
      <div className="mb-6 overflow-hidden rounded-card border border-edge bg-surface">
        {rows.map((x, i) => (
          <div
            key={x.n}
            className={`flex items-center justify-between px-3 py-3.5 sm:px-5 ${i !== rows.length - 1 ? "border-b border-edge" : ""} ${x.me ? "bg-surface-hover" : ""}`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-muted">{x.r}</span>
              <Avatar name={x.n} />
              <span className={`min-w-0 truncate font-display text-base font-semibold ${x.me ? "text-gold" : "text-ink"}`}>{x.n}</span>
              {x.s && <StickerTile s={x.s} size={26} tone={x.s === HERBST[7] ? "#D9822B" : "#4FB3A9"} />}
              {x.me && <span className="shrink-0 text-xs text-muted">(Du)</span>}
            </div>
            <span className="ml-2 shrink-0 font-display text-base font-semibold text-ink">{x.p}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 font-display text-base font-semibold text-ink">Profil</h2>
      <Card className="mb-6">
        <div className="flex items-center gap-3">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-2xl font-bold text-ink"
            style={{ boxShadow: "0 0 0 3px #B694F6, 0 0 14px #B694F688" }}
          >
            R
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-ink">Rene</span>
              <StickerTile s={HERBST[7]} size={30} tone="#D9822B" />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="whitespace-nowrap rounded-full border border-gold bg-gold/15 px-2 py-px text-[11px] font-bold text-gold">🍀 Glückspilz</span>
              <span className="whitespace-nowrap rounded-full border border-edge bg-surface-hover px-2 py-px text-[11px] font-semibold text-ink">🍁 Laubjäger</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Lieblings-Sticker steht neben deinem Namen: in der Rangliste, im Profil und im Chat.</p>
      </Card>

      <h2 className="mb-2 font-display text-base font-semibold text-ink">Freunde · Tipp von Doris</h2>
      <Card>
        <div className="flex items-center gap-2.5">
          <Avatar name="Doris" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink">
              <span className="font-semibold">Doris</span> tippt <span className="whitespace-nowrap font-semibold">Rapid 3:0 Stuttgart</span>
            </div>
            <div className="text-xs text-muted">Bundesliga · Sa 15:30 · vor 12 Min.</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[
            { s: TORJUBEL[1], n: 2, mine: true },
            { s: TORJUBEL[5], n: 1 },
            { s: HERBST[10], n: 1, tone: "#D9822B" },
          ].map((x) => (
            <span
              key={x.s.label}
              className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs font-semibold ${x.mine ? "border-gold bg-gold/15 text-gold" : "border-edge bg-surface-hover text-ink"}`}
            >
              <StickerTile s={x.s} size={26} tone={x.tone ?? "#4FB3A9"} />
              {x.n}
            </span>
          ))}
          <span className="inline-flex h-7 items-center rounded-full border border-dashed border-edge px-2.5 text-xs text-muted">+ Sticker</span>
        </div>
        <p className="mt-3 text-xs text-muted">Du hast mit „Schock“ reagiert. Doris sieht es sofort.</p>
      </Card>
    </>
  );
}

function Scenes() {
  const szene = useSearchParams().get("szene") ?? "start";
  const map: Record<string, () => JSX.Element> = {
    start: SceneStart,
    oeffnen: SceneOeffnen,
    gewinn: SceneGewinn,
    stufen: SceneStufen,
    erfolge: SceneErfolge,
    vitrine: SceneVitrine,
    tueten: SceneTueten,
    sticker: SceneSticker,
  };
  const Scene = map[szene] ?? SceneStart;
  return (
    <main className="mx-auto max-w-3xl px-5 py-8 lg:max-w-4xl">
      <style>{`@keyframes bagWiggle{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}`}</style>
      <Scene />
    </main>
  );
}

export default function EntwurfBelohnungen() {
  return (
    <Suspense fallback={null}>
      <Scenes />
    </Suspense>
  );
}
