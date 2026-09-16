"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { mockUser } from "@/lib/mockData";

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
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [displayName, setDisplayName] = useState(mockUser.displayName);
  const [freeStars, setFreeStars] = useState(mockUser.freeStars);
  const [points] = useState(mockUser.points);
  const [tipsSubmitted, setTipsSubmitted] = useState(0);
  const [friends, setFriends] = useState<string[]>(["Sabine K.", "Marco T."]);

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
