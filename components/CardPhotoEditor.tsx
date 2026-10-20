"use client";

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";

// Kartenfoto der Sportlerkarte bearbeiten (Rene, 20.10.2026): Foto wählen
// (Profilfotos oder neu hochladen), Ausschnitt verschieben und zoomen.
// Ergebnis ist ein quadratisches JPEG (400 px) als data-URL, das im
// Steckbrief gespeichert wird (lib/sportBio.ts, data.photo).
const OUT = 400;
const VIEW = 220;

export default function CardPhotoEditor({
  current,
  profilePhotos,
  onSave,
  onReset,
}: {
  current?: string;
  profilePhotos: string[];
  onSave: (dataUrl: string) => void;
  onReset: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // Verschiebung in Pixeln der Ansicht
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return setImg(null);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    image.onerror = () => setError("Dieses Bild konnte nicht geöffnet werden.");
    image.src = src;
  }, [src]);

  // Grundgröße: Bild füllt das Quadrat (kürzere Seite = Ansicht).
  const base = img ? VIEW / Math.min(img.width, img.height) : 1;
  const w = img ? img.width * base * zoom : VIEW;
  const h = img ? img.height * base * zoom : VIEW;
  // Nicht weiter schieben, als das Bild reicht.
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min((w - VIEW) / 2, Math.max(-(w - VIEW) / 2, p.x)),
    y: Math.min((h - VIEW) / 2, Math.max(-(h - VIEW) / 2, p.y)),
  });
  const shown = clamp(pos);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: shown.x, py: shown.y };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setSrc(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setError("Dieses Bild konnte nicht geöffnet werden.");
    reader.readAsDataURL(file);
  }

  function save() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const f = OUT / VIEW;
    ctx.drawImage(img, (VIEW / 2 - w / 2 + shown.x) * f, (VIEW / 2 - h / 2 + shown.y) * f, w * f, h * f);
    try {
      onSave(canvas.toDataURL("image/jpeg", 0.82));
      setSrc(null);
    } catch {
      setError("Dieses Bild kann nicht verwendet werden. Lade es bitte neu hoch.");
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {profilePhotos.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSrc(p)}
            aria-label={`Profilfoto ${i + 1} wählen`}
            className={`h-12 w-12 overflow-hidden rounded-full ring-2 ${src === p ? "ring-gold" : "ring-edge hover:ring-gold/60"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
        <label className="flex h-12 cursor-pointer items-center rounded-full border border-dashed border-edge px-4 text-xs font-semibold text-muted hover:border-gold hover:text-gold">
          + Foto hochladen
          <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
        </label>
        {current && !src && (
          <button type="button" onClick={onReset} className="text-xs text-muted hover:text-ink">
            Zurück zum Profilbild
          </button>
        )}
      </div>
      {!src && (
        <p className="text-[11px] text-muted">
          {current ? "Dein Kartenfoto ist gesetzt." : "Ohne eigenes Kartenfoto zeigt die Karte dein Profilbild."} Wähle ein Foto, um den Ausschnitt anzupassen.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {img && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-full ring-4 ring-gold/70 active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src ?? ""}
              alt="Ausschnitt"
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ width: w, height: h, left: VIEW / 2 - w / 2 + shown.x, top: VIEW / 2 - h / 2 + shown.y }}
            />
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <p className="text-xs text-muted">Bild verschieben zum Ausrichten.</p>
            <label className="flex items-center gap-2 text-xs text-muted">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[rgb(var(--c-gold))]"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={save} className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-pitch hover:bg-action-hover">
                Für die Karte übernehmen
              </button>
              <button type="button" onClick={() => setSrc(null)} className="rounded-full border border-edge px-4 py-2 text-sm text-muted hover:text-ink">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
