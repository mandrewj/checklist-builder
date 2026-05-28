import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  comments,
  countyPresence,
  projects,
  records,
  taxa,
  taxonConflicts,
  users,
} from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { Avatar } from "@/components/insectid/avatar";
import { RegionChoropleth } from "@/components/insectid/region-choropleth";
import { SourceChip, type SourceKind } from "@/components/insectid/source-chip";
import { InclusionBadge } from "@/components/insectid/inclusion-badge";
import { Badge } from "@/components/ui/badge";
import { countyLabel } from "@/lib/insectid/regions";
import {
  PhenologyStrip,
  bucketByMonth,
  dateRangeOf,
} from "@/components/insectid/phenology-strip";
import { InclusionPanel } from "./inclusion-panel";
import { TriageController } from "./triage-controller";
import { toTriageRecords } from "./triage-shape";
import { EditTaxonButton } from "./edit-taxon-button";

export const dynamic = "force-dynamic";

interface SpeciesDetailPageProps {
  params: Promise<{ id: string; taxonId: string }>;
}

export default async function SpeciesDetailPage({
  params,
}: SpeciesDetailPageProps) {
  const { id: projectId, taxonId } = await params;

  const [taxon, project] = await Promise.all([
    db.query.taxa.findFirst({
      where: and(eq(taxa.id, taxonId), eq(taxa.projectId, projectId)),
    }),
    db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
  ]);
  if (!taxon || !project) notFound();

  const membership = await getMembership(projectId);
  const canMutate =
    membership?.role === "Lead" || membership?.role === "Contributor";

  const [
    presenceRows,
    recordRows,
    conflictRow,
    commentRows,
    citeOnlyRecords,
  ] = await Promise.all([
    db
      .select({
        countyFips: countyPresence.countyFips,
        nRecords: countyPresence.nRecords,
        hasCiteOnly: countyPresence.hasCiteOnly,
      })
      .from(countyPresence)
      .where(
        and(
          eq(countyPresence.projectId, projectId),
          eq(countyPresence.taxonId, taxonId),
        ),
      ),
    db
      .select()
      .from(records)
      .where(
        and(eq(records.projectId, projectId), eq(records.taxonId, taxonId)),
      )
      .orderBy(desc(records.observedAt)),
    db.query.taxonConflicts.findFirst({
      where: and(
        eq(taxonConflicts.projectId, projectId),
        eq(taxonConflicts.taxonId, taxonId),
        isNull(taxonConflicts.resolution),
      ),
    }),
    db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        authorInitials: users.initials,
        authorName: users.displayName,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(
        and(
          eq(comments.projectId, projectId),
          eq(comments.targetType, "taxon"),
          eq(comments.targetId, taxonId),
        ),
      )
      .orderBy(asc(comments.createdAt)),
    db
      .select({ countyFips: records.countyFips })
      .from(records)
      .where(
        and(
          eq(records.projectId, projectId),
          eq(records.taxonId, taxonId),
          eq(records.source, "cite"),
        ),
      ),
  ]);

  const presence: Record<string, number> = {};
  for (const r of presenceRows) presence[r.countyFips] = r.nRecords;
  const citeOnly = new Set(
    citeOnlyRecords.map((r) => r.countyFips).filter((f): f is string => !!f),
  );

  const sources = new Set<SourceKind>();
  for (const r of recordRows) sources.add(r.source as SourceKind);

  const statusCounts = recordRows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Species"
        title={
          <span className="flex flex-wrap items-baseline gap-3">
            <span className="italic">{taxon.scientificName}</span>
            <span className="text-base font-normal not-italic text-text-400">
              {taxon.authority}
            </span>
            <InclusionBadge state={taxon.included} />
            {conflictRow && (
              <Badge
                variant="outline"
                className="border-warning-600/40 text-warning-700"
              >
                Conflict open
              </Badge>
            )}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {taxon.family}
              {taxon.subfamily ? ` · ${taxon.subfamily}` : ""} · {taxon.rank}
            </span>
            {Array.from(sources).map((s) => (
              <SourceChip key={s} source={s} />
            ))}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <EditTaxonButton
              projectId={projectId}
              taxonId={taxon.id}
              disabled={!canMutate}
              initial={{
                scientificName: taxon.scientificName,
                authority: taxon.authority ?? null,
                rank: taxon.rank,
                family: taxon.family ?? null,
                subfamily: taxon.subfamily ?? null,
                gbifKey: taxon.externalIds.gbifKey,
                inatId: taxon.externalIds.inatId,
              }}
            />
            <Link
              href={`/projects/${projectId}/checklist`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back to checklist
            </Link>
          </div>
        }
      />

      <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          {/* Distribution map */}
          <section>
            <h2 className="rule-sm text-base font-bold">County distribution</h2>
            <div className="mt-4 flex flex-col items-start gap-2 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
              <RegionChoropleth
                regionCodes={project.regionCodes}
                countyPresence={presence}
                citeOnlyCounties={citeOnly}
                mode="count"
                size="lg"
              />
              <p className="text-xs text-text-400">
                {Object.keys(presence).length} of 92 counties have at least one
                record · cite-only counties marked with a cyan dot.
              </p>
            </div>
          </section>

          {/* Phenology */}
          <section>
            <h2 className="rule-sm text-base font-bold">
              Phenology — activity by month
            </h2>
            <div className="mt-4 flex flex-col items-start gap-2 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
              <PhenologyStrip
                counts={bucketByMonth(recordRows.map((r) => r.observedAt))}
                yearRange={dateRangeOf(recordRows.map((r) => r.observedAt))}
                size="md"
              />
              <p className="text-xs text-text-400">
                Aggregated across all years. Cite-only and undated records are
                excluded.
              </p>
            </div>
          </section>

          {/* Taxonomy panel */}
          <section>
            <h2 className="rule-sm text-base font-bold">Taxonomy</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TaxonomyCard
                source="gbif"
                name={conflictRow?.gbifName ?? taxon.scientificName}
                authority={conflictRow?.gbifAuthority ?? taxon.authority ?? ""}
                externalKey={taxon.externalIds.gbifKey?.toString()}
                isCanonical={!conflictRow}
              />
              <TaxonomyCard
                source="inat"
                name={conflictRow?.inatName ?? taxon.scientificName}
                authority={conflictRow?.inatAuthority ?? taxon.authority ?? ""}
                externalKey={taxon.externalIds.inatId?.toString()}
                isCanonical={!conflictRow}
              />
            </div>
            {conflictRow && (
              <div className="mt-3 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-xs text-warning-700">
                <strong className="font-bold">Conflict open.</strong>{" "}
                {conflictRow.note}{" "}
                <Link
                  href={`/projects/${projectId}/conflicts`}
                  className="font-bold underline"
                >
                  Resolve →
                </Link>
              </div>
            )}
          </section>

          {/* Triage */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="rule-sm text-base font-bold">
                Triage
                <span className="ml-2 text-xs font-normal text-text-400">
                  {recordRows.length} total · {statusCounts.accepted ?? 0}{" "}
                  accepted · {statusCounts.pending ?? 0} pending ·{" "}
                  {statusCounts.flagged ?? 0} flagged ·{" "}
                  {statusCounts.rejected ?? 0} rejected
                </span>
              </h2>
            </div>
            <TriageController
              records={toTriageRecords(recordRows, computeOutOfRangeHints(recordRows))}
              canMutate={canMutate}
              disabledReason={
                !membership
                  ? "you are not a member of this project"
                  : membership.role === "Reviewer"
                    ? "Reviewers cannot mutate records"
                    : undefined
              }
            />
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <InclusionPanel
            taxonId={taxon.id}
            initialValue={taxon.included}
            initialReasoning={taxon.inclusionReasoning ?? ""}
            disabled={!canMutate}
            disabledReason={
              !membership
                ? "you are not a member of this project"
                : membership.role === "Reviewer"
                  ? "Reviewers cannot change inclusion"
                  : undefined
            }
          />

          <section>
            <h3 className="text-sm font-bold text-blue-800">Comments</h3>
            <ul className="mt-3 flex flex-col gap-3">
              {commentRows.length === 0 && (
                <li className="rounded-md border border-dashed border-surface-3 px-3 py-4 text-center text-xs text-text-400">
                  No comments yet.
                </li>
              )}
              {commentRows.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-md border border-surface-3 bg-surface-0 p-3 shadow-card"
                >
                  <Avatar initials={c.authorInitials} title={c.authorName} size="sm" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-text-700">
                        {c.authorName}
                      </span>
                      <span className="text-[10px] text-text-400">
                        {new Date(c.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-text-600">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * Mirror of the seed's `someOutOfRange: true` mask on t1 (the headline
 * species). 12 records get the `isLikelyOutOfRange` hint so Flow B can demo
 * a real bulk-reject. Other taxa pass through with no hint.
 */
const T1_OUT_OF_RANGE_INDICES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
function computeOutOfRangeHints(
  rows: ReadonlyArray<typeof records.$inferSelect>,
): Record<string, { isLikelyOutOfRange?: boolean }> {
  const out: Record<string, { isLikelyOutOfRange?: boolean }> = {};
  for (const r of rows) {
    const m = /^t1-r(\d+)$/.exec(r.id);
    if (m && T1_OUT_OF_RANGE_INDICES.includes(Number(m[1]))) {
      out[r.id] = { isLikelyOutOfRange: true };
    }
  }
  return out;
}

function TaxonomyCard({
  source,
  name,
  authority,
  externalKey,
  isCanonical,
}: {
  source: "gbif" | "inat";
  name: string;
  authority: string;
  externalKey?: string;
  isCanonical: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-surface-3 bg-surface-0 p-4 shadow-card">
      <div className="flex items-center justify-between">
        <SourceChip source={source} />
        {isCanonical && (
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-success-700">
            Agreed
          </span>
        )}
      </div>
      <span className="text-sm font-bold italic text-text-700">{name}</span>
      <span className="text-[11px] text-text-400">{authority}</span>
      {externalKey && (
        <span className="text-[10px] font-mono uppercase text-text-300">
          {source === "gbif" ? "taxonKey" : "taxon_id"} {externalKey}
        </span>
      )}
    </div>
  );
}

function RecordsTable({
  rows,
}: {
  rows: ReadonlyArray<typeof records.$inferSelect>;
}) {
  if (rows.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-surface-3 px-6 py-10 text-center text-sm text-text-400">
        No records yet. Cite-only entries land via Manual entries (step 8).
      </div>
    );
  }
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-card">
      <table className="w-full text-sm">
        <thead className="bg-surface-1 text-[10.5px] uppercase tracking-[0.08em] text-text-400">
          <tr>
            <th className="px-3 py-2 text-left font-bold">Source</th>
            <th className="px-3 py-2 text-left font-bold">External ID</th>
            <th className="px-3 py-2 text-left font-bold">Locality</th>
            <th className="px-3 py-2 text-left font-bold">Date</th>
            <th className="px-3 py-2 text-left font-bold">Collector</th>
            <th className="px-3 py-2 text-left font-bold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-3 text-xs">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-blue-50/40">
              <td className="px-3 py-2 align-middle">
                <SourceChip source={r.source as SourceKind} />
              </td>
              <td className="px-3 py-2 align-middle font-mono text-[11px] text-text-500">
                {r.externalId ?? "—"}
              </td>
              <td
                className="px-3 py-2 align-middle text-text-600"
                title={r.countyFips ? `FIPS ${r.countyFips}` : undefined}
              >
                {r.countyFips
                  ? (countyLabel(r.countyFips) ?? `FIPS ${r.countyFips}`)
                  : "—"}
              </td>
              <td className="px-3 py-2 align-middle text-text-600">
                {r.observedAt ?? "—"}
              </td>
              <td className="px-3 py-2 align-middle text-text-500">
                {r.collector ?? "—"}
              </td>
              <td className="px-3 py-2 align-middle">
                <RecordStatus status={r.status} flagReason={r.flagReason} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordStatus({
  status,
  flagReason,
}: {
  status: "pending" | "accepted" | "rejected" | "flagged";
  flagReason: string | null;
}) {
  const map = {
    pending:  "bg-surface-2 text-text-500",
    accepted: "bg-success-50 text-success-700",
    rejected: "bg-danger-50  text-danger-600",
    flagged:  "bg-warning-50 text-warning-700",
  } as const;
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.06em] ${map[status]}`}
      title={flagReason ?? undefined}
    >
      {status}
    </span>
  );
}
