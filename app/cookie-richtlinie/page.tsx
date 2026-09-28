export default function CookieRichtliniePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Cookie-Richtlinie</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <p>
          PoolTipp verwendet Cookies und ähnliche Technologien, um die App funktionsfähig zu
          halten und dein Nutzungserlebnis zu verbessern.
        </p>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Notwendige Cookies</h2>
          <p>
            Diese Cookies sind erforderlich, damit grundlegende Funktionen wie das Anmelden oder
            das Speichern deiner Tipps funktionieren. Sie können nicht deaktiviert werden, ohne die
            Funktion der App einzuschränken.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Funktionale &amp; Statistik-Cookies</h2>
          <p>
            Optionale Cookies helfen uns zu verstehen, wie PoolTipp genutzt wird, damit wir die App
            weiter verbessern können. Diese kommen nur zum Einsatz, wenn du dem zustimmst.
          </p>
        </section>
        <p className="text-xs text-muted">
          Dies ist ein Platzhaltertext und ersetzt keine rechtsverbindliche Cookie-Richtlinie.
        </p>
      </div>
    </main>
  );
}
