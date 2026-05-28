import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projects, records, taxa, users } from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { Avatar } from "@/components/insectid/avatar";
import { countyLabel } from "@/lib/insectid/regions";
import { AddCiteOnlySheet } from "./add-cite-only-sheet";

export const dynamic = "force-dynamic";

interface ManualPageProps {
  params: Promise<{ id: string }>;
}

export default async function ManualEntriesPage({ params }: ManualPageProps) {
  const { id: projectId } = await params;

  const [project, membership, citeRecords, projectTaxa] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
    getMembership(projectId),
    db
      .select({
        record: records,
        taxonName: taxa.scientificName,
        taxonAuthority: taxa.authority,
        addedByInitials: users.initials,
        addedByName: users.displayName,
      })
      .from(records)
      .innerJoin(taxa, eq(taxa.id, records.taxonId))
      .leftJoin(users, eq(users.id, records.addedBy))
      .where(
        and(eq(records.projectId, projectId), eq(records.source, "cite")),
      )
      .orderBy(desc(records.addedAt)),
    db
      .select({ id: taxa.id, scientificName: taxa.scientificName })
      .from(taxa)
      .where(eq(taxa.projectId, projectId))
      .orderBy(asc(taxa.scientificName)),
  ]);

  const canMutate =
    membership?.role === "Lead" || membership?.role === "Contributor";

  const projectRegionCodes = project?.regionCodes ?? [];

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Manual entries"
        title="Cite-only records"
        description="Literature records that augment the GBIF / iNat ingest. Citation is free text in MVP; DOI is optional."
        actions={
          <AddCiteOnlySheet
            projectId={projectId}
            taxa={projectTaxa}
            regionCodes={projectRegionCodes}
            canMutate={canMutate}
          />
        }
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        {citeRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-16 text-center text-sm text-text-400">
            No cite-only records yet. Use &ldquo;Add cite-only&rdquo; to attach
            a literature record to an existing taxon.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {citeRecords.map(
              ({ record, taxonName, taxonAuthority, addedByInitials, addedByName }) => {
                const regionLabel =
                  countyLabel(record.countyFips) ??
                  (record.countyFips ? record.countyFips : "—");
                return (
                  <li
                    key={record.id}
                    className="flex flex-col gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card"
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                          href={`/projects/${projectId}/species/${record.taxonId}`}
                          className="text-base font-bold italic text-text-700 hover:text-blue-700"
                        >
                          {taxonName}{" "}
                          <span className="font-normal not-italic text-text-400">
                            {taxonAuthority ?? ""}
                          </span>
                        </Link>
                        <span
                          className="text-[11px] uppercase tracking-[0.08em] text-text-400"
                          title={
                            record.countyFips ? `id ${record.countyFips}` : undefined
                          }
                        >
                          {regionLabel}
                        </span>
                      </div>
                      <span className="inline-flex h-5 items-center rounded-full border border-cyan-400/40 bg-cyan-50 px-2 text-[10px] font-bold uppercase tracking-[0.06em] text-cyan-600">
                        Cite-only
                      </span>
                    </header>

                    <p className="text-sm italic text-text-600">
                      {record.citation}
                    </p>

                    {record.doi && (
                      <a
                        href={`https://doi.org/${record.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start font-mono text-xs text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        doi:{record.doi} ↗
                      </a>
                    )}

                    {record.notes && (
                      <p className="rounded-md border border-surface-3 bg-surface-1 px-3 py-2 text-xs text-text-500">
                        {record.notes}
                      </p>
                    )}

                    <footer className="flex items-center justify-between gap-2 border-t border-surface-3 pt-2 text-[11px] text-text-400">
                      <div className="flex items-center gap-2">
                        {addedByInitials && (
                          <>
                            <Avatar
                              initials={addedByInitials}
                              title={addedByName ?? undefined}
                              size="xs"
                            />
                            <span>Added by {addedByName ?? "—"}</span>
                          </>
                        )}
                      </div>
                      <span>
                        {new Date(record.addedAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                        })}
                      </span>
                    </footer>
                  </li>
                );
              },
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
