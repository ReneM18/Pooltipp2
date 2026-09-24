"use client";

import { useState, FormEvent } from "react";
import { useUser } from "@/lib/UserContext";

export default function RegistrierenPage() {
  const { setDisplayName } = useUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    // Hinweis: Es gibt noch kein echtes Backend – das Formular setzt aktuell
    // nur deinen lokalen Anzeigenamen. Mit Firestore/Auth wird hieraus ein
    // echtes Konto.
    setDisplayName(name.trim());
    setDone(true);
  }

  if (done) {
    return (
      <main className="mx-auto flex max-w-sm flex-col items-center px-5 py-24 text-center">
        <h1 className="mb-2 font-display text-2xl font-bold text-ink">Willkommen, {name}! 🎉</h1>
        <p className="text-sm text-muted">
          Dein Profil ist eingerichtet. Sobald die echte Kontenverwaltung angebunden ist, bleibt
          dieses Konto auch nach dem Schließen der App erhalten.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Konto erstellen</h1>
      <p className="mb-6 text-sm text-muted">Tritt PoolTipp bei und leg direkt los.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs text-muted">Anzeigename</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </div>
        <button
          type="submit"
          className="mt-2 w-full rounded-full bg-action py-2.5 font-display font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Registrieren
        </button>
      </form>
    </main>
  );
}
