"use client";

import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { DEFAULT_START_PAGE, START_PAGES } from "@/lib/startPage";
import SaveButton, { useDraft } from "@/components/SaveButton";

// Im Profil unter "Einstellungen": welche Seite die App beim Öffnen zeigt
// (siehe lib/startPage.ts).
export default function StartPagePicker() {
  const { startPage, setStartPage } = useUser();
  const { showToast } = useFeedback();
  const draft = useDraft(startPage ?? DEFAULT_START_PAGE);

  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">Startseite</p>
          <p className="text-xs text-muted">Diese Seite zeigt die App, wenn du sie öffnest.</p>
        </div>
        <SaveButton
          dirty={draft.dirty}
          saved={draft.saved}
          onClick={() =>
            draft.save((href) => {
              setStartPage(href);
              const page = START_PAGES.find((p) => p.href === href);
              if (page) showToast(`${page.icon} Startseite: ${page.label}`, "gold");
            })
          }
        />
      </div>
      <div role="radiogroup" aria-label="Startseite" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {START_PAGES.map((page) => {
          const active = draft.value === page.href;
          return (
            <button
              key={page.href}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={startPage === null}
              onClick={() => draft.set(page.href)}
              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 font-display text-sm font-semibold transition-colors disabled:opacity-60 ${
                active ? "border-action bg-action text-pitch" : "border-edge bg-pitch text-muted hover:border-gold/60 hover:text-ink"
              }`}
            >
              <span aria-hidden>{page.icon}</span>
              <span className="whitespace-nowrap">{page.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
