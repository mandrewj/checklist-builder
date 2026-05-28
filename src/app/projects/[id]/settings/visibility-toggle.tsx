"use client";

import { useState, useTransition } from "react";
import { Globe } from "lucide-react";
import { setProjectVisibility } from "@/lib/actions/project-settings";
import { cn } from "@/lib/utils";

interface VisibilityToggleProps {
  projectId: string;
  initialIsPublic: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function VisibilityToggle({
  projectId,
  initialIsPublic,
  disabled,
  disabledReason,
}: VisibilityToggleProps) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !isPublic;
    setFeedback(null);
    startTransition(async () => {
      const res = await setProjectVisibility(projectId, next);
      if (res.ok) {
        setIsPublic(next);
        setFeedback(
          next
            ? "Public view is on — anyone with the project URL can read all data."
            : "Public view turned off — only members can access this project.",
        );
      } else {
        setFeedback(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-text-700">
            {isPublic ? "Public — anyone with the link" : "Private — members only"}
          </p>
          <p className="text-[11px] text-text-400">
            When on, anonymous web visitors can browse the checklist, species
            pages, conflicts, manual entries, and exports. Edit + mutation
            actions stay limited to project members.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || pending}
          aria-pressed={isPublic}
          title={disabledReason}
          className={cn(
            "relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600/30",
            isPublic
              ? "border-blue-600 bg-blue-600"
              : "border-surface-3 bg-surface-2",
            (disabled || pending) && "cursor-not-allowed opacity-60",
          )}
        >
          <span className="sr-only">Toggle public view</span>
          <span
            className={cn(
              "inline-block size-4 transform rounded-full bg-surface-0 shadow-card transition-transform",
              isPublic ? "translate-x-7" : "translate-x-1",
            )}
            aria-hidden
          />
        </button>
      </div>
      {disabledReason && (
        <p className="text-[11px] text-text-400">{disabledReason}</p>
      )}
      {feedback && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
          <Globe className="mr-1 inline size-3" aria-hidden />
          {feedback}
        </p>
      )}
    </div>
  );
}
