"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import {
  activityLog,
  exportArtifacts,
  type NewExportArtifact,
} from "@/lib/db/schema";
import {
  AuthorizationError,
  requireCurrentUserId,
  requireRole,
} from "@/lib/auth/dev-auth";
import { loadSnapshot } from "@/lib/exports/snapshot";
import { buildJsonExport } from "@/lib/exports/json";
import { buildCsvExport } from "@/lib/exports/csv";
import { buildMapsExport } from "@/lib/exports/maps";
import { buildDocxExport } from "@/lib/exports/docx";
import { buildDwcExport } from "@/lib/exports/dwc";
import { putBlob } from "@/lib/exports/blob-store";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const CONTENT_TYPE: Record<string, string> = {
  json: "application/json",
  csv: "text/csv; charset=utf-8",
  maps: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  dwc: "application/zip",
};

type SupportedFormat = "json" | "csv" | "maps" | "docx" | "dwc";

const EXPORT_TIMEOUT_MS = 120_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms / 1000}s`));
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

export async function generateExport(
  projectId: string,
  format: SupportedFormat,
): Promise<ActionResult<{ id: string; url: string }>> {
  const traceId = Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();
  console.log(`[gen ${traceId}] start ${format} project=${projectId}`);

  let userId: string;
  try {
    userId = await requireCurrentUserId();
    await requireRole(projectId, "Contributor");
  } catch (err) {
    console.error(`[gen ${traceId}] auth failed:`, err);
    return {
      ok: false,
      error:
        err instanceof AuthorizationError ? err.message : "unauthorized",
    };
  }

  try {
    const result = await withTimeout(
      runExport(projectId, format, userId, traceId),
      EXPORT_TIMEOUT_MS,
      format,
    );
    console.log(`[gen ${traceId}] done total=${Date.now() - t0}ms ok=${result.ok}`);
    return result;
  } catch (err) {
    console.error(`[gen ${traceId}] failed total=${Date.now() - t0}ms`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "export failed",
    };
  }
}

async function runExport(
  projectId: string,
  format: SupportedFormat,
  userId: string,
  traceId: string,
): Promise<ActionResult<{ id: string; url: string }>> {
  let t = Date.now();

  let snapshot;
  try {
    snapshot = await loadSnapshot(projectId);
  } catch (err) {
    console.error(`[gen ${traceId}] snapshot load failed:`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "failed to load snapshot",
    };
  }
  console.log(
    `[gen ${traceId}] snapshot loaded in ${Date.now() - t}ms (taxa=${snapshot.taxa.length} records=${snapshot.records.length})`,
  );
  t = Date.now();

  let body: Buffer;
  try {
    if (format === "json") body = buildJsonExport(snapshot);
    else if (format === "csv") body = buildCsvExport(snapshot);
    else if (format === "maps") body = await buildMapsExport(snapshot);
    else if (format === "docx") body = await buildDocxExport(snapshot);
    else body = await buildDwcExport(snapshot);
  } catch (err) {
    console.error(`[gen ${traceId}] ${format} build failed:`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "build failed",
    };
  }
  console.log(
    `[gen ${traceId}] build done in ${Date.now() - t}ms (${body.byteLength}b)`,
  );
  t = Date.now();

  const blob = await putBlob(
    projectId,
    snapshot.snapshotId,
    format,
    body,
    CONTENT_TYPE[format] ?? "application/octet-stream",
  );
  console.log(`[gen ${traceId}] blob written in ${Date.now() - t}ms`);
  t = Date.now();

  const artifact: NewExportArtifact = {
    projectId,
    snapshotId: snapshot.snapshotId,
    format,
    blobUrl: blob.url,
    bytes: blob.bytes,
    generatedBy: userId,
  };

  let insertedId = "";
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(exportArtifacts)
        .values(artifact)
        .returning({ id: exportArtifacts.id });
      insertedId = row.id;
      await tx.insert(activityLog).values({
        projectId,
        actorId: userId,
        action: "export",
        targetType: "export",
        targetId: row.id,
        after: { format, snapshotId: snapshot.snapshotId, bytes: blob.bytes },
      });
    });
  } catch (err) {
    console.error(`[gen ${traceId}] db tx failed:`, err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "db tx failed",
    };
  }
  console.log(`[gen ${traceId}] db tx done in ${Date.now() - t}ms`);

  revalidatePath(`/projects/${projectId}/exports`);
  return { ok: true, data: { id: insertedId, url: blob.url } };
}
