export interface ShopItem {
  id: string;
  category: "Profil" | "In-Game" | "Badges";
  name: string;
  description: string;
  cost: number; // in Sternen
}

export const mockShopItems: ShopItem[] = [
  {
    id: "profile-gold-frame",
    category: "Profil",
    name: "Gold-Rahmen",
    description: "Exklusiver animierter Rahmen für dein Profilbild.",
    cost: 150,
  },
  {
    id: "profile-title-tippkoenig",
    category: "Profil",
    name: 'Titel "Tipp-König"',
    description: "Zeigt allen anderen Usern deinen Status in der Rangliste.",
    cost: 300,
  },
  {
    id: "joker-extra",
    category: "In-Game",
    name: "Extra-Joker",
    description: "Ein zusätzlicher Risiko-Joker für den nächsten Spieltag.",
    cost: 80,
  },
  {
    id: "streak-saver",
    category: "In-Game",
    name: "Streak-Retter",
    description: "Rettet deine Tipp-Serie, falls du einen Spieltag verpasst.",
    cost: 120,
  },
  {
    id: "badge-perfekt",
    category: "Badges",
    name: 'Badge "Perfekter Spieltag"',
    description: "Für alle, die einen kompletten Spieltag exakt getippt haben.",
    cost: 200,
  },
  {
    id: "badge-veteran",
    category: "Badges",
    name: 'Badge "Saison-Veteran"',
    description: "Zeigt, dass du seit der ersten Saison dabei bist.",
    cost: 250,
  },
];
