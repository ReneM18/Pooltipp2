import type { Metadata } from "next";

// Vorschau, wenn der Link in WhatsApp & Co. geteilt wird.
export const metadata: Metadata = {
  title: "Einladung zu PoolTipp",
  description: "Tipp mit mir bei PoolTipp! Über diesen Link sind wir gleich Freunde.",
};

export default function EinladungLayout({ children }: { children: React.ReactNode }) {
  return children;
}
