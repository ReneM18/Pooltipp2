"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShareCardData, drawShareCard } from "@/lib/shareCard";

// Knopf "📤 Teilen" im Ergebnis-Kasten nach einem Treffer. Öffnet eine
// Vorschau; das Bild ist dann schon fertig, damit "Teilen" am Handy direkt
// das Teilen-Menü (WhatsApp usw.) öffnet. Ohne Teilen-Menü (Computer):
// Bild speichern.
export default function ShareTipButton({ data }: { data: ShareCardData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start whitespace-nowrap rounded-full border border-gold/50 px-3 py-1 text-xs font-bold text-gold transition-colors hover:bg-gold/10"
      >
        📤 Teilen
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <ShareImageDialog
            title="Tipp teilen"
            alt="Deine Tipp-Karte"
            fileName="pooltipp-tipp.png"
            shareText={data.exact ? "Volltreffer bei PoolTipp! 🎯" : "Richtig getippt bei PoolTipp! ✅"}
            draw={() => drawShareCard(data)}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

/** Vorschau-Fenster für ein Bild zum Teilen (Tipp-Karte, Tipp-Typ …). */
export function ShareImageDialog({
  title,
  alt,
  fileName,
  shareText,
  draw,
  onClose,
}: {
  title: string;
  alt: string;
  fileName: string;
  shareText: string;
  draw: () => Promise<Blob | null>;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    draw().then((blob) => {
      if (!alive) return;
      if (!blob) {
        setFailed(true);
        return;
      }
      const f = new File([blob], fileName, { type: "image/png" });
      objectUrl = URL.createObjectURL(blob);
      setFile(f);
      setUrl(objectUrl);
      try {
        setCanShare(!!navigator.canShare?.({ files: [f] }));
      } catch {
        setCanShare(false);
      }
    });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Nur einmal beim Öffnen zeichnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function share() {
    if (!file) return;
    try {
      await navigator.share({
        files: [file],
        text: shareText,
      });
    } catch {
      /* abgebrochen – nichts tun */
    }
  }

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-edge bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        <div className="aspect-square w-full overflow-hidden rounded-xl border border-edge bg-pitch">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              {failed ? "Das Bild konnte nicht erstellt werden." : "Bild wird erstellt…"}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canShare && (
            <button
              type="button"
              onClick={share}
              className="flex-1 whitespace-nowrap rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch hover:bg-action-hover"
            >
              📤 Teilen
            </button>
          )}
          <button
            type="button"
            onClick={download}
            disabled={!url}
            className={`flex-1 whitespace-nowrap rounded-full px-4 py-2 font-display text-sm font-semibold ${
              canShare ? "border border-edge text-ink hover:bg-pitch" : "bg-action text-pitch hover:bg-action-hover"
            } disabled:opacity-50`}
          >
            ⬇️ Bild speichern
          </button>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
          Schließen
        </button>
      </div>
    </div>
  );
}
