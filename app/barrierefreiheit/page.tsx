export default function BarrierefreiheitPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Barrierefreiheitserklärung</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <p>
          Wir möchten, dass PoolTipp für möglichst alle Menschen gut nutzbar ist – unabhängig von
          Gerät, Sehvermögen oder Bedienweise.
        </p>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Unsere Maßnahmen</h2>
          <p>
            Wir achten auf ausreichend große Schaltflächen und Kontraste, verständliche
            Beschriftungen sowie eine klare, einfache Menüführung, damit sich auch neue Nutzer:innen
            schnell zurechtfinden.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Feedback</h2>
          <p>
            Solltest du auf eine Barriere in PoolTipp stoßen, freuen wir uns über deine
            Rückmeldung, damit wir die App weiter verbessern können.
          </p>
        </section>
        <p className="text-xs text-muted">
          Dies ist ein Platzhaltertext und ersetzt keine rechtsverbindliche Barrierefreiheitserklärung.
        </p>
      </div>
    </main>
  );
}
