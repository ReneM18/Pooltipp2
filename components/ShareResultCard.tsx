"use client";

import { useRef, useState } from "react";

interface ShareResultCardProps {
  leagueName: string;
  leaderboard: [string, number][];
  currentUser: string;
}

// Zeichnet die Top-5 der Liga als hübsche, teilbare Bild-Karte (Canvas) –
// ähnlich einem "Spotify Wrapped"-Recap-Bild. Läuft komplett im Browser,
// braucht kein Backend und keine externe Bild-Library.
export default function ShareResultCard({ leagueName, leaderboard, currentUser }: ShareResultCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function draw(): HTMLCanvasElement {
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    const W = 800;
    const H = 1000;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    // Hintergrund
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#172420");
    bg.addColorStop(1, "#0D1512");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Kopfzeile
    ctx.fillStyle = "#F3F1EA";
    ctx.font = "bold 44px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Pool", W / 2 - 58, 110);
    ctx.fillStyle = "#E8B34C";
    ctx.fillText("Tipp", W / 2 + 60, 110);

    ctx.fillStyle = "#8B9890";
    ctx.font = "24px Arial";
    ctx.fillText(leagueName, W / 2, 155);

    ctx.strokeStyle = "#24332C";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 190);
    ctx.lineTo(W - 60, 190);
    ctx.stroke();

    // Top 5
    const top = leaderboard.slice(0, 5);
    const rowH = 100;
    let y = 240;
    const medals = ["🥇", "🥈", "🥉"];

    top.forEach(([name, pts], i) => {
      const isMe = name === currentUser;
      if (isMe) {
        ctx.fillStyle = "rgba(232,179,76,0.12)";
        ctx.beginPath();
        ctx.roundRect(50, y - 46, W - 100, 76, 14);
        ctx.fill();
      }

      ctx.textAlign = "left";
      ctx.font = "36px Arial";
      ctx.fillStyle = "#F3F1EA";
      ctx.fillText(medals[i] ?? `${i + 1}.`, 75, y);

      ctx.font = isMe ? "bold 30px Arial" : "30px Arial";
      ctx.fillStyle = isMe ? "#E8B34C" : "#F3F1EA";
      ctx.fillText(name + (isMe ? "  (Du)" : ""), 150, y);

      ctx.textAlign = "right";
      ctx.font = "bold 30px Arial";
      ctx.fillStyle = "#3FA66B";
      ctx.fillText(`${pts} Pkt`, W - 75, y);

      y += rowH;
    });

    // Footer
    ctx.textAlign = "center";
    ctx.font = "20px Arial";
    ctx.fillStyle = "#8B9890";
    ctx.fillText("Tritt meiner Tipprunde bei – nur mit PoolTipp", W / 2, H - 60);

    return canvas;
  }

  function handlePreview() {
    const canvas = draw();
    setPreviewUrl(canvas.toDataURL("image/png"));
  }

  async function handleShareOrDownload() {
    setBusy(true);
    try {
      const canvas = draw();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setBusy(false);
          return;
        }
        const file = new File([blob], "pooltipp-ergebnis.png", { type: "image/png" });

        if (
          typeof navigator !== "undefined" &&
          "share" in navigator &&
          "canShare" in navigator &&
          navigator.canShare?.({ files: [file] })
        ) {
          try {
            await navigator.share({ files: [file], title: "PoolTipp Ergebnis" });
            setBusy(false);
            return;
          } catch {
            // abgebrochen -> Download-Fallback unten
          }
        }

        // Fallback: Bild herunterladen
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "pooltipp-ergebnis.png";
        a.click();
        URL.revokeObjectURL(url);
        setBusy(false);
      }, "image/png");
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handlePreview}
          className="flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Vorschau
        </button>
        <button
          onClick={handleShareOrDownload}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 font-display text-xs font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
        >
          <ShareIcon className="h-3.5 w-3.5" />
          {busy ? "Wird erstellt…" : "Ergebnis teilen"}
        </button>
      </div>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Vorschau des Ergebnis-Bildes"
          className="w-full max-w-xs rounded-card border border-edge"
        />
      )}
    </div>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5.5-5.5L9 17" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9" />
    </svg>
  );
}
