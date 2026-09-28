"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";

export default function RegistrierenPage() {
  const { isRegistered, register, displayName } = useUser();
  const { showToast, celebrate } = useFeedback();
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    // Platzhalter für die echte Konto-Erstellung (Firebase Auth o. ä.) –
    // simuliert hier kurz eine Verarbeitung. Sobald "isRegistered" true ist,
    // verschwindet der "Registrieren"-Button in der Navbar von selbst.
    setTimeout(() => {
      register();
      setSubmitting(false);
      celebrate();
      showToast("🎉 Registrierung abgeschlossen!", "gold");
      router.push("/");
    }, 600);
  }

  if (isRegistered) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center">
        <p className="text-5xl">✓</p>
        <h1 className="mt-4 font-display text-2xl font-bold text-ink">Du bist schon registriert</h1>
        <p className="mt-2 text-sm text-muted">Es gibt hier nichts mehr zu tun.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Registrieren</h1>
      <p className="mb-6 text-sm text-muted">
        Sichere dir deinen Account, damit dein Fortschritt und deine Sterne erhalten bleiben.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-edge bg-surface p-5">
        <div>
          <label className="mb-1 block text-xs text-muted">Anzeigename</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-gold py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
        >
          {submitting ? "Wird verarbeitet…" : "Jetzt registrieren"}
        </button>
      </form>
    </main>
  );
}
