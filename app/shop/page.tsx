"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CoinIcon } from "@/components/CoinIcon";
import { mockShopItems, ShopItem } from "@/lib/mockShopItems";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { useJokers } from "@/lib/JokerContext";
import { TaschenSection } from "@/components/TaschenShop";

// Joker-Shop (supabase/joker-shop.sql). Kaufen geht erst, wenn der Admin den
// Shop freigegeben hat; der Admin kann vorher schon testen. Ohne Login oder
// solange das SQL fehlt, zeigt die Seite nur die Vorschau.
export default function ShopPage() {
  const { freeStars, isAdmin } = useUser();
  const { ready, shopOpen, canBuy, stock, buyJoker } = useJokers();
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

      {!ready || (!shopOpen && !isAdmin) ? (
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

      <TaschenSection />

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
