import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";
import { db } from "@/lib/db/client";
import { projects } from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { regionDescriptor } from "@/lib/insectid/regions";
import { ProjectMetadataForm } from "./metadata-form";
import { RestartIngestPanel } from "./restart-ingest";
import { DeleteProjectPanel } from "./delete-project";
import { VisibilityToggle } from "./visibility-toggle";

export const dynamic = "force-dynamic";

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { id } = await params;
  const [project, membership] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, id) }),
    getMembership(id),
  ]);
  if (!project) notFound();
  const isLead = membership?.role === "Lead";
  const locked = !!project.lockedAt;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Settings"
        title="Project settings"
        description={
          isLead
            ? "Edit project metadata, re-run ingest, or delete the project. Mutating actions are blocked while the project is locked."
            : "Read-only for non-Lead members. Contact the project Lead to make changes."
        }
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        <section className="flex flex-col gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
          <h2 className="text-sm font-bold text-blue-800">Metadata</h2>
          <ProjectMetadataForm
            projectId={project.id}
            initialName={project.name}
            initialDescription={project.description}
            disabled={!isLead || locked}
            disabledReason={
              !isLead
                ? "Lead-only"
                : locked
                  ? "Project is locked — unlock to edit"
                  : undefined
            }
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
          <h2 className="text-sm font-bold text-blue-800">Visibility</h2>
          <VisibilityToggle
            projectId={project.id}
            initialIsPublic={project.isPublic}
            disabled={!isLead}
            disabledReason={!isLead ? "Lead-only" : undefined}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
          <h2 className="text-sm font-bold text-blue-800">Region + filters</h2>
          <p className="text-xs text-text-500">
            Changing these reshapes the ingest. They&apos;re shown here for
            reference; editing them is not implemented yet. To change them,
            delete the project and create a new one.
          </p>
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <Row
              label="Taxon"
              value={
                <>
                  <em>{project.taxonQuery.name}</em>
                  {" · "}
                  rank {project.taxonQuery.rank}
                  {project.taxonQuery.gbifKey
                    ? `, GBIF #${project.taxonQuery.gbifKey}`
                    : ""}
                  {project.taxonQuery.inatId
                    ? `, iNat #${project.taxonQuery.inatId}`
                    : ""}
                </>
              }
            />
            <Row
              label="Regions"
              value={
                project.regionCodes
                  .map((c) => regionDescriptor(c)?.name ?? c)
                  .join(" · ") || "—"
              }
            />
            <Row
              label="Year range"
              value={`${project.ingestFilters.yearStart} – ${project.ingestFilters.yearEnd}`}
            />
            <Row
              label="GBIF basis of record"
              value={project.ingestFilters.basisOfRecord.join(", ")}
            />
            <Row
              label="iNat quality grade"
              value={project.ingestFilters.qualityGrade}
            />
            <Row
              label="Require coordinates"
              value={project.ingestFilters.requireCoordinates ? "Yes" : "No"}
            />
            <Row
              label="Exclude captive / cultivated"
              value={project.ingestFilters.excludeCaptive ? "Yes" : "No"}
            />
            <Row
              label="Coordinate precision"
              value={`≥ ${project.ingestFilters.coordinatePrecisionDp} decimal places`}
            />
          </dl>
        </section>

        {isLead && (
          <>
            <section className="flex flex-col gap-3 rounded-xl border border-warning-600/30 bg-warning-50/30 p-5 shadow-card">
              <h2 className="text-sm font-bold text-warning-700">Re-run ingest</h2>
              <p className="text-xs text-warning-700">
                Drops all GBIF + iNaturalist records and resets both ingest
                jobs back to the first page. Manual / cite-only records and
                inclusion decisions are preserved. Use this after editing
                taxon or region filters (once that&apos;s wired) or to recover
                from a partial ingest.
              </p>
              <RestartIngestPanel projectId={project.id} disabled={locked} />
            </section>

            <section className="flex flex-col gap-3 rounded-xl border-2 border-danger-600/40 bg-danger-50/30 p-5 shadow-card">
              <h2 className="flex items-center gap-2 text-sm font-bold text-danger-600">
                <ShieldAlert className="size-4" aria-hidden />
                Danger zone
              </h2>
              <p className="text-xs text-danger-600">
                Deleting the project removes all taxa, records, comments,
                conflicts, exports, and activity log entries. No soft-delete;
                no recovery.
              </p>
              <DeleteProjectPanel
                projectId={project.id}
                projectName={project.name}
                disabled={locked}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-surface-3 bg-surface-1 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
        {label}
      </dt>
      <dd className="text-xs text-text-600">{value}</dd>
    </div>
  );
}
