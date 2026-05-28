"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  addManualRecord,
  addManualRecordWithNewTaxon,
} from "@/lib/actions/manual-entries";
import { RegionMultiPicker } from "@/components/insectid/region-multi-picker";
import { cn } from "@/lib/utils";

export interface TaxonOption {
  id: string;
  scientificName: string;
}

export interface AddCiteOnlySheetProps {
  projectId: string;
  taxa: ReadonlyArray<TaxonOption>;
  /** Project's regionCodes — drives the state→counties cascade. */
  regionCodes: ReadonlyArray<string>;
  canMutate: boolean;
}

type Mode = "existing" | "new";

export function AddCiteOnlySheet({
  projectId,
  taxa,
  regionCodes,
  canMutate,
}: AddCiteOnlySheetProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("existing");

  // Existing-taxon mode
  const [taxonId, setTaxonId] = useState<string>("");

  // New-taxon mode
  const [newName, setNewName] = useState<string>("");
  const [newAuthority, setNewAuthority] = useState<string>("");
  const [newFamily, setNewFamily] = useState<string>("");

  // Shared fields — selected region atoms are an array now.
  const [selectedAtoms, setSelectedAtoms] = useState<ReadonlyArray<string>>([]);
  const [citation, setCitation] = useState<string>("");
  const [doi, setDoi] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMode("existing");
    setTaxonId("");
    setNewName("");
    setNewAuthority("");
    setNewFamily("");
    setSelectedAtoms([]);
    setCitation("");
    setDoi("");
    setNotes("");
    setFeedback(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function submit() {
    if (selectedAtoms.length === 0 || !citation.trim()) {
      setFeedback("At least one county and a citation are required.");
      return;
    }
    if (mode === "existing" && !taxonId) {
      setFeedback("Pick a taxon, or switch to “Create new taxon”.");
      return;
    }
    if (mode === "new" && !newName.trim()) {
      setFeedback("Scientific name is required for a new taxon.");
      return;
    }
    setFeedback(null);

    startTransition(async () => {
      const res =
        mode === "existing"
          ? await addManualRecord({
              projectId,
              taxonId,
              countyFips: selectedAtoms,
              citation,
              doi: doi || undefined,
              notes: notes || undefined,
            })
          : await addManualRecordWithNewTaxon({
              projectId,
              newTaxon: {
                scientificName: newName,
                authority: newAuthority || undefined,
                family: newFamily || undefined,
              },
              countyFips: selectedAtoms,
              citation,
              doi: doi || undefined,
              notes: notes || undefined,
            });

      if (res.ok) {
        close();
        return;
      }

      // New-taxon mode: if the canonical already exists, flip to existing
      // mode and preselect the existing taxon.
      const existingTaxonId =
        "existingTaxonId" in res
          ? (res as { existingTaxonId?: string }).existingTaxonId
          : undefined;
      if (mode === "new" && existingTaxonId) {
        setMode("existing");
        setTaxonId(existingTaxonId);
        setFeedback(
          "That name is already in this project — attaching to the existing taxon. Press Save again to confirm.",
        );
        return;
      }
      setFeedback(res.error);
    });
  }

  const disableSave =
    pending ||
    selectedAtoms.length === 0 ||
    !citation.trim() ||
    (mode === "existing" ? !taxonId : !newName.trim());

  const saveLabel = pending
    ? "Saving…"
    : mode === "new"
      ? selectedAtoms.length > 1
        ? `Create taxon + save ${selectedAtoms.length} records`
        : "Create taxon + save record"
      : selectedAtoms.length > 1
        ? `Save ${selectedAtoms.length} records`
        : "Save record";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canMutate}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="size-4" aria-hidden />
        Add cite-only
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-text-700/30"
          role="dialog"
          aria-modal="true"
          aria-label="Add cite-only record"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <aside className="sheet-enter flex h-full w-full max-w-md flex-col bg-surface-0 shadow-pop">
            <header className="flex items-center justify-between border-b border-surface-3 px-5 py-4">
              <div className="flex flex-col">
                <span className="eyebrow">Manual entry</span>
                <h2 className="text-base font-bold text-blue-800">
                  Add cite-only record
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-text-400 hover:bg-surface-2 hover:text-text-700"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
              {/* Taxon mode toggle */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
                  Taxon
                </span>
                <div
                  role="tablist"
                  aria-label="Taxon source"
                  className="inline-flex self-start rounded-md border border-surface-3 bg-surface-1 p-0.5 text-xs"
                >
                  <ModeTab
                    active={mode === "existing"}
                    onClick={() => setMode("existing")}
                  >
                    Pick existing
                  </ModeTab>
                  <ModeTab
                    active={mode === "new"}
                    onClick={() => setMode("new")}
                  >
                    + Create new taxon
                  </ModeTab>
                </div>
              </div>

              {mode === "existing" ? (
                <Field label="Existing taxon" required>
                  <select
                    value={taxonId}
                    onChange={(e) => setTaxonId(e.target.value)}
                    disabled={pending}
                    className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  >
                    <option value="">Select a species…</option>
                    {taxa.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.scientificName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="Scientific name" required>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Tenebrio molitor"
                      disabled={pending}
                      className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm italic focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </Field>
                  <Field label="Authority">
                    <input
                      type="text"
                      value={newAuthority}
                      onChange={(e) => setNewAuthority(e.target.value)}
                      placeholder="e.g. (Linnaeus, 1758)"
                      disabled={pending}
                      className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                    <span className="text-[11px] text-text-400">
                      Leave blank to use whatever GBIF returns.
                    </span>
                  </Field>
                  <Field label="Family">
                    <input
                      type="text"
                      value={newFamily}
                      onChange={(e) => setNewFamily(e.target.value)}
                      placeholder="e.g. Tenebrionidae"
                      disabled={pending}
                      className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </Field>
                  <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
                    GBIF + iNat IDs will be auto-resolved from the scientific
                    name when you save.
                  </p>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
                  Regions <span className="ml-1 text-danger-600">*</span>
                </span>
                <RegionMultiPicker
                  regionCodes={regionCodes}
                  selected={selectedAtoms}
                  onChange={setSelectedAtoms}
                  disabled={pending}
                />
                <p className="text-[11px] text-text-400">
                  One citation, attached to every selected county/province.
                </p>
              </div>

              <Field label="Citation" required>
                <textarea
                  value={citation}
                  onChange={(e) => setCitation(e.target.value)}
                  rows={4}
                  placeholder="e.g. Blatchley, W.S. (1910). An Illustrated Descriptive Catalogue of the Coleoptera of Indiana. Indianapolis: The Nature Publishing Company."
                  disabled={pending}
                  className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </Field>

              <Field label="DOI">
                <input
                  type="text"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.5281/zenodo.4456789"
                  disabled={pending}
                  className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </Field>

              <Field label="Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Voucher details, page reference, etc."
                  disabled={pending}
                  className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                />
              </Field>

              {feedback && (
                <p
                  className={cn(
                    "rounded-md px-3 py-2 text-xs",
                    "border border-danger-600/30 bg-danger-50 text-danger-600",
                  )}
                  role="alert"
                >
                  {feedback}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-surface-3 px-5 py-3">
              <button
                type="button"
                onClick={close}
                disabled={pending}
                className="rounded-md border border-surface-3 bg-surface-0 px-3 py-1.5 text-sm font-bold text-text-600 hover:bg-surface-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={disableSave}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveLabel}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded px-2.5 py-1 font-bold transition-colors",
        active
          ? "bg-surface-0 text-blue-700 shadow-card"
          : "text-text-500 hover:text-text-700",
      )}
    >
      {children}
    </button>
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
