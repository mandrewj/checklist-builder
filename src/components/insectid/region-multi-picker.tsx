"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  pickerOptionsForRegions,
  type PickerGroup,
} from "@/lib/insectid/region-picker-options";
import { cn } from "@/lib/utils";

interface RegionMultiPickerProps {
  /** Project regionCodes — drives the state/province cascade. */
  regionCodes: ReadonlyArray<string>;
  /** Currently selected region atoms (5-digit FIPS or CA-XX). */
  selected: ReadonlyArray<string>;
  onChange: (next: ReadonlyArray<string>) => void;
  disabled?: boolean;
}

/**
 * Two-level region picker for batched manual entries.
 *
 * Step 1: choose a state/province from the project's regions.
 * Step 2: pick one or more counties under that state (CA provinces have a
 *         single "Add province" button — provinces ARE the atom in CA).
 *
 * Selected atoms accumulate across multiple states. The chips list below
 * shows every selection with a remove button.
 */
export function RegionMultiPicker({
  regionCodes,
  selected,
  onChange,
  disabled,
}: RegionMultiPickerProps) {
  const groups = useMemo(
    () => pickerOptionsForRegions(regionCodes),
    [regionCodes],
  );
  const [activeGroup, setActiveGroup] = useState<string>("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const active = groups.find((g) => g.group === activeGroup) ?? null;

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  }

  function addAllInActive() {
    if (!active) return;
    const next = new Set(selectedSet);
    for (const o of active.options) next.add(o.value);
    onChange([...next]);
  }

  function clearAllInActive() {
    if (!active) return;
    const next = new Set(selectedSet);
    for (const o of active.options) next.delete(o.value);
    onChange([...next]);
  }

  function removeOne(value: string) {
    const next = selected.filter((v) => v !== value);
    onChange(next);
  }

  // Lookup helper for chip labels — find the option by value across groups.
  const labelFor = useMemo(() => {
    const m = new Map<string, { label: string; group: string }>();
    for (const g of groups) {
      for (const o of g.options) m.set(o.value, { label: o.label, group: g.group });
    }
    return m;
  }, [groups]);

  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-warning-600/30 bg-warning-50 px-3 py-2 text-[11px] text-warning-700">
        No regions are configured for this project — check the project&apos;s
        settings before adding records.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
          Step 1 — pick a state or province
        </label>
        <select
          value={activeGroup}
          onChange={(e) => setActiveGroup(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        >
          <option value="">Select…</option>
          {groups.map((g) => (
            <option key={g.group} value={g.group}>
              {g.group}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
              Step 2 — counties in {active.group}
            </label>
            {active.options.length > 1 && (
              <div className="flex gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={addAllInActive}
                  disabled={disabled}
                  className="text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
                >
                  Add all
                </button>
                <span className="text-text-300">·</span>
                <button
                  type="button"
                  onClick={clearAllInActive}
                  disabled={disabled}
                  className="text-text-400 hover:text-text-700 hover:underline disabled:opacity-50"
                >
                  Clear {active.group}
                </button>
              </div>
            )}
          </div>
          <div
            className="max-h-48 overflow-y-auto rounded-md border border-surface-3 bg-surface-1 p-2"
            role="listbox"
            aria-multiselectable="true"
            aria-label={`Counties in ${active.group}`}
          >
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
              {active.options.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <li key={o.value}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-xs",
                        checked
                          ? "bg-blue-100 text-blue-800"
                          : "text-text-600 hover:bg-surface-2",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(o.value)}
                        disabled={disabled}
                        className="size-3.5 accent-blue-600"
                      />
                      <span>{o.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
          Selected ({selected.length})
        </label>
        {selected.length === 0 ? (
          <p className="rounded-md border border-dashed border-surface-3 px-3 py-2 text-[11px] text-text-400">
            No counties selected yet — pick a state above to start.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {selected.map((v) => {
              const meta = labelFor.get(v);
              const label = meta
                ? `${meta.label} (${meta.group})`
                : v;
              return (
                <li key={v}>
                  <button
                    type="button"
                    onClick={() => removeOne(v)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800 hover:border-danger-600/40 hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                  >
                    <span>{label}</span>
                    <X className="size-3" aria-hidden />
                    <span className="sr-only">Remove {label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
