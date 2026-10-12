import { Fragment, ReactNode } from "react";
import { EMOJI_FILES, FLAG_CODES } from "@/lib/emojiFiles";

// Emojis (Rene, 12.10.2026): Auf Apple-Geräten bleibt das echte Apple-Emoji.
// Alle anderen Geräte (v. a. Windows, dort sehen Emojis "wie vom
// Kindergarten" aus und Flaggen sind nur Buchstaben) bekommen dasselbe
// Symbol als Bild: Microsoft Fluent Emoji 3D bzw. echte Flaggen.
// Beides wird immer ausgegeben, welches man sieht, entscheidet nur CSS
// (html[data-emoji="noto"] in app/globals.css, gesetzt in app/layout.tsx).
// Die Bilder laden "lazy": Apple-Geräte laden sie gar nicht herunter.
// Bilder neu erzeugen: Liste in lib/emojiFiles.ts (automatisch erzeugt).

const strip = (s: string) => s.replace(/\uFE0F/g, "");

/** Bild-Datei zu einem Emoji (oder null, wenn es keins gibt). */
export function emojiImage(emoji: string): { src: string; flag: boolean } | null {
  const e = strip(emoji);
  const flag = flagCode(e);
  if (flag) return FLAG_CODES.has(flag) ? { src: `/emoji/flaggen/${flag}.svg`, flag: true } : null;
  const file = EMOJI_FILES[e];
  return file ? { src: `/emoji/${file}`, flag: false } : null;
}

// 🇩🇪 -> "de", 🏴 + Tag-Zeichen (England usw.) -> "gb-eng"
function flagCode(e: string): string | null {
  const cps = Array.from(e).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length === 2 && cps.every((c) => c >= 0x1f1e6 && c <= 0x1f1ff)) {
    return cps.map((c) => String.fromCharCode(c - 0x1f1e6 + 97)).join("");
  }
  if (cps[0] === 0x1f3f4 && cps.length > 2 && cps[cps.length - 1] === 0xe007f) {
    const tag = cps
      .slice(1, -1)
      .map((c) => String.fromCharCode(c - 0xe0000))
      .join("");
    if (tag.length > 2) return `${tag.slice(0, 2)}-${tag.slice(2)}`;
  }
  return null;
}

/** Ein einzelnes Emoji. Ohne passendes Bild bleibt es einfach Text. */
export default function Emoji({ e, label }: { e: string | null | undefined; label?: string }) {
  if (!e) return null;
  const img = emojiImage(e);
  if (!img) return <>{e}</>;
  return (
    <span className="emoji-swap" role={label ? "img" : undefined} aria-label={label}>
      <span className="emoji-native" aria-hidden={label ? true : undefined}>
        {e}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={img.flag ? "emoji-img emoji-flag" : "emoji-img"}
        src={img.src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

/**
 * Dasselbe innerhalb einer SVG-Grafik (statt <text>{emoji}</text>): x/y wie
 * beim <text> (Mitte, Grundlinie), size = Schriftgröße.
 */
export function SvgEmoji({ e, x, y, size }: { e: string; x: number; y: number; size: number }) {
  const img = emojiImage(e);
  const text = (
    <text className="emoji-native" x={x} y={y} textAnchor="middle" fontSize={size}>
      {e}
    </text>
  );
  if (!img) return text;
  const box = size * 1.05;
  return (
    <g className="emoji-swap-svg">
      {text}
      <image className="emoji-img" href={img.src} x={x - box / 2} y={y - box * 0.86} width={box} height={box} />
    </g>
  );
}

// Emojis in einem Text finden: Flaggen (zwei Regionalbuchstaben bzw. 🏴+Tags),
// Verbindungen mit ZWJ und einzelne Bildzeichen.
const EMOJI_RE =
  /(?:[\u{1F1E6}-\u{1F1FF}]{2})|(?:\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F})|(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2194}-\u{21FF}\u{23E9}-\u{23FA}\u{231A}\u{231B}]\uFE0F?(?:\u200D[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?)*)/gu;

/** Text, in dem alle bekannten Emojis wie oben ausgetauscht werden. */
export function EmojiText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(<Emoji key={i} e={m[0]} />);
    last = i + m[0].length;
  }
  if (last === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
