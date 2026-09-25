"use client";

import { useState } from "react";
import { mockShopItems, ShopItem } from "@/lib/mockShopItems";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";

export default function ShopPage() {
  const { freeStars, spendStars } = useUser();
  const { showToast, celebrate } = useFeedback();
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);

  function handleRedeem(item: ShopItem) {
    const success = spendStars(item.cost);
    if (success) {
      setRedeemedIds((current) => [...current, item.id]);
      celebrate();
      showToast(`✓ „${item.name}" eingelöst!`, "gold");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Prämien-Shop</h1>
        <p className="mt-1 text-sm text-muted">
          Tausche deine erspielten Sterne gegen spielerische Vorteile – kein Echtgeld nötig. Optisches
          wie Rahmen, Farben und Titel gibt's nicht hier, sondern über den Saison-Pass.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mockShopItems.map((item) => (
          <ShopItemCard
            key={item.id}
            item={item}
            canAfford={freeStars >= item.cost}
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
