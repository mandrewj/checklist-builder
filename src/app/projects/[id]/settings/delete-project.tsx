"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProject } from "@/lib/actions/project-settings";
import { cn } from "@/lib/utils";

export function DeleteProjectPanel({
  projectId,
  projectName,
  disabled,
}: {
  projectId: string;
  projectName: string;
  disabled?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = confirmName.trim() === projectName.trim();

  function go() {
    setFeedback(null);
    startTransition(async () => {
      // deleteProject redirects on success.
      const res = await deleteProject(projectId, confirmName);
      if (!res.ok) setFeedback(res.error);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-danger-600">
          Permanent. Members, taxa, records, exports — all of it.
        </span>
        <button
          type="button"
          onClick={() => {
            setConfirmName("");
            setConfirmOpen(true);
          }}
          disabled={disabled || pending}
          className="inline-flex items-center gap-1.5 rounded-md border-2 border-danger-600/40 bg-surface-0 px-3 py-1.5 text-xs font-bold text-danger-600 hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="size-3" aria-hidden />
          Delete project
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
            <h2 className="text-base font-bold text-danger-600">
              Delete this project?
            </h2>
            <p className="text-sm text-text-500">
              Type the project&rsquo;s name to confirm. After deletion you
              land on the dashboard.
            </p>
            <div className="rounded-md border border-surface-3 bg-surface-1 px-3 py-2 text-xs font-mono text-text-700">
              {projectName}
            </div>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder="Type the project name"
              disabled={pending}
              className="rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger-600/30"
            />
            {feedback && (
              <p
                className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-600"
                role="alert"
              >
                {feedback}
              </p>
            )}
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
                disabled={pending || !matches}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-bold text-white shadow-card disabled:opacity-60",
                  matches
                    ? "bg-danger-600 hover:bg-danger-700"
                    : "bg-danger-600/40 cursor-not-allowed",
                )}
              >
                {pending ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
