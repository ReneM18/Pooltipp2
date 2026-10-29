"use client";

// Ein einheitlicher An/Aus-Schalter für alle Einstellungen (Rene, 29.10.2026:
// vorher mal Schalter, mal zwei Knöpfe "An"/"Aus").
export default function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        on ? "border-gold bg-gold/80" : "border-edge bg-pitch"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${on ? "left-6" : "left-0.5"}`} />
    </button>
  );
}
