"use client";

import { useState, useTransition } from "react";
import { Check, CircleDashed, X } from "lucide-react";
import { setTaxonInclusion } from "@/lib/actions/taxa";
import { cn } from "@/lib/utils";

type State = "include" | "exclude" | "undecided";

const CHOICES: Array<{ value: State; label: string; icon: typeof Check; tone: string }> = [
  { value: "include",   label: "Include",   icon: Check,         tone: "border-success-600 text-success-700 bg-success-50" },
  { value: "exclude",   label: "Exclude",   icon: X,             tone: "border-text-400 text-text-600 bg-surface-1" },
  { value: "undecided", label: "Undecided", icon: CircleDashed,  tone: "border-warning-600 text-warning-700 bg-warning-50" },
];

interface InclusionPanelProps {
  taxonId: string;
  initialValue: State;
  initialReasoning: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function InclusionPanel({
  taxonId,
  initialValue,
  initialReasoning,
  disabled,
  disabledReason,
}: InclusionPanelProps) {
  const [value, setValue] = useState<State>(initialValue);
  const [reasoning, setReasoning] = useState(initialReasoning);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  function submit() {
    setFeedback(null);
    startTransition(async () => {
      const result = await setTaxonInclusion(taxonId, value, reasoning);
      if (result.ok) {
        setFeedback("Saved.");
      } else {
        setFeedback(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-blue-800">Inclusion decision</h3>
        {disabled && (
          <span
            className="text-[11px] uppercase tracking-[0.08em] text-warning-700"
            title={disabledReason}
          >
            Read only
          </span>
        )}
      </header>

      <div className="flex gap-2">
        {CHOICES.map((c) => {
          const Icon = c.icon;
          const active = value === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setValue(c.value)}
              disabled={disabled || pending}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-xs font-bold transition-all",
                active ? c.tone : "border-surface-3 text-text-500 bg-surface-0 hover:border-surface-2",
                (disabled || pending) && "cursor-not-allowed opacity-60",
              )}
              aria-pressed={active}
            >
              <Icon className="size-4" aria-hidden />
              {c.label}
            </button>
          );
        })}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
          Reasoning
        </span>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          rows={3}
          placeholder="Cite the basis for this decision. Required when locking the project."
          disabled={disabled || pending}
          className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-700 placeholder:text-text-300 focus:outline-none focus:ring-2 focus:ring-blue-600/30 disabled:cursor-not-allowed disabled:bg-surface-1 disabled:opacity-60"
        />
      </label>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span
          className={cn(
            "text-xs",
            feedback?.startsWith("Saved") ? "text-success-700" : "text-danger-600",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback ?? " "}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || pending}
          className={cn(
            "rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {pending ? "Saving…" : "Save decision"}
        </button>
      </div>
    </div>
  );
}
