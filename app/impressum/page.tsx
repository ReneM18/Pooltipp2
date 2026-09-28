export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Impressum</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <p>Angaben gemäß den gesetzlichen Vorgaben:</p>
        <div className="rounded-card border border-dashed border-edge bg-surface p-4">
          <p className="text-ink">[Name / Firmenname einfügen]</p>
          <p>[Adresse einfügen]</p>
          <p>[E-Mail-Adresse einfügen]</p>
          <p>[Telefonnummer, falls vorhanden]</p>
        </div>
        <p className="text-xs text-muted">
          Diese Seite ist ein Platzhalter. Sobald feststeht, unter welchem Namen bzw. welcher
          Rechtsform PoolTipp betrieben wird, ergänzen wir hier die vollständigen, rechtlich
          erforderlichen Angaben.
        </p>
      </div>
    </main>
  );
}
