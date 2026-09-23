"use client";

import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from "react";
import { mockUser } from "@/lib/mockData";
import { getAvailableRankIcons, getBestRankIcon, RankIconOption } from "@/lib/rankTiers";

interface UserContextValue {
  displayName: string;
  setDisplayName: (name: string) => void;
  freeStars: number;
  points: number;
  spendStars: (amount: number) => boolean;
  tipsSubmitted: number;
  recordTipSubmitted: () => void;
  friends: string[];
  addFriend: (name: string) => void;
  removeFriend: (name: string) => void;
  rankIconOptions: RankIconOption[];
  selectedRankIconId: string | null;
  setSelectedRankIconId: (id: string) => void;
  activeRankIcon: RankIconOption | null;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [displayName, setDisplayName] = useState(mockUser.displayName);
  const [freeStars, setFreeStars] = useState(mockUser.freeStars);
  const [points] = useState(mockUser.points);
  const [tipsSubmitted, setTipsSubmitted] = useState(0);
  const [friends, setFriends] = useState<string[]>(["Sabine K.", "Marco T."]);

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
  }

  return (
    <UserContext.Provider
      value={{
        displayName,
        setDisplayName,
        freeStars,
        points,
        spendStars,
        tipsSubmitted,
        recordTipSubmitted,
        friends,
        addFriend,
        removeFriend,
        rankIconOptions,
        selectedRankIconId,
        setSelectedRankIconId,
        activeRankIcon,
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
