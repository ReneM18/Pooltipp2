import type { MetadataRoute } from "next";

// Web-App-Manifest: legt Name, Farben und Icons fest, wenn PoolTipp auf den
// Homescreen gelegt wird (Android/Chrome). Das iPhone nimmt app/apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PoolTipp",
    short_name: "PoolTipp",
    description: "Das Social-Tippspiel für echte Sportfans.",
    id: "/",
    start_url: "/",
    scope: "/",
    // Wie eine echte App (Rene, 29.10.2026): vom Home-Bildschirm aus öffnet
    // PoolTipp ohne Browserleiste. Links aus Mails (Bestätigen, Passwort)
    // öffnen am iPhone trotzdem im Browser; die Seite sagt dann, dass man
    // sich danach in der App anmeldet (app/registrieren/page.tsx).
    // Hinweis zum Installieren: components/InstallHint.tsx.
    display: "standalone",
    background_color: "#0D0D0D",
    theme_color: "#0D0D0D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
