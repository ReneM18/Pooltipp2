export default function Footer() {
  return (
    <footer className="mt-10 border-t border-edge bg-surface/40">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h2 className="mb-2 font-display text-base font-bold text-ink">Über PoolTipp</h2>
        <p className="text-sm leading-relaxed text-muted">
          PoolTipp ist das kostenlose Social-Tippspiel für echte Sportfans: Tippe live vor jedem
          Spiel deiner Lieblingsligen (Fußball, NFL, NBA, NHL) das Ergebnis – und tritt dabei direkt
          gegen alle anderen Mitspieler an, nicht gegen die App. Je genauer dein Tipp, desto mehr
          Rangliste-Punkte, Sterne und Prämien-Shop-Guthaben sammelst du. Dazu gibt's echte
          Live-Ergebnisse und Tabellen im Matchcenter, einen Saison-Pass mit Belohnungen fürs
          tägliche Reinschauen, eine Rangliste pro Sportart und private Tipprunden für Freunde,
          Verein oder Kollegen. Alles komplett kostenlos – gespielt wird nur um virtuelle Sterne,
          nie um echtes Geld.
        </p>
        <p className="mt-4 text-xs text-muted">© {new Date().getFullYear()} PoolTipp</p>
      </div>
    </footer>
  );
}
