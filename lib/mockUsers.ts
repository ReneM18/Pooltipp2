// Mock-Profile für andere User (Rangliste/Freunde/Chat) – bis es echte
// Accounts mit Firestore gibt, simuliert das die Foto-Privatsphäre-Einstellung
// jedes einzelnen Users. Ein unbekannter Name (z. B. manuell im Freunde-Reiter
// hinzugefügt) fällt auf "friends" zurück (sichere Vorgabe: privat).

export type PhotoVisibility = "public" | "friends";

export interface MockUserProfile {
  name: string;
  photoVisibility: PhotoVisibility;
  // Platzhalter-„Fotos“ (Emoji + Farbverlauf), da es ohne echtes Backend keine
  // hochgeladenen Bilder anderer User gibt.
  photos: { emoji: string; from: string; to: string }[];
  bio: string;
}

export const MOCK_USERS: Record<string, MockUserProfile> = {
  "Sabine K.": {
    name: "Sabine K.",
    photoVisibility: "public",
    photos: [
      { emoji: "⚽", from: "#3FA66B", to: "#1E2F29" },
      { emoji: "🏆", from: "#E8B34C", to: "#4A3D22" },
    ],
    bio: "Tippt seit Saisonstart fast täglich – aktuell Platz 1 in der Gesamt-Rangliste.",
  },
  "Marco T.": {
    name: "Marco T.",
    photoVisibility: "friends",
    photos: [
      { emoji: "🏈", from: "#3FA66B", to: "#1E2F29" },
      { emoji: "🎯", from: "#E8B34C", to: "#4A3D22" },
    ],
    bio: "NFL-Experte der Gruppe.",
  },
  "Jonas W.": {
    name: "Jonas W.",
    photoVisibility: "public",
    photos: [{ emoji: "🏒", from: "#0038A8", to: "#12203f" }],
    bio: "Neu bei NHL-Tipps, aber schon ziemlich treffsicher.",
  },
  "Fatima R.": {
    name: "Fatima R.",
    photoVisibility: "friends",
    photos: [
      { emoji: "🏀", from: "#CE1141", to: "#3a0f18" },
      { emoji: "⭐", from: "#E8B34C", to: "#4A3D22" },
    ],
    bio: "NBA-Fan, tippt am liebsten knappe Spiele.",
  },
  "Timo B.": {
    name: "Timo B.",
    photoVisibility: "friends",
    photos: [{ emoji: "🎲", from: "#8B9890", to: "#24332C" }],
    bio: "Dabei seit der ersten Saison.",
  },
  "Nina S.": {
    name: "Nina S.",
    photoVisibility: "public",
    photos: [{ emoji: "⚽", from: "#3FA66B", to: "#1E2F29" }],
    bio: "Fußball first, alles andere nebenbei.",
  },
};

export function getMockUserProfile(name: string): MockUserProfile {
  return (
    MOCK_USERS[name] ?? {
      name,
      photoVisibility: "friends",
      photos: [],
      bio: "Noch keine Angaben hinterlegt.",
    }
  );
}
