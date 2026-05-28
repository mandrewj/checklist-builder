import { and, asc, count, eq, isNull } from "drizzle-orm";
import { Filter } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  countyPresence,
  projects,
  records,
  taxa,
  taxonConflicts,
} from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { FilterChip } from "@/components/insectid/filter-chip";
import { type SourceKind } from "@/components/insectid/source-chip";
import { MergeController, type ChecklistEntry } from "./merge-controller";
import { AddTaxonButton } from "./add-taxon-button";

export const dynamic = "force-dynamic";

type InclusionParam = "include" | "exclude" | "undecided" | "all";

interface ChecklistPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ChecklistPage({
  params,
  searchParams,
}: ChecklistPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const inclusion = ((Array.isArray(sp.inclusion) ? sp.inclusion[0] : sp.inclusion) ??
    "all") as InclusionParam;
  const conflictOnly =
    (Array.isArray(sp.conflict) ? sp.conflict[0] : sp.conflict) === "1";
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().toLowerCase();

  // ---------- Queries (kept parallel) ----------
  const [
    project,
    membership,
    taxaRows,
    openConflictsByTaxon,
    recordsByTaxonSource,
    recordCountsByTaxon,
    presenceRows,
    inclusionBreakdown,
  ] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, id) }),
    getMembership(id),
    db
      .select()
      .from(taxa)
      .where(eq(taxa.projectId, id))
      .orderBy(asc(taxa.scientificName)),
    db
      .select({ taxonId: taxonConflicts.taxonId, n: count() })
      .from(taxonConflicts)
      .where(
        and(
          eq(taxonConflicts.projectId, id),
          isNull(taxonConflicts.resolution),
        ),
      )
      .groupBy(taxonConflicts.taxonId),
    db
      .selectDistinct({ taxonId: records.taxonId, source: records.source })
      .from(records)
      .where(eq(records.projectId, id)),
    db
      .select({ taxonId: records.taxonId, n: count() })
      .from(records)
      .where(eq(records.projectId, id))
      .groupBy(records.taxonId),
    db
      .select({
        taxonId: countyPresence.taxonId,
        countyFips: countyPresence.countyFips,
        nRecords: countyPresence.nRecords,
      })
      .from(countyPresence)
      .where(eq(countyPresence.projectId, id)),
    db
      .select({ included: taxa.included, n: count() })
      .from(taxa)
      .where(eq(taxa.projectId, id))
      .groupBy(taxa.included),
  ]);

  const canMutate =
    membership?.role === "Lead" || membership?.role === "Contributor";

  // ---------- Assemble per-taxon rows ----------
  const conflictTaxa = new Set(
    openConflictsByTaxon
      .map((c) => c.taxonId)
      .filter((tid): tid is string => !!tid),
  );
  const sourcesByTaxon = new Map<string, Set<SourceKind>>();
  for (const r of recordsByTaxonSource) {
    if (!sourcesByTaxon.has(r.taxonId)) sourcesByTaxon.set(r.taxonId, new Set());
    sourcesByTaxon.get(r.taxonId)!.add(r.source as SourceKind);
  }
  const recordCounts = new Map(recordCountsByTaxon.map((r) => [r.taxonId, r.n]));
  const presenceByTaxon = new Map<string, Record<string, number>>();
  const countiesByTaxon = new Map<string, number>();
  for (const row of presenceRows) {
    if (!presenceByTaxon.has(row.taxonId))
      presenceByTaxon.set(row.taxonId, {});
    presenceByTaxon.get(row.taxonId)![row.countyFips] = row.nRecords;
    countiesByTaxon.set(row.taxonId, (countiesByTaxon.get(row.taxonId) ?? 0) + 1);
  }

  const allRows: ChecklistEntry[] = taxaRows.map((t) => ({
    id: t.id,
    scientificName: t.scientificName,
    authority: t.authority,
    family: t.family,
    subfamily: t.subfamily,
    included: t.included,
    sources: Array.from(sourcesByTaxon.get(t.id) ?? []),
    hasConflict: conflictTaxa.has(t.id),
    nRecords: recordCounts.get(t.id) ?? 0,
    nCounties: countiesByTaxon.get(t.id) ?? 0,
    presence: presenceByTaxon.get(t.id) ?? {},
  }));

  // ---------- Apply filters ----------
  const visible = allRows.filter((r) => {
    if (inclusion !== "all" && r.included !== inclusion) return false;
    if (conflictOnly && !r.hasConflict) return false;
    if (q && !r.scientificName.toLowerCase().includes(q)) return false;
    return true;
  });

  const inclusionCounts = Object.fromEntries(
    inclusionBreakdown.map((r) => [r.included, r.n]),
  ) as Record<"include" | "exclude" | "undecided", number | undefined>;
  const totalConflicts = allRows.filter((r) => r.hasConflict).length;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Checklist"
        title="Species checklist"
        description={`${visible.length} of ${allRows.length} taxa shown. Filter by inclusion or conflict, click a row to triage, or check rows to merge duplicates.`}
        actions={<AddTaxonButton projectId={id} disabled={!canMutate} />}
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-text-400" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
            Filter
          </span>
          <FilterChip
            label="All"
            count={allRows.length}
            param="inclusion"
            value={null}
            active={inclusion === "all"}
          />
          <FilterChip
            label="Included"
            count={inclusionCounts.include ?? 0}
            param="inclusion"
            value="include"
            active={inclusion === "include"}
          />
          <FilterChip
            label="Undecided"
            count={inclusionCounts.undecided ?? 0}
            param="inclusion"
            value="undecided"
            active={inclusion === "undecided"}
          />
          <FilterChip
            label="Excluded"
            count={inclusionCounts.exclude ?? 0}
            param="inclusion"
            value="exclude"
            active={inclusion === "exclude"}
          />
          <span className="mx-2 h-4 w-px bg-surface-3" aria-hidden />
          <FilterChip
            label="Has conflict"
            count={totalConflicts}
            param="conflict"
            value="1"
            active={conflictOnly}
          />
        </div>

        <MergeController
          projectId={id}
          rows={visible}
          regionCodes={project?.regionCodes ?? ["US-IN"]}
          canMutate={canMutate}
        />
      </div>
    </div>
  );
}
