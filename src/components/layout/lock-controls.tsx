"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import { lockProject, unlockProject } from "@/lib/actions/project-lock";
import { cn } from "@/lib/utils";

export interface LockControlsProps {
  projectId: string;
  locked: boolean;
}

export function LockControls({ projectId, locked }: LockControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = locked
        ? await unlockProject(projectId)
        : await lockProject(projectId);
      if (!res.ok) setError(res.error);
      else setConfirmOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors",
          locked
            ? "border border-warning-600/40 text-warning-700 hover:bg-warning-50"
            : "bg-blue-600 text-white shadow-card hover:bg-blue-700",
        )}
      >
        {locked ? (
          <>
            <Unlock className="size-3.5" aria-hidden />
            Unlock
          </>
        ) : (
          <>
            <Lock className="size-3.5" aria-hidden />
            Lock for export
          </>
        )}
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text-700/40"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="fade-in flex w-full max-w-md flex-col gap-4 rounded-xl bg-surface-0 p-6 shadow-pop">
            <header className="flex flex-col gap-1">
              <span className="eyebrow">Confirm</span>
              <h2 className="text-base font-bold text-blue-800">
                {locked ? "Unlock project?" : "Lock project for export?"}
              </h2>
            </header>
            <p className="text-sm text-text-500">
              {locked
                ? "Unlocking lets you make changes again. Existing export artifacts keep their snapshot id, so anyone who already downloaded a file still has consistent provenance."
                : "Locking creates an immutable snapshot id. Mutating actions are blocked until you unlock. Exports run against this snapshot."}
            </p>
            {error && (
              <p className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-600">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="rounded-md border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-bold text-text-600 hover:bg-surface-1 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={go}
                disabled={pending}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-bold text-white shadow-card disabled:opacity-60",
                  locked
                    ? "bg-warning-600 hover:bg-warning-700"
                    : "bg-blue-600 hover:bg-blue-700",
                )}
              >
                {pending
                  ? "Working…"
                  : locked
                    ? "Unlock"
                    : "Lock & create snapshot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
