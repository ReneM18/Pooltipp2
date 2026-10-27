// Tipp-Karte zum Teilen (Rene, 12.10.2026, Entwurf A "Glow"): nach einem
// Treffer ein quadratisches Bild (1080 × 1080, passt für WhatsApp) direkt im
// Browser zeichnen. Kein Server, keine Datenbank, kostet und bringt nichts.

import { emojiImage } from "@/components/Emoji";

export interface ShareCardData {
  exact: boolean;
  playerName: string;
  // Schon in Anzeige-Reihenfolge (US-Sport: Gast links).
  leftName: string;
  rightName: string;
  scoreText: string;
  // "Mein Tipp: …" – leer lassen, wenn er gleich dem Endstand ist.
  tipText: string | null;
  metaText: string;
  rangDelta: number;
}

const SIZE = 1080;
const GOLD = "#EDB94A";
const INK = "#F3F1EA";
const MUTED = "#8B9890";

// Emoji-Schrift wie in der App (app/globals.css --emoji-stack): auf
// Apple-Geräten leer (dort zeichnet das System), sonst Google "Noto".
function emojiStack(): string {
  if (typeof document === "undefined") return "";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--emoji-stack").trim();
  return v && v !== "sans-serif" ? v : "";
}

function cssFont(variable: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.body).getPropertyValue(variable).trim();
  const emoji = emojiStack();
  return [v, emoji, fallback].filter(Boolean).join(", ");
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Schriftgröße so weit verkleinern, bis der Text in die Breite passt.
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, min: number, maxWidth: number) {
  let px = start;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
  return px;
}

// roundRect fehlt in älteren Browsern – dann eben eckig.
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export async function drawShareCard(d: ShareCardData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await document.fonts?.ready;
    // Die Emoji-Schrift lädt der Browser erst bei Bedarf – fürs Bild vorher holen.
    const emoji = emojiStack();
    if (emoji) await document.fonts.load(`40px ${emoji}`, "🎯✅");
  } catch {
    /* egal, dann eben Ersatzschrift */
  }
  const poppins = cssFont("--font-poppins", "Arial, sans-serif");
  const inter = cssFont("--font-inter", "Arial, sans-serif");
  const rajdhani = cssFont("--font-rajdhani", "Arial, sans-serif");
  const W = SIZE - 140;
  const cx = SIZE / 2;

  // Hintergrund wie das App-Icon.
  const bg = ctx.createRadialGradient(cx, 420, 0, cx, 420, 820);
  bg.addColorStop(0, "#21382F");
  bg.addColorStop(1, "#0A110E");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(237,185,74,0.35)";
  ctx.lineWidth = 4;
  rounded(ctx, 28, 28, SIZE - 56, SIZE - 56, 44);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Logo: Symbol + Schriftzug, zusammen mittig.
  const logo = await loadImage("/marke/pooltipp-symbol.svg");
  ctx.font = `700 64px ${rajdhani}`;
  const word = "PoolTipp";
  const wordW = ctx.measureText(word).width;
  const icon = 76;
  const gap = 18;
  const startX = cx - (icon + gap + wordW) / 2;
  if (logo) {
    ctx.save();
    rounded(ctx, startX, 82, icon, icon, 18);
    ctx.clip();
    ctx.drawImage(logo, startX, 82, icon, icon);
    ctx.restore();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText(word, logo ? startX + icon + gap : cx - wordW / 2, 142);
  ctx.textAlign = "center";

  // Überschrift mit goldenem Leuchten.
  const headline = d.exact ? "🎯 VOLLTREFFER!" : "✅ RICHTIG GETIPPT!";
  fit(ctx, headline, (px) => `700 ${px}px ${poppins}`, 96, 56, W);
  const gold = ctx.createLinearGradient(0, 230, 0, 320);
  gold.addColorStop(0, "#FFE7A3");
  gold.addColorStop(1, GOLD);
  ctx.save();
  ctx.shadowColor = "rgba(237,185,74,0.6)";
  ctx.shadowBlur = 44;
  ctx.fillStyle = gold;
  ctx.fillText(headline, cx, 318);
  ctx.restore();

  const sub = `${d.playerName} hat ${d.exact ? "exakt" : "richtig"} getippt`;
  fit(ctx, sub, (px) => `500 ${px}px ${inter}`, 40, 26, W);
  ctx.fillStyle = MUTED;
  ctx.fillText(sub, cx, 384);

  // Teams: eine Zeile, bei sehr langen Namen zwei Zeilen.
  const teams = `${d.leftName} – ${d.rightName}`;
  ctx.fillStyle = INK;
  const px = fit(ctx, teams, (p) => `600 ${p}px ${poppins}`, 52, 38, W);
  if (ctx.measureText(teams).width <= W && px >= 38) {
    ctx.fillText(teams, cx, 528);
  } else {
    fit(ctx, d.leftName, (p) => `600 ${p}px ${poppins}`, 46, 26, W);
    ctx.fillText(`${d.leftName} –`, cx, 498);
    fit(ctx, d.rightName, (p) => `600 ${p}px ${poppins}`, 46, 26, W);
    ctx.fillText(d.rightName, cx, 554);
  }

  ctx.font = `700 196px ${poppins}`;
  ctx.fillText(d.scoreText.replace(":", " : "), cx, 750);

  fit(ctx, d.metaText, (p) => `500 ${p}px ${inter}`, 36, 24, W);
  ctx.fillStyle = MUTED;
  ctx.fillText(d.metaText, cx, 820);

  if (d.tipText) {
    fit(ctx, d.tipText, (p) => `600 ${p}px ${inter}`, 38, 24, W);
    ctx.fillStyle = INK;
    ctx.fillText(d.tipText, cx, 888);
  }

  if (d.rangDelta > 0) {
    ctx.font = `700 54px ${poppins}`;
    ctx.fillStyle = GOLD;
    ctx.fillText(`+${d.rangDelta} Punkte`, cx, 990);
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

// ---------------------------------------------------------------------------
// Tipp-Typ zum Teilen (Rene, 13.10.2026): gleicher Stil wie die Tipp-Karte.
// ---------------------------------------------------------------------------

export interface TypeCardTrait {
  emoji: string;
  name: string;
}

export interface TypeCardData {
  playerName: string;
  main: TypeCardTrait & { text: string };
  traits: TypeCardTrait[];
  evaluated: number;
}

// Emoji zeichnen: auf Apple das echte Emoji, sonst dasselbe Bild wie in der App.
async function drawEmoji(ctx: CanvasRenderingContext2D, e: string, x: number, baseline: number, size: number, font: string) {
  const useImage = typeof document !== "undefined" && document.documentElement.getAttribute("data-emoji") === "noto";
  if (useImage) {
    const info = emojiImage(e);
    const img = info ? await loadImage(info.src) : null;
    if (img) {
      const box = size * 1.05;
      ctx.drawImage(img, x - box / 2, baseline - box * 0.86, box, box);
      return;
    }
  }
  ctx.font = `${size}px ${font}`;
  ctx.fillText(e, x, baseline);
}

export async function drawTypeCard(d: TypeCardData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    await document.fonts?.ready;
    const emoji = emojiStack();
    if (emoji) await document.fonts.load(`40px ${emoji}`, d.main.emoji + d.traits.map((t) => t.emoji).join(""));
  } catch {
    /* egal, dann eben Ersatzschrift */
  }
  const poppins = cssFont("--font-poppins", "Arial, sans-serif");
  const inter = cssFont("--font-inter", "Arial, sans-serif");
  const rajdhani = cssFont("--font-rajdhani", "Arial, sans-serif");
  const W = SIZE - 140;
  const cx = SIZE / 2;

  const bg = ctx.createRadialGradient(cx, 420, 0, cx, 420, 820);
  bg.addColorStop(0, "#21382F");
  bg.addColorStop(1, "#0A110E");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(237,185,74,0.35)";
  ctx.lineWidth = 4;
  rounded(ctx, 28, 28, SIZE - 56, SIZE - 56, 44);
  ctx.stroke();
  ctx.textBaseline = "alphabetic";

  // Logo wie bei der Tipp-Karte.
  const logo = await loadImage("/marke/pooltipp-symbol.svg");
  ctx.font = `700 56px ${rajdhani}`;
  const word = "PoolTipp";
  const wordW = ctx.measureText(word).width;
  const icon = 64;
  const gap = 16;
  const startX = cx - (icon + gap + wordW) / 2;
  if (logo) {
    ctx.save();
    rounded(ctx, startX, 76, icon, icon, 16);
    ctx.clip();
    ctx.drawImage(logo, startX, 76, icon, icon);
    ctx.restore();
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.fillText(word, logo ? startX + icon + gap : cx - wordW / 2, 128);
  ctx.textAlign = "center";

  const head = `Tipp-Typ von ${d.playerName}`;
  fit(ctx, head, (px) => `600 ${px}px ${inter}`, 40, 26, W);
  ctx.fillStyle = MUTED;
  ctx.fillText(head, cx, 206);

  // Großes Emoji + Name mit goldenem Leuchten.
  ctx.fillStyle = INK;
  await drawEmoji(ctx, d.main.emoji, cx, 400, 170, emojiStack() || poppins);

  fit(ctx, d.main.name, (px) => `700 ${px}px ${poppins}`, 92, 50, W);
  const gold = ctx.createLinearGradient(0, 450, 0, 530);
  gold.addColorStop(0, "#FFE7A3");
  gold.addColorStop(1, GOLD);
  ctx.save();
  ctx.shadowColor = "rgba(237,185,74,0.6)";
  ctx.shadowBlur = 44;
  ctx.fillStyle = gold;
  ctx.fillText(d.main.name, cx, 522);
  ctx.restore();

  // Erklärsatz, bei Bedarf auf zwei Zeilen.
  ctx.fillStyle = INK;
  ctx.font = `500 36px ${inter}`;
  const words = d.main.text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > W && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, 606 + i * 46));

  // Eigenschaften als Pillen untereinander (höchstens 3), jeweils mittig.
  const pills = d.traits.slice(0, 3);
  const pillH = 70;
  const pillGap = 14;
  const em = 38;
  let y = 694 - (3 - pills.length) * ((pillH + pillGap) / 2);
  for (const pill of pills) {
    const px = fit(ctx, pill.name, (p) => `600 ${p}px ${inter}`, 34, 22, W - em - 90);
    ctx.font = `600 ${px}px ${inter}`;
    const textW = ctx.measureText(pill.name).width;
    const pillW = Math.min(W, em + 14 + textW + 72);
    const x = cx - pillW / 2;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rounded(ctx, x, y, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(237,185,74,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const left = x + 36;
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    await drawEmoji(ctx, pill.emoji, left + em / 2, y + 49, em, emojiStack() || inter);
    ctx.font = `600 ${px}px ${inter}`;
    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.fillText(pill.name, left + em + 14, y + 47);
    ctx.textAlign = "center";
    y += pillH + pillGap;
  }

  ctx.font = `500 30px ${inter}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(`Aus ${d.evaluated.toLocaleString("de-DE")} ausgewerteten Tipps · Und du? PoolTipp`, cx, 1006);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
