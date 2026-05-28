"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, ExternalLink, Flag, X } from "lucide-react";
import { setRecordStatusBatch } from "@/lib/actions/records";
import { SourceChip, type SourceKind } from "@/components/insectid/source-chip";
import { countyLabel } from "@/lib/insectid/regions";
import { cn } from "@/lib/utils";

export type RecordStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "flagged";

export interface RecordsListEntry {
  id: string;
  source: SourceKind;
  externalId: string | null;
  taxonId: string;
  taxonName: string;
  taxonAuthority: string | null;
  countyFips: string | null;
  stateCode: string | null;
  observedAt: string | null;
  collector: string | null;
  status: RecordStatus;
  flagReason: string | null;
  citation: string | null;
}

const STATUS_TONE: Record<RecordStatus, { bg: string; fg: string }> = {
  pending: { bg: "bg-surface-2", fg: "text-text-500" },
  accepted: { bg: "bg-success-50", fg: "text-success-700" },
  rejected: { bg: "bg-danger-50", fg: "text-danger-600" },
  flagged: { bg: "bg-warning-50", fg: "text-warning-700" },
};

function sourceUrl(r: RecordsListEntry): string | null {
  if (!r.externalId) return null;
  if (r.source === "gbif") {
    return `https://www.gbif.org/occurrence/${r.externalId.replace(/^GBIF:/, "")}`;
  }
  if (r.source === "inat") {
    return `https://www.inaturalist.org/observations/${r.externalId.replace(/^iNat:/, "")}`;
  }
  return null;
}

export function RecordsList({
  projectId,
  rows,
  canMutate,
  total,
  page,
  pageSize,
}: {
  projectId: string;
  rows: ReadonlyArray<RecordsListEntry>;
  canMutate: boolean;
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const visibleIds = new Set(rows.map((r) => r.id));
  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of rows) next.delete(r.id);
      } else {
        for (const r of rows) next.add(r.id);
      }
      return next;
    });
  }

  function applyBatch(status: RecordStatus, reason?: string) {
    if (selected.size === 0 || !canMutate) return;
    const ids = Array.from(selected);
    setFeedback(null);
    startTransition(async () => {
      const res = await setRecordStatusBatch(ids, status, reason);
      if (!res.ok) {
        setFeedback(res.error);
        return;
      }
      setFeedback(`${status} · ${ids.length} record${ids.length === 1 ? "" : "s"}`);
      setSelected(new Set());
    });
  }

  function goToPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && canMutate && (
        <div className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-md bg-blue-800 px-4 py-2.5 text-sm text-white shadow-pop">
          <span className="font-bold">
            {selected.size} selected
            {selected.size > rows.length && " (across pages)"}
          </span>
          <div className="flex flex-wrap gap-2">
            <BulkButton
              label="Accept"
              tone="success"
              onClick={() => applyBatch("accepted")}
              disabled={pending}
            />
            <BulkButton
              label="Reject"
              tone="danger"
              onClick={() => applyBatch("rejected", "Bulk rejected via Records view")}
              disabled={pending}
            />
            <BulkButton
              label="Flag"
              tone="warning"
              onClick={() => applyBatch("flagged", "Bulk flagged via Records view")}
              disabled={pending}
            />
            <BulkButton
              label="Clear"
              tone="ghost"
              onClick={() => setSelected(new Set())}
              disabled={pending}
            />
          </div>
        </div>
      )}

      {feedback && (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            feedback.startsWith("accepted") ||
              feedback.startsWith("rejected") ||
              feedback.startsWith("flagged")
              ? "border-success-600/30 bg-success-50 text-success-700"
              : "border-danger-600/30 bg-danger-50 text-danger-600",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-16 text-center text-sm text-text-400">
          No records match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-3 bg-surface-1 text-[10.5px] uppercase tracking-[0.08em] text-text-400">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    disabled={!canMutate}
                    aria-label="Select all rows on this page"
                    className="size-4 accent-blue-600"
                  />
                </th>
                <th className="px-2 py-2 text-left font-bold">Source</th>
                <th className="px-2 py-2 text-left font-bold">Species</th>
                <th className="px-2 py-2 text-left font-bold">County</th>
                <th className="px-2 py-2 text-left font-bold">Date</th>
                <th className="px-2 py-2 text-left font-bold">Collector</th>
                <th className="px-2 py-2 text-left font-bold">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3 text-xs">
              {rows.map((r) => {
                const isSelected = selected.has(r.id);
                const status = STATUS_TONE[r.status];
                const url = sourceUrl(r);
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "transition-colors hover:bg-blue-50/40",
                      isSelected && "bg-blue-50/60",
                    )}
                  >
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(r.id)}
                        disabled={!canMutate}
                        aria-label={`Select record ${r.externalId ?? r.id}`}
                        className="size-4 accent-blue-600"
                      />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-1.5">
                        <SourceChip source={r.source} />
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] text-text-400 hover:text-blue-600"
                            title={`Open on ${r.source === "gbif" ? "gbif.org" : "inaturalist.org"}`}
                          >
                            {r.externalId}
                          </a>
                        ) : (
                          <span className="font-mono text-[10px] text-text-400">
                            {r.externalId ?? "—"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <Link
                        href={`/projects/${projectId}/species/${r.taxonId}`}
                        className="font-bold italic text-text-700 hover:text-blue-700"
                      >
                        {r.taxonName}
                      </Link>
                      {r.taxonAuthority && (
                        <span className="ml-1 text-text-400">{r.taxonAuthority}</span>
                      )}
                    </td>
                    <td
                      className="px-2 py-2 align-middle text-text-600"
                      title={r.countyFips ? `FIPS ${r.countyFips}` : undefined}
                    >
                      {r.countyFips
                        ? (countyLabel(r.countyFips) ?? `FIPS ${r.countyFips}`)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 align-middle text-text-600">
                      {r.observedAt ?? "—"}
                    </td>
                    <td className="px-2 py-2 align-middle text-text-500">
                      {r.collector ?? "—"}
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.06em]",
                          status.bg,
                          status.fg,
                        )}
                        title={r.flagReason ?? undefined}
                      >
                        {r.status === "flagged" && <AlertTriangle className="size-3" aria-hidden />}
                        {r.status === "accepted" && <Check className="size-3" aria-hidden />}
                        {r.status === "rejected" && <X className="size-3" aria-hidden />}
                        {r.status === "flagged" && <Flag className="size-3" aria-hidden />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-300 hover:text-blue-600"
                          aria-label="Open source record"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-text-400">
          <span>
            {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} of {total.toLocaleString()}
            {visibleIds.size > 0 && selected.size > 0 && (
              <span className="ml-2 text-blue-700">
                · {selected.size} selected
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-md border border-surface-3 bg-surface-0 px-3 py-1 font-bold hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="font-mono">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border border-surface-3 bg-surface-0 px-3 py-1 font-bold hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkButton({
  label,
  tone,
  onClick,
  disabled,
}: {
  label: string;
  tone: "success" | "danger" | "warning" | "ghost";
  onClick: () => void;
  disabled: boolean;
}) {
  const toneClass = {
    success: "bg-success-600 hover:bg-success-700 text-white",
    danger: "bg-danger-600 hover:bg-danger-700 text-white",
    warning: "bg-warning-600 hover:bg-warning-700 text-white",
    ghost: "border border-blue-200/40 text-white hover:bg-blue-700",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60",
        toneClass,
      )}
    >
      {label}
    </button>
  );
}
