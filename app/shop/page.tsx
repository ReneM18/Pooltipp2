"use client";

import { useState } from "react";
import { mockShopItems, ShopItem } from "@/lib/mockShopItems";
import { useUser } from "@/lib/UserContext";

const categories: ShopItem["category"][] = ["Profil", "In-Game", "Badges"];

export default function ShopPage() {
  const { freeStars, spendStars } = useUser();
  const [redeemedIds, setRedeemedIds] = useState<string[]>([]);

  function handleRedeem(item: ShopItem) {
    const success = spendStars(item.cost);
    if (success) {
      setRedeemedIds((current) => [...current, item.id]);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Prämien-Shop</h1>
        <p className="mt-1 text-sm text-muted">
          Tausche deine erspielten Sterne gegen Extras – kein Echtgeld nötig.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="mb-3 font-display text-lg font-semibold text-ink">{category}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {mockShopItems
                .filter((item) => item.category === category)
                .map((item) => (
                  <ShopItemCard
                    key={item.id}
                    item={item}
                    canAfford={freeStars >= item.cost}
                    redeemed={redeemedIds.includes(item.id)}
                    onRedeem={() => handleRedeem(item)}
                  />
                ))}
            </div>
          </section>
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
