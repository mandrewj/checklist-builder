import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Download, Lock } from "lucide-react";
import { db } from "@/lib/db/client";
import { exportArtifacts, projects } from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { GenerateButton } from "./generate-button";

export const dynamic = "force-dynamic";

interface ExportsPageProps {
  params: Promise<{ id: string }>;
}

const FORMATS: Array<{
  format: "json" | "csv" | "maps" | "docx" | "dwc";
  label: string;
  description: string;
  status: "ready" | "deferred";
}> = [
  {
    format: "csv",
    label: "CSV",
    description:
      "Species checklist (UTF-8, RFC 4180). Included taxa only; one row per species.",
    status: "ready",
  },
  {
    format: "maps",
    label: "Maps · SVG zip",
    description:
      "Per-species county distribution as SVG, bundled with a manifest. PNG/PDF/composite land in a follow-up.",
    status: "ready",
  },
  {
    format: "json",
    label: "JSON snapshot",
    description:
      "Full project state for replay or programmatic analysis. Mirrors the database shape.",
    status: "ready",
  },
  {
    format: "docx",
    label: "DOCX manuscript draft",
    description:
      "Title page, methods, per-species accounts with embedded county-distribution maps, references, and supplementary tables (cite-only records + taxonomic conflicts).",
    status: "ready",
  },
  {
    format: "dwc",
    label: "Darwin Core Archive",
    description:
      "occurrence.txt + meta.xml + eml.xml zip suitable for GBIF deposit via an IPT instance. Cite-only records emit with basisOfRecord=LITERATURE.",
    status: "ready",
  },
];

export default async function ExportsPage({ params }: ExportsPageProps) {
  const { id: projectId } = await params;

  const [project, membership] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.id, projectId) }),
    getMembership(projectId),
  ]);
  if (!project) return null;
  const locked = !!project.lockedAt;
  const canGenerate =
    locked &&
    (membership?.role === "Lead" || membership?.role === "Contributor");

  const artifacts = project.lockedSnapshotId
    ? await db
        .select()
        .from(exportArtifacts)
        .where(
          and(
            eq(exportArtifacts.projectId, projectId),
            eq(exportArtifacts.snapshotId, project.lockedSnapshotId),
          ),
        )
        .orderBy(desc(exportArtifacts.generatedAt))
    : [];

  const artifactsByFormat = new Map(artifacts.map((a) => [a.format, a]));

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Exports"
        title="Manuscript pack"
        description={
          locked
            ? `Generated against snapshot ${project.lockedSnapshotId}. Each artifact stays valid until the project is unlocked, but already-downloaded files keep their provenance forever.`
            : "Lock the project (top-right) to create an immutable snapshot. Exports run against the snapshot id."
        }
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        {!locked && (
          <div className="flex items-start gap-3 rounded-xl border border-warning-600/30 bg-warning-50 px-5 py-4 text-sm text-warning-700">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <strong className="font-bold">Project not locked.</strong>
              <span>
                Mutating actions are still allowed; exports are disabled. Use
                the lock button in the top bar to create a snapshot.
              </span>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {FORMATS.map((f) => {
            const artifact = artifactsByFormat.get(f.format);
            const isDeferred = f.status === "deferred";
            return (
              <li
                key={f.format}
                className="flex flex-wrap items-start gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 className="text-sm font-bold text-blue-800">
                    {f.label}{" "}
                    {isDeferred && (
                      <span className="ml-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-warning-700">
                        Deferred
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-text-500">{f.description}</p>
                  {artifact && (
                    <p className="mt-1 text-[11px] text-text-400">
                      Last generated{" "}
                      {new Date(artifact.generatedAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      ·{" "}
                      {artifact.bytes !== null
                        ? `${(artifact.bytes / 1024).toFixed(1)} KB`
                        : "—"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {artifact && (
                    <Link
                      href={`/api/blob/${artifact.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-surface-3 bg-surface-0 px-3 py-1.5 text-xs font-bold text-blue-600 shadow-card hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Download className="size-3.5" aria-hidden />
                      Download
                    </Link>
                  )}
                  <GenerateButton
                    projectId={projectId}
                    format={f.format}
                    label={artifact ? "Regenerate" : "Generate"}
                    disabled={!canGenerate || isDeferred}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
