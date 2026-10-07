import Link from "next/link";

// Einheitlicher, freundlicher Hinweis, wenn eine Liste (noch) leer ist:
// Bild, kurze Überschrift, ein Satz und wenn sinnvoll ein Knopf zum
// nächsten Schritt – statt nur grauem Text.
export default function EmptyState({
  emoji,
  title,
  text,
  action,
  className = "",
}: {
  emoji: string;
  title: string;
  text?: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-card border border-dashed border-edge bg-surface/60 px-6 py-8 text-center ${className}`}
    >
      <span
        aria-hidden
        className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10 text-[28px] leading-none shadow-[0_0_24px_rgb(var(--c-gold)/0.15)]"
      >
        {emoji}
      </span>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm leading-snug text-muted">{text}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 rounded-full border border-action/60 px-4 py-1.5 font-display text-sm font-semibold text-action transition-colors hover:bg-action/10"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
