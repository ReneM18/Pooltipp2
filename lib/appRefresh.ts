"use client";

import { useEffect, useRef, useState } from "react";

// Automatisches Aktualisieren: Tipps, Spiele, Kontostand usw. werden sonst
// nur beim Öffnen der App geladen. Am Handy bleibt die Seite aber oft
// stundenlang im Speicher – ein Tipp vom PC tauchte dort erst nach
// komplettem Schließen und Neuöffnen auf.
//
// Darum hier ein gemeinsamer Auslöser für alle Bereiche:
// - "resume": die App kommt wieder in den Vordergrund (Tab/App gewechselt,
//   Handy entsperrt), das Fenster bekommt den Fokus, das Netz ist wieder da
//   oder der Browser holt die Seite aus seinem Zwischenspeicher zurück.
// - "interval": jede Minute, aber nur solange die App sichtbar ist. Davon
//   lassen sich nur die kleinen, wichtigen Abfragen auslösen (eigene Tipps,
//   Spiele, Kontostand), damit Supabase nicht unnötig belastet wird.
// Mehrere Auslöser kurz hintereinander (z. B. Fokus + Sichtbarkeit beim
// Zurückkehren) zählen nur einmal.

export type RefreshReason = "resume" | "interval";
type Listener = { run: (reason: RefreshReason) => unknown; interval: boolean };

const MIN_GAP_MS = 5_000;
const INTERVAL_MS = 60_000;

const listeners = new Set<Listener>();
let installed = false;
let lastRun = 0;

function isVisible() {
  return document.visibilityState === "visible";
}

function trigger(reason: RefreshReason) {
  if (!isVisible()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const now = Date.now();
  if (now - lastRun < MIN_GAP_MS) return;
  lastRun = now;
  listeners.forEach((listener) => {
    if (reason === "interval" && !listener.interval) return;
    try {
      void Promise.resolve(listener.run(reason)).catch((error) =>
        console.warn("Aktualisieren fehlgeschlagen:", error)
      );
    } catch (error) {
      console.warn("Aktualisieren fehlgeschlagen:", error);
    }
  });
}

/**
 * Sofort alles neu laden (Runterwischen, components/PullToRefresh.tsx) –
 * ohne Mindestabstand. Wartet, bis alle Bereiche fertig sind.
 */
export async function refreshNow() {
  lastRun = Date.now();
  await Promise.allSettled(Array.from(listeners, (listener) => Promise.resolve().then(() => listener.run("resume"))));
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // Der erste Start lädt ohnehin alles – nicht gleich doppelt.
  lastRun = Date.now();
  const onResume = () => trigger("resume");
  document.addEventListener("visibilitychange", onResume);
  window.addEventListener("focus", onResume);
  window.addEventListener("online", onResume);
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) onResume();
  });
  window.setInterval(() => trigger("interval"), INTERVAL_MS);
}

/**
 * Ruft `run` auf, wenn die App aktualisieren soll (siehe oben). Mit
 * `interval: true` zusätzlich jede Minute, solange die App sichtbar ist.
 * `run` darf sich bei jedem Rendern ändern; es wird immer die neueste
 * Fassung aufgerufen.
 */
export function useAppRefresh(run: (reason: RefreshReason) => unknown, options?: { interval?: boolean }) {
  const runRef = useRef(run);
  runRef.current = run;
  const interval = options?.interval ?? false;
  useEffect(() => {
    install();
    const listener: Listener = { run: (reason) => runRef.current(reason), interval };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [interval]);
}

/** Zähler, der bei jedem "resume" hochzählt – für Hooks, die ihn als Abhängigkeit nutzen. */
export function useResumeTick() {
  const [tick, setTick] = useState(0);
  useAppRefresh(() => setTick((t) => t + 1));
  return tick;
}
