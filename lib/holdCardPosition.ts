// Karte nach "Tipp abgeben" / "Ändern" genau dort halten, wo sie beim
// Antippen auf dem Bildschirm stand (Rene, 04.11. und 05.11.2026: "einfach
// wenn man tippt bei der Partie lassen").
//
// Beim und nach dem Tippen verschiebt sich viel: die Karte wird kleiner oder
// größer, die Handy-Tastatur geht zu (iOS schiebt dabei die Seite), die
// Datenbank antwortet und die Karte rendert noch einmal, Tipp-Zahlen,
// Live-Stände (alle 15 Sek.), die Live-Leiste oben oder ein Spiel, dessen
// Tippschluss vorbei ist, ändern die Höhe darüber, und ist die Seite danach
// kürzer, rutscht der Browser am Seitenende nach oben. Das kann auch noch
// Sekunden später kommen. Darum merkt sich das hier die Position der Karte im
// sichtbaren Bereich und stellt sie in jedem Bild ohne Animation wieder her –
// so lange, bis der Spieler selbst scrollt (Wischen, Mausrad, Bild-Tasten),
// in ein Eingabefeld tippt oder etwas außerhalb der Karte antippt (anderes
// Spiel, Reiter, Logo …). Vorher hörte das nach 1,5 Sek. auf, alles danach
// verschob die Seite wieder.

const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

let stopCurrent: (() => void) | null = null;

/** Hält gerade eine Karte nach "Tipp abgeben" fest? */
export function isHoldingCard() {
  return stopCurrent !== null;
}

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

  // Spieler scrollt selbst: loslassen.
  const onKey = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key) && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) stop();
  };
  // Antippen außerhalb der Karte (anderes Spiel, Reiter, Logo, Bildlaufleiste)
  // oder ein Eingabefeld: loslassen, damit die Seite dort ganz normal reagiert
  // (z. B. iOS das Feld über die Tastatur schiebt).
  const onPointer = (e: Event) => {
    const target = e.target;
    if (!(target instanceof Node) || !card.contains(target)) stop();
  };
  const onFocus = (e: Event) => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) stop();
  };
  const listeners: [string, EventListener][] = [
    ["touchmove", stop],
    ["wheel", stop],
    ["keydown", onKey as EventListener],
    ["pointerdown", onPointer],
    ["touchstart", onPointer],
    ["focusin", onFocus],
  ];

  function stop() {
    cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", onViewport);
    viewport?.removeEventListener("scroll", onViewport);
    listeners.forEach(([name, fn]) => window.removeEventListener(name, fn, true));
    if (stopCurrent === stop) stopCurrent = null;
  }
  // Erst nach diesem Ereignis (dem Antippen von "Tipp abgeben") auf den
  // Spieler hören, sonst beendet der eigene Klick das Halten sofort.
  window.setTimeout(() => {
    if (stopCurrent !== stop) return;
    listeners.forEach(([name, fn]) => window.addEventListener(name, fn, { capture: true, passive: true }));
  }, 0);
  stopCurrent = stop;
}

// ---------------------------------------------------------------------------
// Immer auf der Tipps-Seite: Safari (iPhone) gleicht es NICHT aus, wenn sich
// über dem, was man gerade ansieht, etwas in der Höhe ändert (Chrome macht
// das von selbst, "Scroll Anchoring"). Dort rutschen die Karten dann weg,
// z. B. wenn die Live-Leiste oben wächst, ein Spiel wegen Tippschluss aus der
// Liste geht oder eine Karte darüber nach dem Speichern anders hoch ist –
// auch während man schon beim nächsten Spiel die Zahlen eintippt.
// Darum hier dasselbe für alle Browser: gemerkt wird die zuletzt angetippte
// Karte (sonst die erste sichtbare). Verschiebt sie sich, OHNE dass gescrollt
// wurde, wird das sofort ausgeglichen. Scrollt jemand (Spieler, iOS beim
// Öffnen der Tastatur, ein Knopf wie "Live"), gilt einfach die neue Stelle.
// Ganz oben (Seite nicht gescrollt) bleibt die Seite oben, wie in Chrome.

const CARD_SELECTOR = '[id^="spiel-"]';

function headerBottom() {
  const header = document.querySelector("[data-pull-anchor]");
  return Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
}

export function startTipsScrollAnchor(): () => void {
  let touched: HTMLElement | null = null;
  let anchorEl: HTMLElement | null = null;
  let anchorTop = 0;
  let lastY = window.scrollY;
  let lastVv = viewportTop();
  let frame = 0;

  const pick = (): HTMLElement | null => {
    const top = headerBottom();
    const bottom = window.innerHeight;
    if (touched?.isConnected) {
      const r = touched.getBoundingClientRect();
      if (r.bottom > top && r.top < bottom) return touched;
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(CARD_SELECTOR))) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > top) return r.top < bottom ? el : null;
    }
    return null;
  };
  const capture = () => {
    anchorEl = pick();
    anchorTop = anchorEl ? anchorEl.getBoundingClientRect().top - viewportTop() : 0;
    lastY = window.scrollY;
    lastVv = viewportTop();
  };

  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (isHoldingCard()) return capture();
    const scrolled = Math.abs(window.scrollY - lastY) >= 1 || Math.abs(viewportTop() - lastVv) >= 1;
    if (scrolled || !anchorEl?.isConnected || window.scrollY <= 0) return capture();
    const delta = anchorEl.getBoundingClientRect().top - viewportTop() - anchorTop;
    if (Math.abs(delta) < 1) return;
    holdPageFloor();
    window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
    lastY = window.scrollY;
    lastVv = viewportTop();
  };
  frame = requestAnimationFrame(tick);

  // Angetippte Karte merken (Eingabefeld, Tipp-Knopf, 1/X/2 …). Antippen
  // außerhalb (Reiter, Logo …): nichts festhalten, bis wieder gescrollt wird.
  const onTouch = (e: Event) => {
    const card = e.target instanceof Element ? e.target.closest<HTMLElement>(CARD_SELECTOR) : null;
    touched = card;
    if (card) capture();
    else anchorEl = null;
  };
  window.addEventListener("pointerdown", onTouch, { capture: true, passive: true });
  window.addEventListener("focusin", onTouch, { capture: true, passive: true });

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointerdown", onTouch, true);
    window.removeEventListener("focusin", onTouch, true);
  };
}
