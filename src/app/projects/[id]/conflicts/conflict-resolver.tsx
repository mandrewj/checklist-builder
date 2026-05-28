"use client";

import { useState, useTransition } from "react";
import { resolveConflict } from "@/lib/actions/conflicts";
import { SourceChip } from "@/components/insectid/source-chip";
import { cn } from "@/lib/utils";

type Resolution = "gbif" | "inat" | "separate" | "merged";

export interface ConflictResolverProps {
  conflictId: string;
  gbifName: string;
  gbifAuthority: string | null;
  gbifRecords: number;
  inatName: string;
  inatAuthority: string | null;
  inatRecords: number;
  note: string | null;
  currentResolution: Resolution | null;
  currentCustomName: string | null;
  canMutate: boolean;
}

export function ConflictResolver({
  conflictId,
  gbifName,
  gbifAuthority,
  gbifRecords,
  inatName,
  inatAuthority,
  inatRecords,
  note,
  currentResolution,
  currentCustomName,
  canMutate,
}: ConflictResolverProps) {
  const [choice, setChoice] = useState<Resolution | null>(currentResolution);
  const [customName, setCustomName] = useState(currentCustomName ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitDisabled =
    !canMutate ||
    !choice ||
    pending ||
    (choice === "merged" && !customName.trim());

  function submit() {
    if (!choice) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await resolveConflict(
        conflictId,
        choice,
        choice === "merged" ? customName : undefined,
      );
      if (res.ok) setFeedback("Saved.");
      else setFeedback(res.error);
    });
  }

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <NameCard
          source="gbif"
          name={gbifName}
          authority={gbifAuthority}
          nRecords={gbifRecords}
        />
        <NameCard
          source="inat"
          name={inatName}
          authority={inatAuthority}
          nRecords={inatRecords}
        />
      </div>

      {note && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {note}
        </p>
      )}

      <fieldset className="flex flex-col gap-2" disabled={!canMutate || pending}>
        <legend className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
          Resolution
        </legend>
        <ResolutionRadio
          checked={choice === "gbif"}
          onChange={() => setChoice("gbif")}
          label="Use GBIF name"
          help={`Adopt ${gbifName}. iNat records re-map to this taxon.`}
        />
        <ResolutionRadio
          checked={choice === "inat"}
          onChange={() => setChoice("inat")}
          label="Use iNat name"
          help={`Rename the taxon to ${inatName}. GBIF records re-map.`}
        />
        <ResolutionRadio
          checked={choice === "separate"}
          onChange={() => setChoice("separate")}
          label="Keep separate"
          help="Treat as different concepts — no automatic remapping."
        />
        <ResolutionRadio
          checked={choice === "merged"}
          onChange={() => setChoice("merged")}
          label="Merge under custom name"
          help="Replace the taxon's scientific name with the value below."
        >
          {choice === "merged" && (
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Custom scientific name"
              className="mt-2 w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          )}
        </ResolutionRadio>
      </fieldset>

      <div className="flex items-center justify-between pt-1">
        <span
          className={cn(
            "text-xs",
            feedback?.startsWith("Saved") ? "text-success-700" : "text-danger-600",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback ?? (currentResolution ? `Currently: ${currentResolution}` : " ")}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={submitDisabled}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : currentResolution ? "Update" : "Apply"}
        </button>
      </div>
    </article>
  );
}

function NameCard({
  source,
  name,
  authority,
  nRecords,
}: {
  source: "gbif" | "inat";
  name: string;
  authority: string | null;
  nRecords: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-surface-3 bg-surface-1 p-3">
      <SourceChip source={source} />
      <span className="text-sm font-bold italic text-text-700">{name}</span>
      <span className="text-[11px] text-text-400">{authority ?? "—"}</span>
      <span className="text-[11px] uppercase tracking-[0.08em] text-text-400">
        {nRecords} records
      </span>
    </div>
  );
}

function ResolutionRadio({
  checked,
  onChange,
  label,
  help,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  help: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-md border-2 px-3 py-2 transition-colors",
        checked
          ? "border-blue-600 bg-blue-50"
          : "border-surface-3 hover:border-blue-200",
      )}
    >
      <span className="flex items-center gap-2">
        <input
          type="radio"
          checked={checked}
          onChange={onChange}
          className="size-4 accent-blue-600"
        />
        <span className="text-sm font-bold text-text-700">{label}</span>
      </span>
      <span className="pl-6 text-xs text-text-500">{help}</span>
      {children}
    </label>
  );
}
