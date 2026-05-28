"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, ExternalLink, Flag, X } from "lucide-react";
import { SourceChip } from "@/components/insectid/source-chip";
import {
  setRecordStatus,
  setRecordStatusBatch,
} from "@/lib/actions/records";
import { countyLabel } from "@/lib/insectid/regions";
import { cn } from "@/lib/utils";
import type { TriageRecord, TriageRecordStatus } from "./triage-shape";

type RecordStatus = TriageRecordStatus;

export interface TriageControllerProps {
  records: ReadonlyArray<TriageRecord>;
  canMutate: boolean;
  disabledReason?: string;
}

const STATUS_TONE: Record<RecordStatus, { bg: string; fg: string }> = {
  pending:  { bg: "bg-surface-2",  fg: "text-text-500" },
  accepted: { bg: "bg-success-50", fg: "text-success-700" },
  rejected: { bg: "bg-danger-50",  fg: "text-danger-600" },
  flagged:  { bg: "bg-warning-50", fg: "text-warning-700" },
};

/** Build the source-website URL for a record's externalId. */
function sourceUrl(r: TriageRecord): string | null {
  if (!r.externalId) return null;
  if (r.source === "gbif") {
    const key = r.externalId.replace(/^GBIF:/, "");
    return `https://www.gbif.org/occurrence/${key}`;
  }
  if (r.source === "inat") {
    const id = r.externalId.replace(/^iNat:/, "");
    return `https://www.inaturalist.org/observations/${id}`;
  }
  return null;
}

export function TriageController({
  records,
  canMutate,
  disabledReason,
}: TriageControllerProps) {
  const [focusIdx, setFocusIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const cardRefs = useRef<Array<HTMLLIElement | null>>([]);

  const scrollFocused = useCallback((idx: number) => {
    cardRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  function applyToCurrent(status: RecordStatus, flagReason?: string) {
    const target = records[focusIdx];
    if (!target || !canMutate) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await setRecordStatus(target.id, status, flagReason);
      if (!res.ok) setFeedback(res.error);
      else setFeedback(`${status} · ${target.externalId ?? target.id}`);
    });
  }

  function applyToSelection(status: RecordStatus, flagReason?: string) {
    if (!canMutate || selected.size === 0) return;
    const ids = Array.from(selected);
    setFeedback(null);
    startTransition(async () => {
      const res = await setRecordStatusBatch(ids, status, flagReason);
      if (!res.ok) setFeedback(res.error);
      else {
        setFeedback(`${status} · ${ids.length} record${ids.length === 1 ? "" : "s"}`);
        setSelected(new Set());
      }
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOutOfRange() {
    const next = new Set(
      records.filter((r) => r.isLikelyOutOfRange).map((r) => r.id),
    );
    setSelected(next);
  }

  // Keyboard handler — J/K nav, A/R/F/S/X.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when the user is typing in an input/textarea.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (records.length === 0) return;
      let handled = true;
      switch (e.key.toLowerCase()) {
        case "j":
          setFocusIdx((i) => {
            const next = Math.min(i + 1, records.length - 1);
            scrollFocused(next);
            return next;
          });
          break;
        case "k":
          setFocusIdx((i) => {
            const next = Math.max(i - 1, 0);
            scrollFocused(next);
            return next;
          });
          break;
        case "a":
          applyToCurrent("accepted");
          break;
        case "r":
          applyToCurrent("rejected");
          break;
        case "f":
          applyToCurrent("flagged", "Flagged via triage keyboard shortcut");
          break;
        case "x": {
          const id = records[focusIdx]?.id;
          if (id) toggleSelected(id);
          break;
        }
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, focusIdx, canMutate]);

  const outOfRangeCount = useMemo(
    () => records.filter((r) => r.isLikelyOutOfRange).length,
    [records],
  );

  if (records.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-surface-3 px-6 py-10 text-center text-sm text-text-400">
        No records yet.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <KeyboardHints />

      {outOfRangeCount > 0 && canMutate && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-2 text-xs text-warning-700">
          <span>
            <strong className="font-bold">{outOfRangeCount} record{outOfRangeCount === 1 ? "" : "s"}</strong>{" "}
            flagged as likely out of stated range during ingest.
          </span>
          <button
            type="button"
            onClick={selectAllOutOfRange}
            className="rounded-md border border-warning-600/40 bg-surface-0 px-2 py-1 font-bold text-warning-700 hover:bg-warning-50"
          >
            Select all {outOfRangeCount}
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-md bg-blue-800 px-4 py-2.5 text-sm text-white shadow-pop">
          <span className="font-bold">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <BulkButton
              tone="success"
              label="Accept"
              onClick={() => applyToSelection("accepted")}
              disabled={pending}
            />
            <BulkButton
              tone="danger"
              label="Reject"
              onClick={() => applyToSelection("rejected", "Out of stated range")}
              disabled={pending}
            />
            <BulkButton
              tone="warning"
              label="Flag"
              onClick={() => applyToSelection("flagged", "Needs review")}
              disabled={pending}
            />
            <BulkButton
              tone="ghost"
              label="Clear"
              onClick={() => setSelected(new Set())}
              disabled={pending}
            />
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2" role="list">
        {records.map((r, idx) => {
          const isFocused = idx === focusIdx;
          const isSelected = selected.has(r.id);
          const statusTone = STATUS_TONE[r.status];
          return (
            <li
              key={r.id}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-surface-0 px-4 py-3 text-sm transition-all",
                isFocused
                  ? "border-blue-600 shadow-pop ringed"
                  : "border-surface-3 shadow-card",
                isSelected && "bg-blue-50/40",
              )}
              onClick={() => setFocusIdx(idx)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(r.id)}
                disabled={!canMutate}
                aria-label={`Select record ${r.externalId ?? r.id}`}
                className="mt-1.5 size-4 shrink-0 accent-blue-600"
              />

              <div className="flex w-32 shrink-0 items-center justify-center">
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='80'><rect width='100%' height='100%' fill='%23E5E7EB'/></svg>"
                    alt=""
                    aria-hidden
                    className="h-20 w-32 rounded-md object-cover"
                  />
                ) : (
                  <div
                    className={cn(
                      "stripes h-20 w-32 rounded-md",
                      r.source === "cite" && "checker-bg",
                    )}
                    aria-hidden
                  />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceChip source={r.source} />
                  {(() => {
                    const url = sourceUrl(r);
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="group/sourcelink inline-flex items-center gap-1 font-mono text-xs text-text-400 hover:text-blue-600"
                        title={`Open on ${r.source === "gbif" ? "gbif.org" : "inaturalist.org"}`}
                      >
                        {r.externalId}
                        <ExternalLink
                          className="size-3 opacity-0 transition-opacity group-hover/sourcelink:opacity-100"
                          aria-hidden
                        />
                      </a>
                    ) : (
                      <span className="text-xs font-mono text-text-400">
                        {r.externalId ?? r.id}
                      </span>
                    );
                  })()}
                  <span
                    className={cn(
                      "ml-auto inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.06em]",
                      statusTone.bg,
                      statusTone.fg,
                    )}
                    title={r.flagReason ?? undefined}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-text-500">
                  {r.countyFips && (
                    <span title={`FIPS ${r.countyFips}`}>
                      {countyLabel(r.countyFips) ?? `FIPS ${r.countyFips}`}
                    </span>
                  )}
                  {r.observedAt && <span>{r.observedAt}</span>}
                  {r.collector && <span>by {r.collector}</span>}
                </div>
                {r.isLikelyOutOfRange && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warning-700">
                    <AlertTriangle className="size-3" aria-hidden />
                    Likely out of stated range
                  </span>
                )}
                {r.flagReason && (
                  <span className="text-[11px] text-warning-700">
                    Flag reason: {r.flagReason}
                  </span>
                )}
                {r.citation && (
                  <span className="text-[11px] italic text-cyan-600">
                    {r.citation}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <PerRecordButton
                  label="Accept"
                  icon={Check}
                  tone="success"
                  hotkey="A"
                  active={r.status === "accepted"}
                  onClick={() => {
                    setFocusIdx(idx);
                    startTransition(async () => {
                      const res = await setRecordStatus(r.id, "accepted");
                      if (!res.ok) setFeedback(res.error);
                    });
                  }}
                  disabled={!canMutate || pending}
                />
                <PerRecordButton
                  label="Reject"
                  icon={X}
                  tone="danger"
                  hotkey="R"
                  active={r.status === "rejected"}
                  onClick={() => {
                    setFocusIdx(idx);
                    startTransition(async () => {
                      const res = await setRecordStatus(r.id, "rejected", "rejected via triage");
                      if (!res.ok) setFeedback(res.error);
                    });
                  }}
                  disabled={!canMutate || pending}
                />
                <PerRecordButton
                  label="Flag"
                  icon={Flag}
                  tone="warning"
                  hotkey="F"
                  active={r.status === "flagged"}
                  onClick={() => {
                    setFocusIdx(idx);
                    startTransition(async () => {
                      const res = await setRecordStatus(r.id, "flagged", "flagged via triage");
                      if (!res.ok) setFeedback(res.error);
                    });
                  }}
                  disabled={!canMutate || pending}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-surface-3 pt-3 text-xs">
        <span className="text-text-400">
          {records.length} records · viewing #{focusIdx + 1}
        </span>
        <span
          className={cn(
            "text-xs",
            feedback?.startsWith("error") || (feedback && !canMutate)
              ? "text-danger-600"
              : "text-success-700",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback ?? (!canMutate ? disabledReason ?? "Read only" : " ")}
        </span>
      </div>
    </div>
  );
}

function KeyboardHints() {
  const keys: Array<[string, string]> = [
    ["J / K", "Next / prev record"],
    ["A", "Accept"],
    ["R", "Reject"],
    ["F", "Flag"],
    ["X", "Toggle select"],
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-surface-3 bg-surface-1 px-4 py-2 text-[11px] text-text-500">
      {keys.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <kbd>{k}</kbd>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function PerRecordButton({
  label,
  icon: Icon,
  tone,
  hotkey,
  active,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof Check;
  tone: "success" | "danger" | "warning";
  hotkey: string;
  active: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const toneClass = {
    success: active
      ? "border-success-600 bg-success-50 text-success-700"
      : "border-surface-3 text-text-500 hover:border-success-600/40 hover:text-success-700",
    danger: active
      ? "border-danger-600 bg-danger-50 text-danger-600"
      : "border-surface-3 text-text-500 hover:border-danger-600/40 hover:text-danger-600",
    warning: active
      ? "border-warning-600 bg-warning-50 text-warning-700"
      : "border-surface-3 text-text-500 hover:border-warning-600/40 hover:text-warning-700",
  }[tone];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        toneClass,
      )}
      title={`${label} (${hotkey})`}
    >
      <Icon className="size-3" aria-hidden />
      {label}
      <kbd className="ml-1 !h-4 !min-w-4 !px-1 !text-[9px]">{hotkey}</kbd>
    </button>
  );
}

function BulkButton({
  tone,
  label,
  onClick,
  disabled,
}: {
  tone: "success" | "danger" | "warning" | "ghost";
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  const toneClass = {
    success: "bg-success-600 hover:bg-success-700 text-white",
    danger: "bg-danger-600 hover:bg-danger-700 text-white",
    warning: "bg-warning-600 hover:bg-warning-700 text-white",
    ghost: "bg-blue-700 hover:bg-blue-900 text-white",
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
