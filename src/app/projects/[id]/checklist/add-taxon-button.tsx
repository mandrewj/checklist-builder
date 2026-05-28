"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TaxonFormSheet } from "@/components/insectid/taxon-form-sheet";

export function AddTaxonButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus className="size-4" aria-hidden />
        Add species
      </button>
      <TaxonFormSheet
        projectId={projectId}
        mode="add"
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
