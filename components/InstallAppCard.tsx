"use client";

import { useState } from "react";
import InstallAppSteps from "./InstallAppSteps";
import { useInstallApp } from "@/lib/installApp";

// Profil → Einstellungen → App: "PoolTipp als App" zum Nachschlagen, auch
// wenn der Hinweis unten (components/InstallHint.tsx) weggeklickt wurde.
export default function InstallAppCard({ className = "" }: { className?: string }) {
  const { ready, platform, standalone, canPrompt, promptInstall } = useInstallApp();
  const [open, setOpen] = useState(false);

  if (!ready) return null;

  if (standalone) {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4 ${className}`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">📲 PoolTipp als App</p>
          <p className="text-xs text-muted">Du nutzt PoolTipp schon als App.</p>
        </div>
        <span className="shrink-0 rounded-full border border-gold/50 px-3 py-1 text-xs font-semibold text-gold">✓ aktiv</span>
      </div>
    );
  }

  return (
    <div className={`rounded-card border border-edge bg-surface p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">📲 PoolTipp als App</p>
          <p className="text-xs text-muted">Auf den Home-Bildschirm legen: eigenes Symbol, ohne Browserleiste.</p>
        </div>
        <button
          type="button"
          onClick={canPrompt ? () => void promptInstall() : () => setOpen((o) => !o)}
          aria-expanded={canPrompt ? undefined : open}
          className="shrink-0 rounded-full border border-gold/50 px-4 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
        >
          {canPrompt ? "Installieren" : open ? "Schließen" : "So geht's"}
        </button>
      </div>
      {open && !canPrompt && (
        <div className="mt-4 border-t border-edge pt-4">
          <InstallAppSteps platform={platform} />
        </div>
      )}
    </div>
  );
}
