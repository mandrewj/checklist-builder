/**
 * Shared (no "use client") TriageRecord shape + conversion. The
 * TriageController consumes this; the server page produces it.
 */

import type { RecordRow } from "@/lib/db/schema";
import type { SourceKind } from "@/components/insectid/source-chip";

export type TriageRecordStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "flagged";

export interface TriageRecord {
  id: string;
  source: SourceKind;
  externalId: string | null;
  countyFips: string | null;
  observedAt: string | null;
  collector: string | null;
  status: TriageRecordStatus;
  flagReason: string | null;
  imageUrl: string | null;
  citation: string | null;
  isLikelyOutOfRange?: boolean;
}

export function toTriageRecords(
  rows: ReadonlyArray<RecordRow>,
  hints: Partial<Record<string, { isLikelyOutOfRange?: boolean }>> = {},
): TriageRecord[] {
  return rows.map((r) => ({
    id: r.id,
    source: r.source as SourceKind,
    externalId: r.externalId,
    countyFips: r.countyFips,
    observedAt: r.observedAt,
    collector: r.collector,
    status: r.status,
    flagReason: r.flagReason,
    imageUrl: r.imageUrl,
    citation: r.citation,
    isLikelyOutOfRange: hints[r.id]?.isLikelyOutOfRange,
  }));
}
