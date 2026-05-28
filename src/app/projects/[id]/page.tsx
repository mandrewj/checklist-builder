import Link from "next/link";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { Activity, AlertTriangle, BookOpen, ChevronRight, Flag } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  activityLog,
  countyPresence,
  ingestJobs,
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
import {
  IngestStatus,
  type IngestJobView,
} from "@/components/insectid/ingest-status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ProjectOverviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectOverviewPage({
  params,
}: ProjectOverviewPageProps) {
  const { id } = await params;

  const [
    project,
    [{ n: nTaxa }],
    inclusionBreakdown,
    [{ n: nRecordsTotal }],
    statusBreakdown,
    [{ n: nFlagged }],
    [{ n: nOpenConflicts }],
    [{ n: nCounties }],
    topTaxa,
    recentActivity,
    ingestJobRows,
    membership,
  ] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, id) }),
    db.select({ n: count() }).from(taxa).where(eq(taxa.projectId, id)),
    db
      .select({ included: taxa.included, n: count() })
      .from(taxa)
      .where(eq(taxa.projectId, id))
      .groupBy(taxa.included),
    db.select({ n: count() }).from(records).where(eq(records.projectId, id)),
    db
      .select({ status: records.status, n: count() })
      .from(records)
      .where(eq(records.projectId, id))
      .groupBy(records.status),
    db
      .select({ n: count() })
      .from(records)
      .where(and(eq(records.projectId, id), eq(records.status, "flagged"))),
    db
      .select({ n: count() })
      .from(taxonConflicts)
      .where(
        and(
          eq(taxonConflicts.projectId, id),
          isNull(taxonConflicts.resolution),
        ),
      ),
    db
      .selectDistinct({ countyFips: records.countyFips })
      .from(records)
      .where(eq(records.projectId, id))
      .then((rows) => [{ n: rows.filter((r) => r.countyFips).length }]),
    db
      .select({
        id: taxa.id,
        scientificName: taxa.scientificName,
        authority: taxa.authority,
        family: taxa.family,
        nRecords: count(records.id).as("n_records"),
      })
      .from(taxa)
      .leftJoin(records, eq(records.taxonId, taxa.id))
      .where(and(eq(taxa.projectId, id), eq(taxa.included, "include")))
      .groupBy(taxa.id, taxa.scientificName, taxa.authority, taxa.family)
      .orderBy(desc(count(records.id)))
      .limit(5),
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        targetType: activityLog.targetType,
        targetId: activityLog.targetId,
        ts: activityLog.ts,
        after: activityLog.after,
        actorInitials: users.initials,
        actorName: users.displayName,
      })
      .from(activityLog)
      .innerJoin(users, eq(users.id, activityLog.actorId))
      .where(eq(activityLog.projectId, id))
      .orderBy(desc(activityLog.ts))
      .limit(6),
    db
      .select({
        id: ingestJobs.id,
        source: ingestJobs.source,
        status: ingestJobs.status,
        cursor: ingestJobs.cursor,
        fetched: ingestJobs.fetched,
        error: ingestJobs.error,
      })
      .from(ingestJobs)
      .where(eq(ingestJobs.projectId, id))
      .orderBy(asc(ingestJobs.source)),
    getMembership(id),
  ]);
  const ingestJobViews: IngestJobView[] = ingestJobRows.map((j) => ({
    id: j.id,
    source: j.source,
    status: j.status,
    cursor: j.cursor,
    fetched: j.fetched,
    error: j.error,
  }));
  const canRunIngest =
    membership?.role === "Lead" || membership?.role === "Contributor";
  const regionCodes = project?.regionCodes ?? ["US-IN"];

  const incl = Object.fromEntries(
    inclusionBreakdown.map((r) => [r.included, r.n]),
  ) as Record<"include" | "exclude" | "undecided", number | undefined>;
  const stat = Object.fromEntries(
    statusBreakdown.map((r) => [r.status, r.n]),
  ) as Record<"pending" | "accepted" | "rejected" | "flagged", number | undefined>;

  // County presence for the headline species (top-ranked included taxon).
  const headlineTaxon = topTaxa[0];
  const headlinePresence: Record<string, number> = {};
  if (headlineTaxon) {
    const rows = await db
      .select({
        countyFips: countyPresence.countyFips,
        nRecords: countyPresence.nRecords,
      })
      .from(countyPresence)
      .where(
        and(
          eq(countyPresence.projectId, id),
          eq(countyPresence.taxonId, headlineTaxon.id),
        ),
      );
    for (const r of rows) headlinePresence[r.countyFips] = r.nRecords;
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Overview"
        title="Project snapshot"
        description="Counts roll up live from the database. The headline species + map will live here once the choropleth ships (step 5)."
      />

      <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="rule-sm text-base font-bold">Toplines</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Taxa" value={nTaxa} sublabel={`${incl.include ?? 0} included · ${incl.undecided ?? 0} undecided · ${incl.exclude ?? 0} excluded`} />
              <Stat label="Records" value={nRecordsTotal} sublabel={`${stat.accepted ?? 0} accepted · ${stat.pending ?? 0} pending · ${stat.rejected ?? 0} rejected`} />
              <Stat label="Counties" value={nCounties} sublabel="with at least one record" />
              <Stat
                label="Open conflicts"
                value={nOpenConflicts}
                sublabel="GBIF ↔ iNat name disagreements"
                tone={nOpenConflicts > 0 ? "warning" : "neutral"}
              />
            </div>
          </section>

          <section>
            <h2 className="rule-sm text-base font-bold">Next steps</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {nOpenConflicts > 0 && (
                <NextStepRow
                  tone="warning"
                  icon={AlertTriangle}
                  title={`${nOpenConflicts} taxonomic conflict${nOpenConflicts === 1 ? "" : "s"} unresolved`}
                  body="GBIF / iNat name disagreements awaiting a resolution choice."
                />
              )}
              {(incl.undecided ?? 0) > 0 && (
                <NextStepRow
                  tone="info"
                  icon={BookOpen}
                  title={`${incl.undecided} species still marked undecided`}
                  body="Review each, decide include vs exclude, and capture reasoning."
                />
              )}
              {nFlagged > 0 && (
                <NextStepRow
                  tone="neutral"
                  icon={Flag}
                  title={`${nFlagged} record${nFlagged === 1 ? "" : "s"} flagged for follow-up`}
                  body="Surface in the Records view, filtered to status=flagged."
                />
              )}
              {nOpenConflicts === 0 &&
                (incl.undecided ?? 0) === 0 &&
                nFlagged === 0 && (
                  <li className="rounded-md border border-success-600/30 bg-success-50 px-4 py-3 text-sm text-success-700">
                    Nothing flagged. Ready to lock for export.
                  </li>
                )}
            </ul>
          </section>

          {headlineTaxon && (
            <section>
              <h2 className="rule-sm text-base font-bold">
                Headline species — county distribution
              </h2>
              <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
                <div className="flex flex-col">
                  <span className="text-base font-bold italic text-text-700">
                    {headlineTaxon.scientificName}{" "}
                    <span className="font-normal not-italic text-text-400">
                      {headlineTaxon.authority}
                    </span>
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.08em] text-text-400">
                    {headlineTaxon.family} · {headlineTaxon.nRecords} records ·{" "}
                    {Object.keys(headlinePresence).length} counties
                  </span>
                </div>
                <RegionChoropleth
                  regionCodes={regionCodes}
                  countyPresence={headlinePresence}
                  mode="count"
                  size="md"
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="rule-sm text-base font-bold">Top species</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {topTaxa.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/projects/${id}/species/${t.id}`}
                    className="group flex items-center justify-between gap-3 rounded-md border border-surface-3 bg-surface-0 px-4 py-3 text-sm shadow-card transition-all hover:border-blue-600 hover:shadow-pop"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="font-bold italic text-text-700 group-hover:text-blue-700">
                        {t.scientificName}{" "}
                        <span className="font-normal not-italic text-text-400">
                          {t.authority}
                        </span>
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.08em] text-text-400">
                        {t.family}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        {t.nRecords} records
                      </span>
                      <ChevronRight
                        className="size-4 text-text-300 group-hover:text-blue-600"
                        aria-hidden
                      />
                    </div>
                  </Link>
                </li>
              ))}
              {topTaxa.length === 0 && (
                <li className="rounded-md border border-dashed border-surface-3 px-4 py-6 text-center text-sm text-text-400">
                  No included species yet — head to Checklist to triage.
                </li>
              )}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <IngestStatus
            projectId={id}
            jobs={ingestJobViews}
            canRun={canRunIngest}
          />
          <div className="rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
            <div className="flex items-center gap-2 pb-3">
              <Activity className="size-4 text-text-400" aria-hidden />
              <h2 className="text-sm font-bold text-text-700">
                Recent activity
              </h2>
            </div>
            <ul className="flex flex-col gap-3">
              {recentActivity.map((a) => {
                const detail =
                  a.after && typeof a.after === "object" && "detail" in a.after
                    ? String((a.after as { detail: unknown }).detail)
                    : `${a.action} · ${a.targetType}`;
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <Avatar
                      initials={a.actorInitials}
                      title={a.actorName}
                      size="sm"
                    />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-400">
                        {a.action}
                      </span>
                      <span className="text-xs leading-snug text-text-600">
                        {detail}
                      </span>
                      <span className="text-[11px] text-text-400">
                        {new Date(a.ts).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  tone = "neutral",
}: {
  label: string;
  value: number;
  sublabel?: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-surface-3 bg-surface-0 p-4 shadow-card">
      <span className="text-[10px] uppercase tracking-[0.08em] text-text-400">
        {label}
      </span>
      <span
        className={cn(
          "text-3xl font-black",
          tone === "warning" && value > 0 ? "text-warning-700" : "text-blue-800",
        )}
      >
        {value}
      </span>
      {sublabel && (
        <span className="text-[11px] leading-snug text-text-400">
          {sublabel}
        </span>
      )}
    </div>
  );
}

function NextStepRow({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "warning" | "info" | "neutral";
  icon: typeof AlertTriangle;
  title: string;
  body: string;
}) {
  const toneClass = {
    warning: "border-warning-600/30 bg-warning-50 text-warning-700",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    neutral: "border-surface-3 bg-surface-0 text-text-600",
  }[tone];
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
        toneClass,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="font-bold">{title}</span>
        <span className="text-xs opacity-80">{body}</span>
      </div>
    </li>
  );
}
