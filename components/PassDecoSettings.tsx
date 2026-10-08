"use client";

import { ReactNode } from "react";
import { useUser } from "@/lib/UserContext";
import { getOwnedFrames, xpForLevel } from "@/lib/seasonPass";
import { AUTO, NONE, PassDisplay } from "@/lib/passDisplay";
import { SEASON_THEME } from "@/lib/seasonTheme";
import SaveButton, { useDraft } from "@/components/SaveButton";

// Profil -> Einstellungen -> "Pass-Belohnungen": selbst wählen, was man von
// seinen Saison-Pass-Belohnungen trägt (Rahmen, Titel, Abzeichen,
// Saison-Icon), und ob man Rahmen, Titel und Abzeichen ANDERER Spieler sehen
// will. Alles fürs Konto gespeichert (lib/passDisplay.ts), gilt sofort auf
// jedem Gerät. Ablegen nimmt nichts weg.
export default function PassDecoSettings() {
  const { passXP, hasPremiumPass, customFrameColors, passHonors, passDisplay, setPassDisplay, hideOthersDeco, setHideOthersDeco, accountSync, extrasLoaded } =
    useUser();

  const frames = getOwnedFrames(passXP, hasPremiumPass, customFrameColors);
  const titles = passHonors.allTitles;
  const badges = passHonors.badges;
  const hasNameIcon = hasPremiumPass && passXP >= xpForLevel(3);

  // Gewählte Belohnung nicht (mehr) erreicht: wie "Automatisch" anzeigen.
  const frameValue = frames.some((f) => f.variant === passDisplay.frame) || passDisplay.frame === NONE ? passDisplay.frame! : AUTO;
  const titleValue = titles.some((t) => t.label === passDisplay.title) || passDisplay.title === NONE ? passDisplay.title! : AUTO;
  const badgeValue = badges.some((b) => b.label === passDisplay.badge) || passDisplay.badge === NONE ? passDisplay.badge! : AUTO;

  const frameDraft = useDraft(frameValue);
  const titleDraft = useDraft(titleValue);
  const badgeDraft = useDraft(badgeValue);
  const nameIconDraft = useDraft(passDisplay.nameIcon !== false);
  const othersDraft = useDraft(!hideOthersDeco);

  // Jede Speicherung ändert nur ihr eigenes Feld.
  function saveField(patch: Partial<PassDisplay>) {
    setPassDisplay({ ...passDisplay, ...patch });
  }

  const disabled = !extrasLoaded;

  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold text-ink">Pass-Belohnungen</h2>
      <p className="mt-1 text-xs text-muted">
        Wähle, was du aus dem Saison-Pass zeigst. Ablegen nimmt dir nichts weg, du kannst es jederzeit wieder anlegen.
      </p>

      <Card
        title="Rahmen ums Profilbild"
        text="Sehen auch die anderen, z. B. im Chat und in der Rangliste."
        save={
          <SaveButton
            dirty={frameDraft.dirty}
            saved={frameDraft.saved}
            onClick={() => frameDraft.save((v) => saveField({ frame: v }))}
          />
        }
      >
        {frames.length === 0 ? (
          <Empty>Noch kein Rahmen. Den ersten gibt es im Saison-Pass ab Level 3.</Empty>
        ) : (
          <Choices label="Rahmen">
            <Chip active={frameDraft.value === AUTO} disabled={disabled} onClick={() => frameDraft.set(AUTO)}>
              ✨ Bester
            </Chip>
            {frames.map((f) => (
              <Chip
                key={f.variant}
                active={frameDraft.value === f.variant}
                disabled={disabled}
                onClick={() => frameDraft.set(f.variant)}
              >
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${f.colorFrom}, ${f.colorTo})` }}
                />
                {f.label.replace(/^Saison-/, "")}
              </Chip>
            ))}
            <Chip active={frameDraft.value === NONE} disabled={disabled} onClick={() => frameDraft.set(NONE)}>
              Keiner
            </Chip>
          </Choices>
        )}
      </Card>

      <Card
        title="Titel neben deinem Namen"
        text="Im Profil, im Chat und bei Kommentaren."
        save={
          <SaveButton
            dirty={titleDraft.dirty}
            saved={titleDraft.saved}
            onClick={() => titleDraft.save((v) => saveField({ title: v }))}
          />
        }
      >
        {titles.length === 0 ? (
          <Empty>Noch kein Titel. Den ersten gibt es im Saison-Pass ab Level 4.</Empty>
        ) : (
          <Choices label="Titel">
            <Chip active={titleDraft.value === AUTO} disabled={disabled} onClick={() => titleDraft.set(AUTO)}>
              ✨ Neuester
            </Chip>
            {titles.map((t) => (
              <Chip
                key={t.label}
                active={titleDraft.value === t.label}
                disabled={disabled}
                onClick={() => titleDraft.set(t.label)}
              >
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </Chip>
            ))}
            <Chip active={titleDraft.value === NONE} disabled={disabled} onClick={() => titleDraft.set(NONE)}>
              Keiner
            </Chip>
          </Choices>
        )}
      </Card>

      <Card
        title="Abzeichen neben deinem Namen"
        text="Im Profil, im Chat und bei Kommentaren."
        save={
          <SaveButton
            dirty={badgeDraft.dirty}
            saved={badgeDraft.saved}
            onClick={() => badgeDraft.save((v) => saveField({ badge: v }))}
          />
        }
      >
        {badges.length === 0 ? (
          <Empty>Noch kein Abzeichen. Das gibt es im Saison-Pass auf Level 10.</Empty>
        ) : (
          <Choices label="Abzeichen">
            {badges.length > 1 && (
              <Chip active={badgeDraft.value === AUTO} disabled={disabled} onClick={() => badgeDraft.set(AUTO)}>
                ✨ Alle
              </Chip>
            )}
            {badges.map((b) => (
              <Chip
                key={b.label}
                active={badgeDraft.value === b.label || (badges.length === 1 && badgeDraft.value === AUTO)}
                disabled={disabled}
                onClick={() => badgeDraft.set(badges.length === 1 ? AUTO : b.label)}
              >
                <span aria-hidden>{b.icon}</span>
                {b.label}
              </Chip>
            ))}
            <Chip active={badgeDraft.value === NONE} disabled={disabled} onClick={() => badgeDraft.set(NONE)}>
              Keins
            </Chip>
          </Choices>
        )}
      </Card>

      {hasNameIcon && (
        <Card
          title={`Saison-Icon ${SEASON_THEME.icon} neben deinem Namen`}
          text="Premium-Belohnung, im Profil."
          save={
            <SaveButton
              dirty={nameIconDraft.dirty}
              saved={nameIconDraft.saved}
              onClick={() => nameIconDraft.save((on) => saveField({ nameIcon: on }))}
            />
          }
        >
          <Choices label="Saison-Icon">
            <Chip active={nameIconDraft.value} disabled={disabled} onClick={() => nameIconDraft.set(true)}>
              Zeigen
            </Chip>
            <Chip active={!nameIconDraft.value} disabled={disabled} onClick={() => nameIconDraft.set(false)}>
              Nicht zeigen
            </Chip>
          </Choices>
        </Card>
      )}

      <Card
        title="Deko anderer Spieler"
        text="Rahmen, Titel und Abzeichen der anderen. Gilt nur für deine Ansicht, die anderen behalten alles."
        save={
          <SaveButton
            dirty={othersDraft.dirty}
            saved={othersDraft.saved}
            onClick={() => othersDraft.save((show) => setHideOthersDeco(!show))}
          />
        }
      >
        <Choices label="Deko anderer Spieler">
          <Chip active={othersDraft.value} disabled={disabled} onClick={() => othersDraft.set(true)}>
            Anzeigen
          </Chip>
          <Chip active={!othersDraft.value} disabled={disabled} onClick={() => othersDraft.set(false)}>
            Ausblenden
          </Chip>
        </Choices>
      </Card>

      {accountSync?.passDeco === false && (
        <p className="mt-2 text-[11px] text-muted">
          ⚠️ Gilt im Moment nur auf diesem Gerät und bis zum Neuladen. Damit es auf allen Geräten gilt, fehlt noch ein
          Datenbank-Update.
        </p>
      )}
    </section>
  );
}

function Card({ title, text, save, children }: { title: string; text: string; save: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="text-xs text-muted">{text}</p>
        </div>
        {save}
      </div>
      {children}
    </div>
  );
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-3 flex flex-wrap gap-2">
      {children}
    </div>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-display text-sm font-semibold transition-colors disabled:opacity-60 ${
        active ? "border-action bg-action text-pitch" : "border-edge bg-pitch text-muted hover:border-gold/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-muted">{children}</p>;
}
