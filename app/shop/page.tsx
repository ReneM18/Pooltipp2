"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { mockShopItems, ShopItem, SHOP_ENABLED } from "@/lib/mockShopItems";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";

export default function ShopPage() {
  if (!SHOP_ENABLED) return <ShopComingSoon />;
  return <Shop />;
}

function ShopComingSoon() {
  return (
    <main className="mx-auto max-w-md px-5 py-12 text-center">
      <p className="text-5xl">🛒</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-ink">Prämien-Shop kommt bald</h1>
      <p className="mt-2 text-sm text-muted">Hier gibt es später Joker für deine Tipps.</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-full bg-action-hover px-5 py-2.5 font-display text-base font-semibold text-pitch transition-all hover:brightness-110"
      >
        Zu den Spielen
      </Link>
    </main>
  );
}

function Shop() {
  const { freeStars, spendStars, stakeBudgetRemainingToday } = useUser();
  const { showToast, celebrate } = useFeedback();
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);
  // Schutz gegen Doppel-Klick (gleiches Muster wie bei den Tipp-Formularen).
  const redeemingRef = useRef(false);

  function handleRedeem(item: ShopItem) {
    if (redeemingRef.current) return;
    redeemingRef.current = true;

    // spendStars() kann WENIGER als den vollen Preis abziehen, wenn das
    // Sterne-Guthaben oder das Tages-Limit nicht reicht (Sicherheitsnetz für
    // Tipp-Einsätze – siehe UserContext.spendStars). Für den Shop soll das
    // aber immer "alles oder nichts" sein: vorher prüfen, damit nie Sterne
    // abgebucht werden, ohne dass die Prämie auch wirklich gutgeschrieben wird.
    if (freeStars < item.cost || stakeBudgetRemainingToday < item.cost) {
      showToast("✗ Nicht genug Sterne verfügbar (oder heutiges Limit erreicht).", "info");
      redeemingRef.current = false;
      return;
    }

    const actual = spendStars(item.cost);
    if (actual === item.cost) {
      setRedeemedIds((current) => [...current, item.id]);
      celebrate();
      showToast(`✓ „${item.name}" eingelöst!`, "gold");
    } else {
      showToast("✗ Einlösen hat nicht geklappt – bitte nochmal versuchen.", "info");
    }
    redeemingRef.current = false;
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Prämien-Shop</h1>
        <p className="mt-0.5 text-xs text-muted">
          Sterne gegen spielerische Vorteile – kein Echtgeld nötig.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockShopItems.map((item) => (
          <ShopItemCard
            key={item.id}
            item={item}
            canAfford={freeStars >= item.cost && stakeBudgetRemainingToday >= item.cost}
            redeemed={redeemedIds.includes(item.id)}
            onRedeem={() => handleRedeem(item)}
          />
        ))}
      </div>
    </main>
  );
}

function ShopItemCard({
  item,
  canAfford,
  redeemed,
  onRedeem,
}: {
  item: ShopItem;
  canAfford: boolean;
  redeemed: boolean;
  onRedeem: () => void;
}) {
  const disabled = redeemed || !canAfford;

  return (
    <div className="flex flex-col justify-between rounded-card border border-edge bg-surface p-5">
      <div>
        <h3 className="font-display text-base font-semibold text-ink">{item.name}</h3>
        <p className="mt-1 text-sm text-muted">{item.description}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="font-display font-semibold text-gold">
          ⭐ {item.cost.toLocaleString("de-DE")}
        </span>
        <button
          onClick={onRedeem}
          disabled={disabled}
          className="rounded-full bg-action px-4 py-1.5 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          {redeemed ? "Eingelöst" : canAfford ? "Einlösen" : "Zu wenig Sterne"}
        </button>
      </div>
    </div>
  );
}
