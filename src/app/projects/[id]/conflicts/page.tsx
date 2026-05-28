import Link from "next/link";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  taxa,
  taxonConflicts,
} from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { FilterChip } from "@/components/insectid/filter-chip";
import { ConflictResolver } from "./conflict-resolver";

export const dynamic = "force-dynamic";

interface ConflictsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type StatusFilter = "open" | "resolved" | "all";

export default async function ConflictsPage({
  params,
  searchParams,
}: ConflictsPageProps) {
  const { id: projectId } = await params;
  const sp = await searchParams;
  const status = ((Array.isArray(sp.status) ? sp.status[0] : sp.status) ??
    "open") as StatusFilter;

  const membership = await getMembership(projectId);
  const canMutate =
    membership?.role === "Lead" || membership?.role === "Contributor";

  const conflictRows = await db
    .select({
      conflict: taxonConflicts,
      taxonScientificName: taxa.scientificName,
    })
    .from(taxonConflicts)
    .leftJoin(taxa, eq(taxa.id, taxonConflicts.taxonId))
    .where(
      and(
        eq(taxonConflicts.projectId, projectId),
        status === "open"
          ? isNull(taxonConflicts.resolution)
          : status === "resolved"
            ? isNotNull(taxonConflicts.resolution)
            : undefined,
      ),
    )
    .orderBy(asc(taxonConflicts.gbifName));

  const allCounts = await db
    .select({ resolution: taxonConflicts.resolution })
    .from(taxonConflicts)
    .where(eq(taxonConflicts.projectId, projectId));

  const openCount = allCounts.filter((c) => c.resolution === null).length;
  const resolvedCount = allCounts.length - openCount;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Conflicts"
        title="Taxonomic conflicts"
        description="GBIF and iNaturalist disagree on the name for these concepts. Pick a resolution per row — no default is pre-selected. Resolved rows are kept in the activity log."
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
            Filter
          </span>
          <FilterChip
            label="Open"
            count={openCount}
            param="status"
            value="open"
            active={status === "open"}
          />
          <FilterChip
            label="Resolved"
            count={resolvedCount}
            param="status"
            value="resolved"
            active={status === "resolved"}
          />
          <FilterChip
            label="All"
            count={openCount + resolvedCount}
            param="status"
            value="all"
            active={status === "all"}
          />
        </div>

        {conflictRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-16 text-center text-sm text-text-400">
            {status === "open"
              ? "All conflicts resolved. Nothing to triage."
              : "No conflicts match these filters."}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {conflictRows.map(({ conflict, taxonScientificName }) => (
              <li key={conflict.id}>
                <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
                  <h2 className="text-sm font-bold text-blue-800">
                    {conflict.gbifName}{" "}
                    <span className="text-text-400">↔</span>{" "}
                    {conflict.inatName}
                  </h2>
                  {conflict.taxonId && taxonScientificName && (
                    <Link
                      href={`/projects/${projectId}/species/${conflict.taxonId}`}
                      className="text-[11px] font-bold uppercase tracking-[0.08em] text-blue-600 hover:text-blue-700"
                    >
                      Open species →
                    </Link>
                  )}
                </div>
                <ConflictResolver
                  conflictId={conflict.id}
                  gbifName={conflict.gbifName}
                  gbifAuthority={conflict.gbifAuthority}
                  gbifRecords={conflict.gbifRecords}
                  inatName={conflict.inatName}
                  inatAuthority={conflict.inatAuthority}
                  inatRecords={conflict.inatRecords}
                  note={conflict.note}
                  currentResolution={conflict.resolution}
                  currentCustomName={conflict.customName}
                  canMutate={canMutate}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
