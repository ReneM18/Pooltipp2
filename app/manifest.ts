import type { MetadataRoute } from "next";

// Web-App-Manifest: legt Name, Farben und Icons fest, wenn PoolTipp auf den
// Homescreen gelegt wird (Android/Chrome). Das iPhone nimmt app/apple-icon.png.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PoolTipp",
    short_name: "PoolTipp",
    description: "Das Social-Tippspiel für echte Sportfans.",
    start_url: "/",
    // "browser" statt "standalone": die Homescreen-Verknüpfung öffnet weiter
    // normal im Browser, damit Login und Bestätigungs-Mails wie gewohnt gehen.
    display: "browser",
    background_color: "#0D1512",
    theme_color: "#0D1512",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
