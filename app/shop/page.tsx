"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CoinIcon } from "@/components/CoinIcon";
import { mockShopItems, ShopItem } from "@/lib/mockShopItems";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { useJokers } from "@/lib/JokerContext";
import { Bag, TASCHEN, TASCHEN_REIHE } from "@/components/BagIcon";

// Joker-Shop (supabase/joker-shop.sql). Kaufen geht erst, wenn der Admin den
// Shop freigegeben hat; der Admin kann vorher schon testen. Ohne Login oder
// solange das SQL fehlt, zeigt die Seite nur die Vorschau.
export default function ShopPage() {
  const { freeStars, isAdmin } = useUser();
  const jokers = useJokers();
  // ENTWURF: ?vorschau=offen zeigt den Shop, als wäre Kaufen freigegeben.
  // ?vorschau=limit zeigt zusätzlich: diese Woche schon eine Tasche gekauft.
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => setPreview(new URLSearchParams(window.location.search).get("vorschau")), []);
  const previewOpen = preview === "offen" || preview === "limit";
  const { ready, stock, buyJoker } = jokers;
  const shopOpen = jokers.shopOpen || previewOpen;
  const canBuy = jokers.canBuy || previewOpen;
  const { showToast, celebrate } = useFeedback();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  // Schutz gegen Doppel-Klick (gleiches Muster wie bei den Tipp-Formularen).
  const buyingRef = useRef(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  async function handleBuy(item: ShopItem) {
    if (buyingRef.current) return;
    buyingRef.current = true;
    setBuyingId(item.id);
    const failed = await buyJoker(item.joker);
    if (failed) {
      showToast(`✗ ${failed}`, "info");
    } else {
      celebrate();
      showToast(`✓ ${item.name} gekauft – liegt jetzt in deinem Vorrat.`, "gold");
    }
    setConfirmId(null);
    setBuyingId(null);
    buyingRef.current = false;
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Prämien-Shop</h1>
        <p className="mt-0.5 text-xs text-muted">Coins gegen Joker und Taschen – kein Echtgeld nötig.</p>
      </div>

      {(!ready && !previewOpen) || (!shopOpen && !isAdmin) ? (
        <div className="mb-4 rounded-card border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          <span className="font-semibold text-gold">Bald verfügbar:</span> So sieht der Shop aus. Kaufen ist noch
          gesperrt, es werden keine Coins abgebucht.
        </div>
      ) : (
        !shopOpen && (
          <div className="mb-4 rounded-card border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
            <span className="font-semibold text-gold">Nur für dich als Admin:</span> Für alle Spieler ist Kaufen noch
            gesperrt. Du kannst schon testen, das kostet deine echten Coins. Freigeben kannst du den Shop im{" "}
            <Link href="/admin" className="font-semibold text-gold underline-offset-2 hover:underline">
              Admin-Bereich
            </Link>
            .
          </div>
        )
      )}

      <h2 className="mb-3 font-display text-base font-semibold text-ink">Joker</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockShopItems.map((item) => (
          <ShopItemCard
            key={item.id}
            item={item}
            owned={ready ? stock[item.joker] : null}
            canBuy={canBuy}
            canAfford={freeStars >= item.cost}
            confirming={confirmId === item.id}
            buying={buyingId === item.id}
            onBuy={() => (confirmId === item.id ? handleBuy(item) : setConfirmId(item.id))}
            onCancel={() => setConfirmId(null)}
          />
        ))}
      </div>

      <BagSection canBuy={canBuy} freeStars={freeStars} limitReached={preview === "limit"} />

      {ready && (
        <div className="mt-6 rounded-card border border-edge bg-surface px-4 py-3 text-sm text-muted">
          <p className="font-semibold text-ink">So setzt du Joker ein</p>
          <p className="mt-1">
            Schutz-, Doppel- und Toleranz-Joker setzt du nach dem Tippen direkt auf der Tipp-Karte, bis zum
            Tippschluss. Pro Tipp geht ein Joker, abnehmen geht auch. Den Trend-Joker öffnest du ebenfalls auf der
            Tipp-Karte. Der Pause-Joker wirkt von allein, wenn du eine Woche nicht tippst.
          </p>
        </div>
      )}
    </main>
  );
}

function ShopItemCard({
  item,
  owned,
  canBuy,
  canAfford,
  confirming,
  buying,
  onBuy,
  onCancel,
}: {
  item: ShopItem;
  owned: number | null;
  canBuy: boolean;
  canAfford: boolean;
  confirming: boolean;
  buying: boolean;
  onBuy: () => void;
  onCancel: () => void;
}) {
  const disabled = !canBuy || !canAfford || buying;
  const label = !canBuy
    ? "Bald verfügbar"
    : buying
      ? "Wird gekauft…"
      : !canAfford
        ? "Zu wenig Coins"
        : confirming
          ? "Jetzt kaufen"
          : "Kaufen";

  return (
    <div className="flex flex-col justify-between rounded-card border border-edge bg-surface p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-ink">{item.name}</h3>
          {owned !== null && owned > 0 && (
            <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
              Im Vorrat: {owned}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">{item.description}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display font-semibold text-gold"><CoinIcon className="h-5 w-5" />{item.cost.toLocaleString("de-DE")}</span>
        <div className="flex items-center gap-2">
          {confirming && !buying && (
            <button onClick={onCancel} className="text-sm font-semibold text-muted transition-colors hover:text-ink">
              Abbrechen
            </button>
          )}
          <button
            onClick={onBuy}
            disabled={disabled}
            className="rounded-full bg-action px-4 py-1.5 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ENTWURF: Abschnitt "Taschen" im selben Shop. Gleicher Look wie die Joker,
// gleicher Admin-Schalter "Kaufen freigeben". 1 Tasche pro Woche. Nach dem
// Kauf wird der Reißverschluss aufgezogen (siehe app/entwurf/taschen).
function BagSection({ canBuy, freeStars, limitReached }: { canBuy: boolean; freeStars: number; limitReached: boolean }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-base font-semibold text-ink">Trainingstaschen</h2>
        <span className="text-xs text-muted">
          1 Tasche pro Woche · {limitReached ? "diese Woche schon gekauft" : "diese Woche noch frei"} ·{" "}
          <Link href="/entwurf/taschen?szene=inhalt" className="whitespace-nowrap font-semibold text-gold underline-offset-2 hover:underline">
            Was kann drin sein?
          </Link>
        </span>
      </div>
      {limitReached && (
        <div className="mb-3 rounded-card border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Diese Woche hast du schon eine Tasche gekauft.</span> Ab Montag geht wieder eine.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TASCHEN_REIHE.map((t) => {
          const k = TASCHEN[t];
          const afford = freeStars >= k.price;
          const label = !canBuy ? "Bald verfügbar" : limitReached ? "Ab Montag" : !afford ? "Zu wenig Coins" : "Kaufen";
          return (
            <div key={t} className="flex flex-col justify-between rounded-card border border-edge bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="shrink-0">
                  <Bag tier={t} size={76} />
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
                  {canBuy && !limitReached && !afford && (
                    <span className="text-xs text-muted">noch {(k.price - freeStars).toLocaleString("de-DE")}</span>
                  )}
                  <button
                    disabled={!canBuy || limitReached || !afford}
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
    </section>
  );
}
