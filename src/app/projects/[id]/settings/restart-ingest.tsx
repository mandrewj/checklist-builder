"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { restartIngest } from "@/lib/actions/project-settings";

export function RestartIngestPanel({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go() {
    setFeedback(null);
    startTransition(async () => {
      const res = await restartIngest(projectId);
      if (res.ok) {
        setFeedback(
          `Dropped ${res.data.deletedRecords} record${res.data.deletedRecords === 1 ? "" : "s"}. Ingest jobs reset — click Run ingest on the Overview to start.`,
        );
        setConfirmOpen(false);
      } else {
        setFeedback(res.error);
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-warning-700" role="status" aria-live="polite">
          {feedback}
        </span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled || pending}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-warning-600/50 bg-surface-0 px-3 py-1.5 text-xs font-bold text-warning-700 hover:bg-warning-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className="size-3" aria-hidden />
          Re-run ingest
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text-700/40 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="fade-in flex w-full max-w-md flex-col gap-4 rounded-xl bg-surface-0 p-6 shadow-pop">
            <h2 className="text-base font-bold text-warning-700">
              Re-run ingest?
            </h2>
            <p className="text-sm text-text-500">
              Drops all GBIF + iNaturalist records, removes detected conflicts,
              and resets both ingest jobs back to page 1. Manual / cite-only
              records, inclusion decisions, and comments survive.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="rounded-md border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-bold text-text-600 hover:bg-surface-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={go}
                disabled={pending}
                className="rounded-md bg-warning-600 px-4 py-1.5 text-sm font-bold text-white shadow-card hover:bg-warning-700 disabled:opacity-60"
              >
                {pending ? "Working…" : "Drop records & reset jobs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
