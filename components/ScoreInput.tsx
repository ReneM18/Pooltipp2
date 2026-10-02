"use client";

import { useEffect, useState } from "react";

// Eingabefeld für Tore/Punkte. Vorher war es ein <input type="number"> mit
// fest eingetragener 0 – am Handy blieb die 0 beim Tippen stehen: aus "1"
// wurde "01" oder (Cursor vor der 0) sogar "10". Jetzt:
// - Beim Antippen wird der Inhalt markiert, die nächste Ziffer ersetzt ihn.
// - Steht nur eine 0 drin, ersetzt die nächste Ziffer die 0, egal wo der
//   Cursor steht ("0" + "1" -> "1"). Wer 10 will, tippt danach einfach "0".
// - Führende Nullen fallen immer weg, nur Ziffern sind erlaubt.
// - Leer lassen geht beim Tippen; beim Verlassen des Felds wird daraus 0.
//   Mit onClear bleibt das Feld leer (value null): so startet z. B. die
//   Spielkarte ohne vorausgefüllte 0 und niemand tippt versehentlich 0:0.
// type="text" + inputMode="numeric" statt type="number": zeigt am Handy
// trotzdem die Zahlentastatur, aber das Markieren beim Antippen klappt auch
// auf älteren iPhones, und der Wert lässt sich sauber kontrollieren.
export default function ScoreInput({
  value,
  onChange,
  onClear,
  max,
  label,
  disabled = false,
  className,
}: {
  value: number | null;
  onChange: (value: number) => void;
  onClear?: () => void;
  max: number;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));

  // Wert von außen geändert (z. B. "Ändern" füllt den alten Tipp ein).
  useEffect(() => {
    if (value === null) {
      setText("");
      return;
    }
    setText((current) =>
      (current === "" && value === 0) || (current !== "" && Number(current) === value) ? current : String(value)
    );
  }, [value]);

  function handleChange(raw: string) {
    let digits = raw.replace(/\D/g, "");
    // Nur eine 0 im Feld und eine Ziffer dazu getippt: die 0 ersetzen,
    // unabhängig davon, ob davor oder dahinter getippt wurde.
    if (text === "0" && digits.length === 2) {
      digits = digits.replace("0", "");
      if (digits === "") digits = "0";
    }
    digits = digits.replace(/^0+(?=\d)/, "");
    if (digits === "") {
      setText("");
      if (onClear) onClear();
      else onChange(0);
      return;
    }
    const next = Math.min(max, Number(digits));
    setText(String(next));
    onChange(next);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      maxLength={String(max).length + 1}
      value={text}
      placeholder={onClear ? "–" : "0"}
      disabled={disabled}
      aria-label={label}
      onFocus={(e) => e.currentTarget.select()}
      // iOS Safari hebt die Markierung beim Loslassen des Fingers wieder auf –
      // erst danach nochmal markieren.
      onMouseUp={(e) => e.preventDefault()}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        if (text === "" && !onClear) setText("0");
      }}
      className={className}
    />
  );
}
