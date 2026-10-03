export default function AgbPage() {
  return (
    <main className="mx-auto max-w-3xl lg:max-w-4xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Geschäftsbedingungen</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <p>
          Mit der Nutzung von PoolTipp erklärst du dich mit den folgenden Bedingungen
          einverstanden.
        </p>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Nutzung der App</h2>
          <p>
            PoolTipp ist ein kostenloses Social-Tippspiel. Es wird ausschließlich um virtuelle
            Punkte, Rangliste-Plätze und Sterne gespielt – niemals um echtes Geld. Sterne sind
            kostenlos, können nicht gekauft, verkauft, an andere übertragen oder in Geld getauscht
            werden. Ein Rechtsanspruch auf bestimmte Prämien im Shop besteht nicht.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Verhalten in der Community</h2>
          <p>
            Wir erwarten einen respektvollen Umgang miteinander in Kommentaren, Chat und privaten
            Tipprunden. Bei Missbrauch können einzelne Funktionen eingeschränkt werden.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Änderungen</h2>
          <p>
            Wir können diese Bedingungen anpassen, um sie an neue Funktionen von PoolTipp
            anzupassen. Über wesentliche Änderungen informieren wir in der App.
          </p>
        </section>
        <p className="text-xs text-muted">
          Dies ist ein Platzhaltertext und ersetzt keine rechtsverbindlichen Geschäftsbedingungen.
        </p>
      </div>
    </main>
  );
}
