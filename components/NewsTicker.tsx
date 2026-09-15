const headlines = [
  "🔥 Bayern führt weiter die Bundesliga-Tabelle an",
  "⚡ Neu im Prämien-Shop: der Titel „Tipp-König“",
  "🏆 Sabine K. verteidigt Platz 1 in der Rangliste",
  "📊 Über 500.000 Sterne im Spiel-Topf diesen Spieltag",
  "🎯 Perfekter Tipp bringt den größten Sterne-Gewinn",
];

export default function NewsTicker() {
  const content = headlines.join("   •   ");

  return (
    <div className="overflow-hidden border-b border-edge bg-gold py-1.5">
      <div className="ticker-track flex whitespace-nowrap font-display text-sm font-semibold text-pitch">
        <span className="px-4">{content}</span>
        <span className="px-4" aria-hidden="true">
          {content}
        </span>
      </div>
    </div>
  );
}
