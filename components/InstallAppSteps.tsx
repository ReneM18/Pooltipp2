import type { InstallPlatform } from "@/lib/installApp";

// Die Schritte "PoolTipp auf den Home-Bildschirm legen", je nach Handy.
// Gebraucht im Hinweis unten am Handy (components/InstallHint.tsx) und im
// Profil unter Einstellungen → App (components/InstallAppCard.tsx).

// Das Teilen-Symbol aus Safari (Quadrat mit Pfeil nach oben), damit man es
// auf dem Bildschirm wiedererkennt.
export function ShareIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Teilen-Symbol"
      role="img"
      className={`inline-block h-[1.15em] w-[1.15em] align-[-0.2em] text-[#0A84FF] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
    </svg>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-sm font-bold text-gold">
        {n}
      </span>
      <span className="min-w-0 pt-0.5 text-sm leading-snug text-ink">{children}</span>
    </li>
  );
}

const q = (s: string) => <span className="font-semibold">„{s}“</span>;

export default function InstallAppSteps({ platform }: { platform: InstallPlatform }) {
  if (platform === "ios") {
    return (
      <div>
        <ol className="flex flex-col gap-3">
          <Step n={1}>
            Tippe auf das Teilen-Symbol <ShareIcon />. Siehst du es nicht, tippe zuerst unten auf {q("⋯")}.
          </Step>
          <Step n={2}>Wähle {q("Zum Home-Bildschirm")}. Eventuell weiter unten in der Liste.</Step>
          <Step n={3}>Tippe auf {q("Hinzufügen")}. Fertig!</Step>
        </ol>
        {/* Das iPhone trennt Safari und die App vom Home-Bildschirm: die
            Anmeldung wird nicht mitgenommen. */}
        <p className="mt-3 text-xs leading-snug text-muted">
          Öffne PoolTipp danach über das neue Symbol. Dort meldest du dich einmal neu an.
        </p>
      </div>
    );
  }
  if (platform === "android") {
    return (
      <ol className="flex flex-col gap-3">
        <Step n={1}>Tippe oben rechts auf das Menü {q("⋮")}.</Step>
        <Step n={2}>
          Wähle {q("App installieren")} oder {q("Zum Startbildschirm hinzufügen")}.
        </Step>
        <Step n={3}>Bestätige mit {q("Installieren")}. Fertig!</Step>
      </ol>
    );
  }
  return (
    <p className="text-sm leading-snug text-ink">
      Öffne PoolTipp am Handy. Dort legst du es mit zwei Tipps auf den Home-Bildschirm. In Chrome oder Edge am PC
      geht es über das Installieren-Symbol rechts in der Adressleiste.
    </p>
  );
}
