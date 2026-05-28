"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  TaxonFormSheet,
} from "@/components/insectid/taxon-form-sheet";
import type { TaxonFormInput } from "@/lib/actions/taxa-edit";

export function EditTaxonButton({
  projectId,
  taxonId,
  initial,
  disabled,
}: {
  projectId: string;
  taxonId: string;
  initial: TaxonFormInput;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-md border border-surface-3 bg-surface-0 px-2 py-1 text-[11px] font-bold text-text-600 hover:bg-surface-1 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        title="Edit name, authority, family, or external IDs"
      >
        <Pencil className="size-3" aria-hidden />
        Edit
      </button>
      <TaxonFormSheet
        projectId={projectId}
        mode="edit"
        taxonId={taxonId}
        initial={initial}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
