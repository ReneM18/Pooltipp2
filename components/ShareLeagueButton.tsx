"use client";

import { useState } from "react";

interface ShareLeagueButtonProps {
  leagueName: string;
  code: string;
}

export default function ShareLeagueButton({ leagueName, code }: ShareLeagueButtonProps) {
  const [copied, setCopied] = useState(false);

  const text = `⚽ Tritt meiner PoolTipp-Tipprunde "${leagueName}" bei!\n\nCode: ${code}\n\nRunter mit der PoolTipp-App, "Private Tipprunden" → "Beitreten" → Code eingeben.`;

  async function handleShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "PoolTipp – Tipprunde beitreten", text });
        return;
      } catch {
        // User hat abgebrochen oder Share nicht verfügbar -> Fallback unten
      }
    }
    // Fallback: direkt WhatsApp-Weblink öffnen
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard evtl. nicht verfügbar (z. B. unsicherer Kontext) – ignorieren
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 rounded-full bg-blue-500 px-3.5 py-1.5 font-display text-xs font-semibold text-pitch transition-colors hover:bg-blue-400"
      >
        <ShareIcon className="h-3.5 w-3.5" />
        Liga-Code teilen
      </button>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded-full border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
        title="Einladungstext kopieren"
      >
        {copied ? "Kopiert ✓" : "Kopieren"}
      </button>
    </div>
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
