import type { Metadata } from "next";
import { Rajdhani, Inter, Poppins } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/UserContext";
import { AppDataProvider } from "@/lib/AppDataContext";
import { TeamsProvider } from "@/lib/TeamsContext";
import { DuelsProvider } from "@/lib/DuelsContext";
import { TournamentProvider } from "@/lib/TournamentContext";
import { FeedbackProvider } from "@/lib/FeedbackContext";
import AppChrome from "@/components/AppChrome";

// Rajdhani wird jetzt NUR noch fürs "PoolTipp"-Logo in der Navbar verwendet
// (siehe font-logo in tailwind.config.ts) – überall sonst übernimmt Poppins.
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-rajdhani",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PoolTipp",
  description: "Das Social-Tippspiel für echte Sportfans.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${rajdhani.variable} ${poppins.variable} ${inter.variable}`}>
      <body className="font-body min-h-screen bg-pitch text-ink antialiased">
        <AppDataProvider>
          <UserProvider>
            <DuelsProvider>
              <TournamentProvider>
                <TeamsProvider>
                  <FeedbackProvider>
                    <AppChrome>{children}</AppChrome>
                  </FeedbackProvider>
                </TeamsProvider>
              </TournamentProvider>
            </DuelsProvider>
          </UserProvider>
        </AppDataProvider>
      </body>
    </html>
  );
}
