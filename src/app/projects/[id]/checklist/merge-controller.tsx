"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { GitMerge, X, ChevronRight, Check } from "lucide-react";
import { mergeTaxa } from "@/lib/actions/merge-taxa";
import { InclusionBadge } from "@/components/insectid/inclusion-badge";
import { SourceChip, type SourceKind } from "@/components/insectid/source-chip";
import { MiniChoropleth } from "@/components/insectid/mini-choropleth";
import { cn } from "@/lib/utils";
import type { InclusionEnumValue } from "./types";

export interface ChecklistEntry {
  id: string;
  scientificName: string;
  authority: string | null;
  family: string | null;
  subfamily: string | null;
  included: InclusionEnumValue;
  sources: ReadonlyArray<SourceKind>;
  hasConflict: boolean;
  nRecords: number;
  nCounties: number;
  presence: Record<string, number>;
}

export interface MergeControllerProps {
  projectId: string;
  rows: ReadonlyArray<ChecklistEntry>;
  regionCodes: ReadonlyArray<string>;
  canMutate: boolean;
}

export function MergeController({
  projectId,
  rows,
  regionCodes,
  canMutate,
}: MergeControllerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keepId, setKeepId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // If the kept-id is no longer in the selection, reset it.
      if (keepId && !next.has(keepId)) setKeepId(null);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setKeepId(null);
    setFeedback(null);
  }

  function openConfirm() {
    if (selected.size < 2) {
      setFeedback("Pick at least two species to merge.");
      return;
    }
    setFeedback(null);
    // Default kept = first selected (alphabetical from the visible row order).
    const firstSelected = rows.find((r) => selected.has(r.id))?.id ?? null;
    setKeepId((current) => current ?? firstSelected);
    setConfirmOpen(true);
  }

  function doMerge() {
    if (!keepId || selected.size < 2) return;
    const mergeIds = Array.from(selected).filter((id) => id !== keepId);
    setFeedback(null);
    startTransition(async () => {
      const res = await mergeTaxa(projectId, keepId, mergeIds);
      if (!res.ok) {
        setFeedback(res.error);
        return;
      }
      setConfirmOpen(false);
      clearSelection();
      setFeedback(`Merged ${res.data.mergedCount} taxa into the kept row.`);
    });
  }

  const selectedRows = rows.filter((r) => selected.has(r.id));

  return (
    <>
      {selected.size > 0 && canMutate && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-md bg-blue-800 px-4 py-2.5 text-sm text-white shadow-pop">
          <span className="font-bold">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openConfirm}
              disabled={selected.size < 2 || pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-bold text-blue-800 hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GitMerge className="size-3" aria-hidden />
              Merge…
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={pending}
              className="rounded-md border border-blue-200/40 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {feedback && !confirmOpen && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            feedback.startsWith("Merged")
              ? "border-success-600/30 bg-success-50 text-success-700"
              : "border-danger-600/30 bg-danger-50 text-danger-600",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback}
        </div>
      )}

      <ChecklistGrid
        rows={rows}
        projectId={projectId}
        regionCodes={regionCodes}
        canMutate={canMutate}
        selected={selected}
        onToggle={toggle}
      />

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-text-700/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm merge"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div className="fade-in flex w-full max-w-lg flex-col gap-4 rounded-xl bg-surface-0 p-6 shadow-pop">
            <header className="flex items-start justify-between gap-2">
              <div className="flex flex-col">
                <span className="eyebrow">Merge taxa</span>
                <h2 className="text-base font-bold text-blue-800">
                  Pick the kept species
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md p-1 text-text-400 hover:bg-surface-2 hover:text-text-700"
                aria-label="Cancel"
              >
                <X className="size-4" />
              </button>
            </header>

            <p className="text-sm text-text-500">
              Records, comments, and conflict references on the other taxa
              get re-pointed to the kept row. Distribution rebuilds
              automatically. Activity log captures the merge.
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
                Keep
              </legend>
              {selectedRows.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md border-2 px-3 py-2 transition-colors",
                    keepId === r.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-surface-3 hover:border-blue-200",
                  )}
                >
                  <input
                    type="radio"
                    checked={keepId === r.id}
                    onChange={() => setKeepId(r.id)}
                    className="mt-1 size-4 accent-blue-600"
                  />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-bold italic text-text-700">
                      {r.scientificName}{" "}
                      <span className="font-normal not-italic text-text-400">
                        {r.authority ?? ""}
                      </span>
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.08em] text-text-400">
                      {r.family ?? "—"} · {r.nRecords} records ·{" "}
                      {r.nCounties} counties
                    </span>
                  </div>
                </label>
              ))}
            </fieldset>

            {feedback && (
              <p
                className="rounded-md border border-danger-600/30 bg-danger-50 px-3 py-2 text-xs text-danger-600"
                role="alert"
              >
                {feedback}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
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
                onClick={doMerge}
                disabled={pending || !keepId || selected.size < 2}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-bold text-white shadow-card hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="size-3.5" aria-hidden />
                {pending
                  ? "Merging…"
                  : `Merge ${selected.size - 1} into kept row`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const GRID_COLS =
  "grid grid-cols-[24px_minmax(0,1fr)_100px_110px_70px_70px_252px_24px] items-center gap-2";

function ChecklistGrid({
  rows,
  projectId,
  regionCodes,
  canMutate,
  selected,
  onToggle,
}: {
  rows: ReadonlyArray<ChecklistEntry>;
  projectId: string;
  regionCodes: ReadonlyArray<string>;
  canMutate: boolean;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-16 text-center text-sm text-text-400">
        No taxa match these filters. Try widening or clearing the chips above.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-card">
      <div
        className={`${GRID_COLS} border-b border-surface-3 bg-surface-1 px-4 py-2 text-[10.5px] uppercase tracking-[0.08em] text-text-400`}
        role="row"
      >
        <span />
        <span className="font-bold">Species</span>
        <span className="font-bold">Sources</span>
        <span className="font-bold">Inclusion</span>
        <span className="text-right font-bold">Records</span>
        <span className="text-right font-bold">Counties</span>
        <span className="text-center font-bold">Distribution</span>
        <span />
      </div>
      <ul className="flex flex-col divide-y divide-surface-3">
        {rows.map((r) => {
          const isSelected = selected.has(r.id);
          return (
            <li
              key={r.id}
              className={cn(
                `${GRID_COLS} group px-4 py-3 text-sm transition-colors hover:bg-blue-50/40`,
                isSelected && "bg-blue-50/60",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(r.id)}
                disabled={!canMutate}
                aria-label={`Select ${r.scientificName} for merge`}
                className="size-4 accent-blue-600"
              />
              <Link
                href={`/projects/${projectId}/species/${r.id}`}
                className="flex min-w-0 flex-col gap-0.5"
                aria-label={`Open ${r.scientificName}`}
              >
                <span className="truncate text-sm font-bold italic text-text-700 group-hover:text-blue-700">
                  {r.scientificName}{" "}
                  <span className="font-normal not-italic text-text-400">
                    {r.authority ?? ""}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-text-400">
                  <span className="truncate">{r.family ?? "—"}</span>
                  {r.subfamily && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="truncate">{r.subfamily}</span>
                    </>
                  )}
                  {r.hasConflict && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="rounded-full bg-warning-50 px-2 py-0.5 font-bold text-warning-700">
                        Conflict
                      </span>
                    </>
                  )}
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-1">
                {r.sources.map((s) => (
                  <SourceChip key={s} source={s} />
                ))}
                {r.sources.length === 0 && (
                  <span className="text-[11px] text-text-400">—</span>
                )}
              </div>
              <InclusionBadge state={r.included} />
              <span className="text-right font-mono tabular-nums text-text-600">
                {r.nRecords.toLocaleString()}
              </span>
              <span className="text-right font-mono tabular-nums text-text-600">
                {r.nCounties}
              </span>
              <div className="flex justify-center">
                <MiniChoropleth
                  countyPresence={r.presence}
                  regionCodes={regionCodes}
                />
              </div>
              <Link
                href={`/projects/${projectId}/species/${r.id}`}
                aria-label={`Open ${r.scientificName}`}
              >
                <ChevronRight
                  className="size-4 justify-self-end text-text-300 group-hover:text-blue-600"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
