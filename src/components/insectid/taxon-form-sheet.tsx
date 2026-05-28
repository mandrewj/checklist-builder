"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  addManualTaxon,
  editTaxon,
  type TaxonFormInput,
} from "@/lib/actions/taxa-edit";
import { cn } from "@/lib/utils";

export interface TaxonFormSheetProps {
  projectId: string;
  /** "add" mode: empty form. "edit" mode: prefilled with taxonId + initial values. */
  mode: "add" | "edit";
  taxonId?: string;
  initial?: TaxonFormInput;
  open: boolean;
  onClose: () => void;
}

const RANKS = ["species", "subspecies", "genus", "family", "subfamily"] as const;

export function TaxonFormSheet({
  projectId,
  mode,
  taxonId,
  initial,
  open,
  onClose,
}: TaxonFormSheetProps) {
  const [scientificName, setScientificName] = useState(
    initial?.scientificName ?? "",
  );
  const [authority, setAuthority] = useState(initial?.authority ?? "");
  const [rank, setRank] = useState<string>(initial?.rank ?? "species");
  const [family, setFamily] = useState(initial?.family ?? "");
  const [subfamily, setSubfamily] = useState(initial?.subfamily ?? "");
  const [gbifKey, setGbifKey] = useState(
    initial?.gbifKey ? String(initial.gbifKey) : "",
  );
  const [inatId, setInatId] = useState(
    initial?.inatId ? String(initial.inatId) : "",
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setScientificName(initial?.scientificName ?? "");
    setAuthority(initial?.authority ?? "");
    setRank(initial?.rank ?? "species");
    setFamily(initial?.family ?? "");
    setSubfamily(initial?.subfamily ?? "");
    setGbifKey(initial?.gbifKey ? String(initial.gbifKey) : "");
    setInatId(initial?.inatId ? String(initial.inatId) : "");
    setFeedback(null);
    setDuplicateOf(null);
  }

  function submit() {
    setFeedback(null);
    setDuplicateOf(null);
    const input: TaxonFormInput = {
      scientificName,
      authority: authority || null,
      rank,
      family: family || null,
      subfamily: subfamily || null,
      gbifKey: gbifKey ? Number(gbifKey) : undefined,
      inatId: inatId ? Number(inatId) : undefined,
    };
    startTransition(async () => {
      const res =
        mode === "add"
          ? await addManualTaxon(projectId, input)
          : await editTaxon(taxonId!, input);
      if (res.ok) {
        reset();
        onClose();
        return;
      }
      const dup =
        "existingTaxonId" in res && typeof res.existingTaxonId === "string"
          ? res.existingTaxonId
          : null;
      if (dup) setDuplicateOf(dup);
      setFeedback(res.error);
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-text-700/30"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "add" ? "Add taxon" : "Edit taxon"}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="sheet-enter flex h-full w-full max-w-md flex-col bg-surface-0 shadow-pop">
        <header className="flex items-center justify-between border-b border-surface-3 px-5 py-4">
          <div className="flex flex-col">
            <span className="eyebrow">
              {mode === "add" ? "Add taxon" : "Edit taxon"}
            </span>
            <h2 className="text-base font-bold text-blue-800">
              {mode === "add" ? "New species or taxon" : "Edit species"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-400 hover:bg-surface-2 hover:text-text-700"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <Field label="Scientific name" required>
            <input
              type="text"
              value={scientificName}
              onChange={(e) => setScientificName(e.target.value)}
              placeholder="e.g. Anthicus cervinus"
              disabled={pending}
              className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm italic focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
            <p className="text-[11px] text-text-400">
              Authorship can be entered here too — it gets parsed into the
              authority field automatically. Paste &ldquo;Anthicus cervinus
              LaFerté-Sénectère, 1849&rdquo; if that&apos;s easier.
            </p>
          </Field>
          <Field label="Authority">
            <input
              type="text"
              value={authority}
              onChange={(e) => setAuthority(e.target.value)}
              placeholder="e.g. LaFerté-Sénectère, 1849"
              disabled={pending}
              className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </Field>
          <Field label="Rank">
            <select
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              disabled={pending}
              className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            >
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Family">
              <input
                type="text"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="Anthicidae"
                disabled={pending}
                className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </Field>
            <Field label="Subfamily">
              <input
                type="text"
                value={subfamily}
                onChange={(e) => setSubfamily(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </Field>
          </div>
          <details className="rounded-md border border-surface-3 bg-surface-1 px-3 py-2">
            <summary className="flex cursor-pointer items-center justify-between text-xs font-bold uppercase tracking-[0.06em] text-text-500">
              External IDs <span className="text-text-400">(optional)</span>
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="GBIF key">
                <input
                  type="number"
                  value={gbifKey}
                  onChange={(e) => setGbifKey(e.target.value)}
                  placeholder="e.g. 7771"
                  disabled={pending}
                  className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </Field>
              <Field label="iNat taxon ID">
                <input
                  type="number"
                  value={inatId}
                  onChange={(e) => setInatId(e.target.value)}
                  placeholder="e.g. 85586"
                  disabled={pending}
                  className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </Field>
            </div>
          </details>

          {feedback && (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-xs",
                duplicateOf
                  ? "border-warning-600/30 bg-warning-50 text-warning-700"
                  : "border-danger-600/30 bg-danger-50 text-danger-600",
              )}
              role="alert"
            >
              <p>{feedback}</p>
              {duplicateOf && (
                <p className="mt-1">
                  Use the{" "}
                  <Link
                    href={`/projects/${projectId}/checklist`}
                    onClick={onClose}
                    className="font-bold underline"
                  >
                    Checklist
                  </Link>
                  {" "}to select both taxa and merge them.
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-surface-3 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={pending}
            className="rounded-md border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-bold text-text-600 hover:bg-surface-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !scientificName.trim()}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-bold text-white shadow-card hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Saving…"
              : mode === "add"
                ? "Add taxon"
                : "Save changes"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
        {label}
        {required && <span className="ml-1 text-danger-600">*</span>}
      </span>
      {children}
    </label>
  );
}
