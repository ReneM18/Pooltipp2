"use client";

import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from "react";
import { mockUser } from "@/lib/mockData";
import { getAvailableRankIcons, getBestRankIcon, RankIconOption } from "@/lib/rankTiers";
import { PhotoVisibility } from "@/lib/mockUsers";
import { useAppData } from "@/lib/AppDataContext";

interface UserContextValue {
  displayName: string;
  setDisplayName: (name: string) => void;
  freeStars: number;
  points: number;
  addPoints: (amount: number) => void;
  spendStars: (amount: number) => boolean;
  tipsSubmitted: number;
  recordTipSubmitted: () => void;
  friends: string[];
  addFriend: (name: string) => void;
  removeFriend: (name: string) => void;
  pendingRequests: string[];
  sendFriendRequest: (name: string) => void;
  photoVisibility: PhotoVisibility;
  setPhotoVisibility: (visibility: PhotoVisibility) => void;
  rankIconOptions: RankIconOption[];
  selectedRankIconId: string | null;
  setSelectedRankIconId: (id: string) => void;
  activeRankIcon: RankIconOption | null;
  hasPremiumPass: boolean;
  buyPremiumPass: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { addActivity } = useAppData();
  const [displayName, setDisplayName] = useState(mockUser.displayName);
  const [freeStars, setFreeStars] = useState(mockUser.freeStars);
  const [points, setPoints] = useState(mockUser.points);

  function addPoints(amount: number) {
    setPoints((current) => current + amount);
  }
  const [tipsSubmitted, setTipsSubmitted] = useState(0);
  const [friends, setFriends] = useState<string[]>(["Sabine K.", "Marco T."]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [photoVisibility, setPhotoVisibility] = useState<PhotoVisibility>("friends");
  const [hasPremiumPass, setHasPremiumPass] = useState(false);

  // Platzhalter für die echte Zahlungsanbindung (z. B. Stripe/RevenueCat) –
  // schaltet die Premium-Spur des Saison-Passes lokal frei.
  function buyPremiumPass() {
    setHasPremiumPass(true);
  }

  const rankIconOptions = useMemo(() => getAvailableRankIcons(), []);
  const [selectedRankIconId, setSelectedRankIconId] = useState<string | null>(null);

  // Standardmäßig das beste verfügbare Icon (Elite, sonst höchster Sport-Rang) anzeigen.
  useEffect(() => {
    if (selectedRankIconId === null && rankIconOptions.length > 0) {
      const best = getBestRankIcon(rankIconOptions);
      if (best) setSelectedRankIconId(best.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankIconOptions]);

  const activeRankIcon =
    rankIconOptions.find((o) => o.id === selectedRankIconId) ?? getBestRankIcon(rankIconOptions);

  function spendStars(amount: number) {
    if (amount > freeStars) return false;
    setFreeStars((current) => current - amount);
    return true;
  }

  function recordTipSubmitted() {
    setTipsSubmitted((current) => current + 1);
  }

  function addFriend(name: string) {
    setFriends((current) => (current.includes(name) ? current : [...current, name]));
  }

  function removeFriend(name: string) {
    setFriends((current) => current.filter((f) => f !== name));
    setPendingRequests((current) => current.filter((n) => n !== name));
  }

  // Da es (noch) keine echten Gegenüber-Accounts gibt, simuliert das die
  // Annahme der Freundschaftsanfrage nach kurzer Zeit – erst danach werden
  // z. B. private Fotos des anderen Users sichtbar.
  function sendFriendRequest(name: string) {
    if (!name.trim() || friends.includes(name) || pendingRequests.includes(name)) return;
    setPendingRequests((current) => [...current, name]);
    setTimeout(() => {
      setFriends((current) => (current.includes(name) ? current : [...current, name]));
      setPendingRequests((current) => current.filter((n) => n !== name));
      addActivity("🤝", `Du bist jetzt mit ${name} befreundet.`);
    }, 2500);
  }

  return (
    <UserContext.Provider
      value={{
        displayName,
        setDisplayName,
        freeStars,
        points,
        addPoints,
        spendStars,
        tipsSubmitted,
        recordTipSubmitted,
        friends,
        addFriend,
        removeFriend,
        pendingRequests,
        sendFriendRequest,
        photoVisibility,
        setPhotoVisibility,
        rankIconOptions,
        selectedRankIconId,
        setSelectedRankIconId,
        activeRankIcon,
        hasPremiumPass,
        buyPremiumPass,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser muss innerhalb von <UserProvider> verwendet werden");
  }
  return context;
}
