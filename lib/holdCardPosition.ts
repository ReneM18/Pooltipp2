// Karte nach "Tipp abgeben" / "Ändern" genau dort halten, wo sie beim
// Antippen auf dem Bildschirm stand (Rene, 04.11.2026: "nach dem Tippen
// springen die Tippkarten woanders hin").
//
// Beim Tippen ändert sich auf einen Schlag viel: die Karte wird kleiner oder
// größer, die Handy-Tastatur geht zu (iOS schiebt dabei die Seite), die
// Datenbank antwortet und die Karte rendert noch einmal, über der Karte kann
// sich etwas ändern, und ist die Seite danach kürzer, rutscht der Browser am
// Seitenende nach oben. Statt jede dieser Ursachen einzeln abzufangen, merkt
// sich das hier die Position der Karte im sichtbaren Bereich und stellt sie
// in jedem Bild ohne Animation wieder her – bis alles steht (1,5 Sek.) oder
// der Spieler selbst wischt, tippt, scrollt oder eine Taste drückt.

const HOLD_MS = 1500;
const USER_EVENTS = ["touchstart", "pointerdown", "wheel", "keydown"] as const;

let stopCurrent: (() => void) | null = null;

/** Seite darf nicht kürzer werden als bis zur aktuellen Unterkante des
 *  Bildschirms, sonst springt der Browser am Seitenende nach oben. Die Grenze
 *  sinkt mit, sobald der Spieler nach oben scrollt, und fällt ganz weg, wenn
 *  der Inhalt wieder hoch genug ist. */
let floorListener: (() => void) | null = null;
function holdPageFloor() {
  const root = document.documentElement;
  const update = () => {
    const need = Math.ceil(window.scrollY + window.innerHeight);
    if (document.body.scrollHeight >= need) {
      root.style.minHeight = "";
      if (floorListener) window.removeEventListener("scroll", floorListener);
      floorListener = null;
      return;
    }
    root.style.minHeight = `${need}px`;
  };
  if (!floorListener) {
    floorListener = update;
    window.addEventListener("scroll", floorListener, { passive: true });
  }
  root.style.minHeight = `${Math.ceil(window.scrollY + window.innerHeight)}px`;
}

function viewportTop() {
  return window.visualViewport?.offsetTop ?? 0;
}

/** Vor dem Umschalten der Karte aufrufen (solange sie noch so dasteht, wie
 *  der Spieler sie sieht). Ein neuer Aufruf beendet den vorigen. */
export function holdCardPosition(card: HTMLElement | null): void {
  stopCurrent?.();
  if (!card || typeof window === "undefined") return;
  const anchor = card.getBoundingClientRect().top - viewportTop();
  holdPageFloor();

  let frame = 0;
  const correct = () => {
    if (!card.isConnected) return stop();
    const delta = card.getBoundingClientRect().top - viewportTop() - anchor;
    if (Math.abs(delta) >= 1) {
      holdPageFloor();
      window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
    }
    frame = requestAnimationFrame(correct);
  };
  frame = requestAnimationFrame(correct);

  const viewport = window.visualViewport;
  const onViewport = () => {
    cancelAnimationFrame(frame);
    correct();
  };
  viewport?.addEventListener("resize", onViewport);
  viewport?.addEventListener("scroll", onViewport);
  const timer = window.setTimeout(() => stop(), HOLD_MS);

  function stop() {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    viewport?.removeEventListener("resize", onViewport);
    viewport?.removeEventListener("scroll", onViewport);
    USER_EVENTS.forEach((e) => window.removeEventListener(e, stop, true));
    if (stopCurrent === stop) stopCurrent = null;
  }
  // Erst nach diesem Ereignis (dem Antippen von "Tipp abgeben") auf den
  // Spieler hören, sonst beendet der eigene Klick das Halten sofort.
  window.setTimeout(() => {
    if (stopCurrent !== stop) return;
    USER_EVENTS.forEach((e) => window.addEventListener(e, stop, { capture: true, passive: true }));
  }, 0);
  stopCurrent = stop;
}
