import { UserProfile } from "./types";

export const mockUser: UserProfile = {
  id: "demo-user-1",
  // Name, den Besucher ohne Login sehen – bewusst kein echter Name, sonst
  // wirkt es, als wäre man in einem fremden Konto.
  displayName: "Gast",
  freeStars: 240,
  passXP: 1180,
};
