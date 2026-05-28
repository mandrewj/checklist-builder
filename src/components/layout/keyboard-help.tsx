"use client";

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";

interface Group {
  label: string;
  keys: Array<[string, string]>;
}

const GROUPS: Group[] = [
  {
    label: "Triage",
    keys: [
      ["J / K", "Next / previous record"],
      ["A", "Accept the focused record"],
      ["R", "Reject the focused record"],
      ["F", "Flag the focused record"],
      ["X", "Toggle selection on the focused record"],
    ],
  },
  {
    label: "Navigation",
    keys: [
      ["?", "Open / close this overlay"],
      ["Esc", "Close any open dialog / sheet"],
      ["Tab", "Move focus through interactive elements"],
    ],
  },
  {
    label: "Reading",
    keys: [
      ["Hover", "County tooltip on the choropleth"],
      ["Enter / Space", "Activate the focused button"],
    ],
  },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      // Don't intercept "?" when typing in a form field.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text-700/40"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="fade-in flex w-full max-w-xl flex-col gap-5 rounded-xl bg-surface-0 p-6 shadow-pop">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Keyboard className="size-4 text-blue-600" aria-hidden />
            <h2 className="text-base font-bold text-blue-800">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-text-400 hover:bg-surface-2 hover:text-text-700"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <section key={g.label} className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
                {g.label}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {g.keys.map(([k, label]) => (
                  <li key={k} className="flex items-center justify-between gap-3">
                    <kbd>{k}</kbd>
                    <span className="text-xs text-text-500">{label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="border-t border-surface-3 pt-3 text-[11px] text-text-400">
          Press <kbd>?</kbd> anywhere to open this overlay.
        </footer>
      </div>
    </div>
  );
}
