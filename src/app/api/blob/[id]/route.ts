import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exportArtifacts, projects } from "@/lib/db/schema";
import { getBlob } from "@/lib/exports/blob-store";
import { getMembership } from "@/lib/auth/dev-auth";

const EXT: Record<string, string> = {
  docx: "docx",
  csv: "csv",
  maps: "zip",
  dwc: "zip",
  json: "json",
};
const CONTENT_TYPE: Record<string, string> = {
  json: "application/json",
  csv: "text/csv; charset=utf-8",
  maps: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dwc: "application/zip",
};

function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 80);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const artifact = await db.query.exportArtifacts.findFirst({
    where: eq(exportArtifacts.id, id),
  });
  if (!artifact) {
    return new NextResponse("not found", { status: 404 });
  }

  const [project, membership] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, artifact.projectId),
    }),
    getMembership(artifact.projectId),
  ]);
  if (!membership) {
    return new NextResponse("forbidden", { status: 403 });
  }

  // blob://<key> — strip the scheme to get the on-disk key.
  const key = artifact.blobUrl.replace(/^blob:\/\//, "");
  const blob = await getBlob(key);
  if (!blob) {
    return new NextResponse("missing on disk", { status: 410 });
  }

  // Friendly filename. For formats whose extension equals the format name
  // (json/csv/docx) we drop the redundant middle segment so users don't see
  // "project-2026-05-27-docx.docx". The two zip formats (maps, dwc) keep a
  // format-label segment so they're distinguishable.
  const projectSlug = slugify(project?.name ?? "project");
  const date = artifact.generatedAt.toISOString().slice(0, 10);
  const ext = EXT[artifact.format] ?? artifact.format;
  const needsFormatLabel = ext !== artifact.format;
  const filename = needsFormatLabel
    ? `${projectSlug}-${date}-${artifact.format}.${ext}`
    : `${projectSlug}-${date}.${ext}`;

  return new NextResponse(blob.buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE[artifact.format] ?? "application/octet-stream",
      "Content-Length": String(blob.bytes),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
