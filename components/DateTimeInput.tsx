"use client";

import { useEffect, useRef, useState, KeyboardEvent, ClipboardEvent } from "react";

// Eigene Eingabe für Datum + Uhrzeit (Tag, Monat, Jahr, Stunde, Minute) statt
// <input type="datetime-local">: Safari zeigt dort im leeren Feld das heutige
// Datum grau als Vorschlag, das aber gar nicht eingetragen ist – dann kam
// "Ungültiger Wert" oder das Spiel ließ sich nicht anlegen. Hier ist das, was
// man sieht, immer genau das, was gespeichert wird.
//
// Bedienung: Ziffern tippen, nach 2 Stellen (Jahr: 4) springt der Cursor
// automatisch ins nächste Feld. Punkt/Doppelpunkt/Leerzeichen springt auch
// weiter, Rücktaste im leeren Feld zurück. Ist Tag + Monat eingetragen und das
// Jahr leer, wird das aktuelle Jahr eingesetzt (markiert, Weitertippen
// überschreibt es).
//
// Mit `defaultToday` steht im leeren Feld schon das heutige Datum wirklich
// drin (nicht nur als grauer Vorschlag), man tippt nur noch die Uhrzeit. Nach
// der Stunde wird ":00" eingesetzt (markiert, Weitertippen überschreibt es),
// "20" reicht also für 20:00 Uhr (Rene, 09.10.2026).
//
// value/onChange im Format "YYYY-MM-DDTHH:MM" (lokale Zeit) – wie vorher beim
// datetime-local-Feld. Solange etwas fehlt oder ungültig ist, kommt "".

type Parts = { d: string; m: string; y: string; h: string; min: string };
type Key = keyof Parts;

const ORDER: Key[] = ["d", "m", "y", "h", "min"];
const MAX_LEN: Record<Key, number> = { d: 2, m: 2, y: 4, h: 2, min: 2 };
const PLACEHOLDER: Record<Key, string> = { d: "TT", m: "MM", y: "JJJJ", h: "hh", min: "mm" };
const LABEL: Record<Key, string> = { d: "Tag", m: "Monat", y: "Jahr", h: "Stunde", min: "Minute" };
const EMPTY: Parts = { d: "", m: "", y: "", h: "", min: "" };

function partsFromValue(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return EMPTY;
  return { y: match[1], m: match[2], d: match[3], h: match[4], min: match[5] };
}

const pad = (s: string) => s.padStart(2, "0");

function todayParts(): Parts {
  const now = new Date();
  return {
    d: pad(String(now.getDate())),
    m: pad(String(now.getMonth() + 1)),
    y: String(now.getFullYear()),
    h: "",
    min: "",
  };
}

function startParts(value: string, defaultToday: boolean): Parts {
  const p = partsFromValue(value);
  return defaultToday && p === EMPTY ? todayParts() : p;
}

// Fertiger Wert, oder "" wenn noch etwas fehlt / nicht stimmt.
function valueFromParts(p: Parts): string {
  if (!p.d || !p.m || p.y.length !== 4 || !p.h || !p.min) return "";
  const day = Number(p.d);
  const month = Number(p.m);
  const year = Number(p.y);
  const hour = Number(p.h);
  const minute = Number(p.min);
  if (hour > 23 || minute > 59 || month < 1 || month > 12 || day < 1) return "";
  // 31.02. o. ä. abfangen
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return "";
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

function problemText(p: Parts): string | null {
  const filled = ORDER.filter((k) => p[k] !== "");
  if (filled.length === 0 || valueFromParts(p)) return null;
  if (filled.length < ORDER.length || p.y.length !== 4) {
    const missing = ORDER.filter((k) => p[k] === "" || (k === "y" && p.y.length !== 4)).map((k) => LABEL[k]);
    return `Es fehlt noch: ${missing.join(", ")}.`;
  }
  if (Number(p.h) > 23 || Number(p.min) > 59) return "Diese Uhrzeit gibt es nicht.";
  return "Dieses Datum gibt es nicht.";
}

export default function DateTimeInput({
  value,
  onChange,
  compact = false,
  ariaLabel,
  defaultToday = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  ariaLabel?: string;
  defaultToday?: boolean;
}) {
  const [parts, setParts] = useState<Parts>(() => startParts(value, defaultToday));
  // Zuletzt selbst gemeldeter Wert: kommt von außen ein anderer (Knopf
  // "Heute", Tippschluss folgt dem Anpfiff …), werden die Felder neu gefüllt.
  const lastEmitted = useRef(value);
  const refs = useRef<Partial<Record<Key, HTMLInputElement | null>>>({});
  // Feld gerade angesprungen/angetippt: die nächste Ziffer ersetzt den alten
  // Inhalt (auch wenn die Markierung beim schnellen Tippen verloren ging).
  const fresh = useRef<Partial<Record<Key, boolean>>>({});
  // Hinweis "fehlt noch" erst zeigen, wenn man das Feld verlassen hat –
  // nicht schon beim Tippen.
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setParts(startParts(value, defaultToday));
    }
  }, [value]);

  function commit(next: Parts) {
    setParts(next);
    const v = valueFromParts(next);
    if (v !== lastEmitted.current) {
      lastEmitted.current = v;
      onChange(v);
    }
  }

  function focusField(key: Key | undefined) {
    if (!key) return;
    const el = refs.current[key];
    if (el) {
      fresh.current[key] = true;
      el.focus();
      el.select();
    }
  }

  function nextOf(key: Key) {
    return ORDER[ORDER.indexOf(key) + 1];
  }

  function handleInput(key: Key, raw: string, replace = false) {
    const old = replace ? "" : parts[key];
    let digits = raw.replace(/\D/g, "");
    if (!replace && fresh.current[key]) {
      fresh.current[key] = false;
      // alter Inhalt + neue Ziffer -> nur die neue Ziffer behalten
      if (old && digits.startsWith(old) && digits.length > old.length) digits = digits.slice(old.length);
    } else if (digits.length > MAX_LEN[key]) {
      // in ein volles Feld weitergetippt: neu anfangen mit den neuen Ziffern
      digits = digits.slice(old.length);
    }
    digits = digits.slice(0, MAX_LEN[key]);
    const next = { ...parts, [key]: digits };
    // Tag + Monat fertig, Jahr leer: aktuelles Jahr einsetzen
    if (key === "m" && digits.length === 2 && !next.y) next.y = String(new Date().getFullYear());
    // Stunde fertig, Minuten leer: ":00" einsetzen ("20" = 20:00 Uhr)
    if (key === "h" && digits.length === 2 && !next.min) next.min = "00";
    commit(next);
    if (digits.length === MAX_LEN[key]) {
      // Ins nächste Feld; ein schon eingesetztes Jahr ist dort markiert und
      // wird beim Weitertippen einfach überschrieben.
      focusField(nextOf(key));
    }
  }

  function handleKeyDown(key: Key, e: KeyboardEvent<HTMLInputElement>) {
    // Erste Ziffer in einem gerade angesprungenen Feld ersetzt den alten Inhalt
    if (/^\d$/.test(e.key) && fresh.current[key]) {
      e.preventDefault();
      fresh.current[key] = false;
      // Markierung aufheben, damit die nächste Ziffer angehängt wird
      e.currentTarget.setSelectionRange(1, 1);
      handleInput(key, e.key, true);
      return;
    }
    if ([".", ",", ":", " ", "/", "-"].includes(e.key)) {
      e.preventDefault();
      // einstellige Eingabe ("4") beim Weiterspringen auf "04" ergänzen
      if (parts[key].length === 1 && key !== "y") commit({ ...parts, [key]: pad(parts[key]) });
      focusField(nextOf(key));
    } else if (e.key === "Backspace" && parts[key] === "") {
      e.preventDefault();
      focusField(ORDER[ORDER.indexOf(key) - 1]);
    } else if (e.key === "ArrowRight" && e.currentTarget.selectionStart === parts[key].length) {
      focusField(nextOf(key));
    } else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) {
      focusField(ORDER[ORDER.indexOf(key) - 1]);
    }
  }

  // Eingefügtes "04.10.2026 22:25" (oder "2026-10-04T22:25") auf alle Felder verteilen
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})[,\s]+(\d{1,2}):(\d{2})$/.exec(text);
    let next: Parts | null = m ? { d: pad(m[1]), m: pad(m[2]), y: m[3], h: pad(m[4]), min: m[5] } : null;
    if (!next) {
      m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(text);
      if (m) next = { y: m[1], m: m[2], d: m[3], h: m[4], min: m[5] };
    }
    if (next) {
      e.preventDefault();
      commit(next);
    }
  }

  const problem = focused ? null : problemText(parts);
  const box = compact ? "px-2 py-1.5 text-sm" : "px-3 py-2.5 text-base";

  return (
    <div>
      <div
        role="group"
        aria-label={ariaLabel}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
        onClick={(e) => {
          // Klick in den Rahmen (nicht in ein Feld): erstes leeres Feld
          // (bei vorausgefülltem Datum also gleich die Stunde)
          if (e.target === e.currentTarget) focusField(ORDER.find((k) => !parts[k]) ?? "d");
        }}
        className={`flex w-full cursor-text flex-wrap items-center rounded-lg border bg-pitch text-ink focus-within:border-gold ${box} ${
          problem ? "border-red-400" : "border-edge"
        }`}
      >
        {ORDER.map((key) => (
          <span key={key} className="flex items-center">
            <input
              ref={(el) => {
                refs.current[key] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label={LABEL[key]}
              placeholder={PLACEHOLDER[key]}
              value={parts[key]}
              onChange={(e) => handleInput(key, e.target.value)}
              onKeyDown={(e) => handleKeyDown(key, e)}
              onFocus={(e) => {
                fresh.current[key] = true;
                e.currentTarget.select();
              }}
              // Klick soll die Markierung nicht gleich wieder aufheben
              onMouseUp={(e) => {
                if (fresh.current[key]) e.preventDefault();
              }}
              onPaste={handlePaste}
              style={{ width: `${MAX_LEN[key] + 0.6}ch` }}
              className="bg-transparent p-0 text-center tabular-nums outline-none placeholder:text-muted/60"
            />
            {key === "d" || key === "m" ? (
              <span className="text-muted">.</span>
            ) : key === "y" ? (
              <span className="mx-2 text-muted">um</span>
            ) : key === "h" ? (
              <span className="text-muted">:</span>
            ) : (
              <span className="ml-1 text-muted">Uhr</span>
            )}
          </span>
        ))}
      </div>
      {problem && (
        <p role="alert" className="mt-1 text-sm text-red-300">
          {problem}
        </p>
      )}
    </div>
  );
}
