"use client";

import { SPORT_ICONS, sportLabel } from "@/lib/types";
import { BioData, isBioEmpty, mainRole, orderedRoles, roleLabel, rolePlace, SportBio } from "@/lib/sportBio";

// Sport-Steckbrief als auffällige Karte (Rene, 19.10.2026: "das braucht
// Aufmerksamkeit und muss ins Auge springen"). Im eigenen Profil und auf der
// Spielerseite. Daten und Regeln: lib/sportBio.ts.
// onEdit: nur im eigenen Profil – öffnet den Steckbrief unter Einstellungen.
export default function SportBioCard({ bio, onEdit }: { bio: SportBio | null; onEdit?: () => void }) {
  const own = !!onEdit;
  const empty = !bio || isBioEmpty(bio.data);

  if (empty) {
    if (!own) return null;
    // Eigenes Profil ohne Steckbrief: Einladung zum Ausfüllen.
    return (
      <button
        type="button"
        onClick={onEdit}
        className="group relative mb-8 block w-full overflow-hidden text-left rounded-card border border-gold/50 bg-gradient-to-br from-gold/20 via-surface to-surface p-5 transition-colors hover:border-gold"
      >
        <span aria-hidden className="pointer-events-none absolute -right-3 -top-4 select-none text-7xl opacity-20">
          🏟️
        </span>
        <p className="font-display text-xs font-bold uppercase tracking-wider text-gold">Neu · Sport-Steckbrief</p>
        <p className="mt-1 font-display text-lg font-bold text-ink">Zeig, was du mit Sport zu tun hast</p>
        <p className="mt-1 max-w-md text-sm text-muted">
          Ex-Vereinsspieler, Jugendtrainer, Schiri oder Fan seit 1998? Deine Freunde sehen es in deinem Profil.
        </p>
        <span className="mt-3 inline-block rounded-full bg-gold px-4 py-1.5 font-display text-sm font-semibold text-pitch transition-opacity group-hover:opacity-90">
          Steckbrief ausfüllen
        </span>
      </button>
    );
  }

  const data = bio.data;
  const roles = orderedRoles(data);
  const facts = factsOf(data);

  return (
    <section
      aria-label="Sport-Steckbrief"
      className="relative mb-8 overflow-hidden rounded-card border border-gold/60 bg-gradient-to-br from-gold/25 via-surface to-surface p-5 shadow-[0_0_24px_-8px_rgb(var(--c-gold)/0.6)]"
    >
      <span aria-hidden className="pointer-events-none absolute -right-3 -top-4 select-none text-7xl opacity-15">
        {mainRole(data)?.[0] ?? "🏟️"}
      </span>
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-xs font-bold uppercase tracking-wider text-gold">Sport-Steckbrief</p>
        {bio.verified ? (
          <span className="rounded-full border border-action/60 bg-action/15 px-2.5 py-0.5 text-[11px] font-semibold text-action">
            ✓ bestätigt
          </span>
        ) : (
          <span className="rounded-full border border-edge bg-pitch/60 px-2.5 py-0.5 text-[11px] font-medium text-muted">
            eigene Angabe
          </span>
        )}
      </div>

      {roles.length > 0 && (
        <ul className="relative mt-3 grid gap-2 sm:grid-cols-2">
          {roles.map(([k, r]) => {
            const [icon, label] = roleLabel(k, r);
            const place = rolePlace(r);
            const pending = own && !!r.club && r.clubApproved === false;
            return (
              <li key={k} className="flex items-center gap-3 rounded-card border border-gold/30 bg-pitch/60 px-3 py-2.5">
                <span aria-hidden className="text-3xl leading-none">
                  {icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-bold leading-tight text-ink">{label}</span>
                  {place && <span className="block truncate text-xs text-muted">{place}</span>}
                  {pending && <span className="block text-[11px] text-gold">⏳ Verein wird vom Admin geprüft</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {facts.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {facts.map((f) => (
            <span key={f} className="rounded-full border border-edge bg-pitch/60 px-3 py-1 text-xs font-semibold text-ink">
              {f}
            </span>
          ))}
        </div>
      )}

      {own && (
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span>
            {bio.visibility === "public"
              ? "👁️ Sehen alle"
              : bio.visibility === "friends"
                ? "👥 Sehen nur deine Freunde"
                : "🔒 Für andere ausgeblendet"}
          </span>
          <button type="button" onClick={onEdit} className="font-semibold text-gold hover:underline">
            Bearbeiten
          </button>
        </div>
      )}
    </section>
  );
}

function factsOf(data: BioData): string[] {
  const facts: string[] = [];
  for (const s of data.sports ?? []) facts.push(`${SPORT_ICONS[s] ?? ""} ${sportLabel(s)}`.trim());
  if (data.level) facts.push(`🏆 Höchste Klasse: ${data.level}`);
  if (data.since) facts.push(`❤️ Fan seit ${data.since}`);
  return facts;
}

/** Kleines Abzeichen mit der Hauptrolle unter dem Namen. */
export function SportBioTag({ bio }: { bio: SportBio | null }) {
  const role = mainRole(bio?.data);
  if (!role) return null;
  return (
    <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/60 bg-gold/15 px-3 py-1 font-display text-xs font-bold text-gold">
      <span aria-hidden>{role[0]}</span>
      {role[1]}
      {bio?.verified && <span className="text-action">✓</span>}
    </span>
  );
}
