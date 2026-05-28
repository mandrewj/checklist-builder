"use client";

import { useState, useTransition } from "react";
import { updateProjectSettings } from "@/lib/actions/project-settings";
import { cn } from "@/lib/utils";

export function ProjectMetadataForm({
  projectId,
  initialName,
  initialDescription,
  disabled,
  disabledReason,
}: {
  projectId: string;
  initialName: string;
  initialDescription: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = name.trim() !== initialName || description.trim() !== initialDescription;

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const res = await updateProjectSettings(projectId, {
        name,
        description,
      });
      if (res.ok) setFeedback("Saved.");
      else setFeedback(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled || pending}
          className="rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-not-allowed disabled:bg-surface-1 disabled:opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={disabled || pending}
          className="rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-not-allowed disabled:bg-surface-1 disabled:opacity-60"
        />
      </label>
      <div className="flex items-center justify-between gap-2 pt-1">
        <span
          className={cn(
            "text-xs",
            feedback?.startsWith("Saved")
              ? "text-success-700"
              : feedback
                ? "text-danger-600"
                : "text-text-400",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback ?? (disabled ? (disabledReason ?? "Read only") : " ")}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || pending || !dirty}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
