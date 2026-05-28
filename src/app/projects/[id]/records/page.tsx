import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { Filter } from "lucide-react";
import { db } from "@/lib/db/client";
import { records, taxa } from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { FilterChip } from "@/components/insectid/filter-chip";
import {
  RecordsList,
  type RecordsListEntry,
  type RecordStatus,
} from "./records-list";
import type { SourceKind } from "@/components/insectid/source-chip";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// records.source is an enum without "merged" (which is a taxa-only state).
type RecordSource = Exclude<SourceKind, "merged">;

const STATUS_VALUES: ReadonlyArray<RecordStatus> = [
  "pending",
  "accepted",
  "rejected",
  "flagged",
];
const SOURCE_VALUES: ReadonlyArray<RecordSource> = [
  "gbif",
  "inat",
  "manual",
  "cite",
];

interface RecordsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function paramOf(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function RecordsPage({
  params,
  searchParams,
}: RecordsPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const statusFilter = paramOf(sp, "status") as RecordStatus | undefined;
  const sourceFilter = paramOf(sp, "source") as RecordSource | undefined;
  const taxonFilter = paramOf(sp, "taxon");
  const q = (paramOf(sp, "q") ?? "").trim();
  const page = Math.max(1, Number(paramOf(sp, "page") ?? "1"));

  const conditions = [eq(records.projectId, id)];
  if (statusFilter && STATUS_VALUES.includes(statusFilter)) {
    conditions.push(eq(records.status, statusFilter));
  }
  if (sourceFilter && SOURCE_VALUES.includes(sourceFilter)) {
    conditions.push(eq(records.source, sourceFilter));
  }
  if (taxonFilter) {
    conditions.push(eq(records.taxonId, taxonFilter));
  }
  // Free-text q hits collector OR externalId.
  if (q) {
    const wildcard = `%${q}%`;
    const orClause = or(
      ilike(records.collector, wildcard),
      ilike(records.externalId, wildcard),
    );
    if (orClause) conditions.push(orClause);
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  // ---------- Queries (parallel) ----------
  const [
    membership,
    [{ n: totalRecords }],
    statusBreakdown,
    sourceBreakdown,
    taxaForFilter,
    rowsRaw,
  ] = await Promise.all([
    getMembership(id),
    db.select({ n: count() }).from(records).where(where),
    db
      .select({ status: records.status, n: count() })
      .from(records)
      .where(eq(records.projectId, id))
      .groupBy(records.status),
    db
      .select({ source: records.source, n: count() })
      .from(records)
      .where(eq(records.projectId, id))
      .groupBy(records.source),
    db
      .select({ id: taxa.id, scientificName: taxa.scientificName })
      .from(taxa)
      .where(eq(taxa.projectId, id))
      .orderBy(asc(taxa.scientificName)),
    db
      .select({
        id: records.id,
        source: records.source,
        externalId: records.externalId,
        taxonId: records.taxonId,
        taxonName: taxa.scientificName,
        taxonAuthority: taxa.authority,
        countyFips: records.countyFips,
        stateCode: records.stateCode,
        observedAt: records.observedAt,
        collector: records.collector,
        status: records.status,
        flagReason: records.flagReason,
        citation: records.citation,
      })
      .from(records)
      .innerJoin(taxa, eq(taxa.id, records.taxonId))
      .where(where)
      .orderBy(desc(records.observedAt), asc(records.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const canMutate =
    membership?.role === "Lead" || membership?.role === "Contributor";

  const rows: RecordsListEntry[] = rowsRaw.map((r) => ({
    id: r.id,
    source: r.source as SourceKind,
    externalId: r.externalId,
    taxonId: r.taxonId,
    taxonName: r.taxonName,
    taxonAuthority: r.taxonAuthority,
    countyFips: r.countyFips,
    stateCode: r.stateCode,
    observedAt: r.observedAt,
    collector: r.collector,
    status: r.status,
    flagReason: r.flagReason,
    citation: r.citation,
  }));

  const statusCounts = Object.fromEntries(
    statusBreakdown.map((r) => [r.status, r.n]),
  ) as Partial<Record<RecordStatus, number>>;
  const sourceCounts = Object.fromEntries(
    sourceBreakdown.map((r) => [r.source, r.n]),
  ) as Partial<Record<SourceKind, number>>;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Records"
        title="Cross-taxon records"
        description={`${totalRecords.toLocaleString()} record${totalRecords === 1 ? "" : "s"} match the current filters. Bulk-select rows for batch triage.`}
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        {/* Status filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-text-400" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
            Status
          </span>
          <FilterChip
            label="All"
            param="status"
            value={null}
            active={!statusFilter}
          />
          {STATUS_VALUES.map((s) => (
            <FilterChip
              key={s}
              label={s}
              count={statusCounts[s] ?? 0}
              param="status"
              value={s}
              active={statusFilter === s}
            />
          ))}
        </div>

        {/* Source filter row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-4 shrink-0" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
            Source
          </span>
          <FilterChip
            label="All"
            param="source"
            value={null}
            active={!sourceFilter}
          />
          {SOURCE_VALUES.map((s) => (
            <FilterChip
              key={s}
              label={s}
              count={sourceCounts[s] ?? 0}
              param="source"
              value={s}
              active={sourceFilter === s}
            />
          ))}
        </div>

        {/* Taxon filter (only show if there are 2+ taxa) */}
        {taxaForFilter.length >= 2 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="size-4 shrink-0" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
              Species
            </span>
            <FilterChip
              label="All"
              param="taxon"
              value={null}
              active={!taxonFilter}
            />
            {taxaForFilter.slice(0, 12).map((t) => (
              <FilterChip
                key={t.id}
                label={t.scientificName}
                param="taxon"
                value={t.id}
                active={taxonFilter === t.id}
              />
            ))}
            {taxaForFilter.length > 12 && (
              <span className="text-[11px] text-text-400">
                + {taxaForFilter.length - 12} more · use the filter URL{" "}
                <code className="rounded bg-surface-2 px-1 font-mono">?taxon=&lt;id&gt;</code>
              </span>
            )}
          </div>
        )}

        <RecordsList
          projectId={id}
          rows={rows}
          canMutate={canMutate}
          total={totalRecords}
          page={page}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}
