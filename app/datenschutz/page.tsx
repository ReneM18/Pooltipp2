export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Datenschutzerklärung</h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted">
        <p>
          Der Schutz deiner persönlichen Daten ist uns wichtig. Diese Datenschutzerklärung
          informiert dich darüber, welche Daten bei der Nutzung von PoolTipp verarbeitet werden
          und zu welchem Zweck.
        </p>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Welche Daten wir verarbeiten</h2>
          <p>
            Für den Betrieb von PoolTipp verarbeiten wir Kontodaten (z. B. Name und E-Mail-Adresse
            bei der Registrierung), Nutzungsdaten (z. B. abgegebene Tipps, Punktestände, Aktivität
            in der App) sowie technische Daten (z. B. Geräte- und Browserinformationen), soweit sie
            für den Betrieb der App erforderlich sind.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Zweck der Verarbeitung</h2>
          <p>
            Die Daten werden verwendet, um dir die Funktionen von PoolTipp bereitzustellen (Tipps,
            Rangliste, private Tipprunden, Prämien-Shop) sowie um die App zu verbessern. Es findet
            keine Weitergabe deiner Daten an Dritte zu Werbezwecken statt.
          </p>
        </section>
        <section>
          <h2 className="mb-1 font-display text-base font-semibold text-ink">Deine Rechte</h2>
          <p>
            Du hast jederzeit das Recht auf Auskunft, Berichtigung und Löschung deiner
            gespeicherten Daten. Wende dich dazu an die im Impressum angegebene Kontaktadresse.
          </p>
        </section>
        <p className="text-xs text-muted">
          Dies ist ein Platzhaltertext und ersetzt keine rechtsverbindliche Datenschutzerklärung.
        </p>
      </div>
    </main>
  );
}
