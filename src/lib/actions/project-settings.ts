"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  countyPresence,
  ingestJobs,
  projects,
  records,
  taxa,
  taxonConflicts,
} from "@/lib/db/schema";
import {
  AuthorizationError,
  requireCurrentUserId,
  requireRole,
} from "@/lib/auth/dev-auth";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireUnlocked(projectId: string): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error("project not found");
  if (project.lockedAt) {
    throw new AuthorizationError("project is locked — unlock to make changes");
  }
}

/** Edit name + description. Lead-only. */
export async function updateProjectSettings(
  projectId: string,
  patch: { name?: string; description?: string },
): Promise<ActionResult> {
  const userId = await requireCurrentUserId();
  try {
    await requireRole(projectId, "Lead");
    await requireUnlocked(projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return { ok: false, error: "project not found" };

  const updates: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (patch.name !== undefined && patch.name.trim() && patch.name.trim() !== project.name) {
    before.name = project.name;
    after.name = patch.name.trim();
    updates.name = patch.name.trim();
  }
  if (
    patch.description !== undefined &&
    patch.description.trim() !== project.description
  ) {
    before.description = project.description;
    after.description = patch.description.trim();
    updates.description = patch.description.trim();
  }
  if (Object.keys(after).length === 0) {
    return { ok: true, data: undefined };
  }

  await db.transaction(async (tx) => {
    await tx.update(projects).set(updates).where(eq(projects.id, projectId));
    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "settings_update",
      targetType: "project",
      targetId: projectId,
      before,
      after,
    });
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true, data: undefined };
}

/** Toggle the project's `is_public` flag. Lead-only. */
export async function setProjectVisibility(
  projectId: string,
  isPublic: boolean,
): Promise<ActionResult> {
  const userId = await requireCurrentUserId();
  try {
    await requireRole(projectId, "Lead");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return { ok: false, error: "project not found" };
  if (project.isPublic === isPublic) return { ok: true, data: undefined };

  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ isPublic, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "settings_update",
      targetType: "project",
      targetId: projectId,
      before: { isPublic: project.isPublic },
      after: { isPublic },
    });
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true, data: undefined };
}

/**
 * Destructive re-ingest: wipe all GBIF + iNat records and county_presence,
 * reset both ingest_jobs back to cursor 0, status pending. Cite-only and
 * manual records survive. Lead-only.
 */
export async function restartIngest(
  projectId: string,
): Promise<ActionResult<{ deletedRecords: number }>> {
  const userId = await requireCurrentUserId();
  try {
    await requireRole(projectId, "Lead");
    await requireUnlocked(projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  let deleted = 0;
  await db.transaction(async (tx) => {
    // Delete only GBIF + iNat records — manual + cite-only rows survive.
    const gbifDel = await tx
      .delete(records)
      .where(and(eq(records.projectId, projectId), eq(records.source, "gbif")))
      .returning({ id: records.id });
    const inatDel = await tx
      .delete(records)
      .where(and(eq(records.projectId, projectId), eq(records.source, "inat")))
      .returning({ id: records.id });
    deleted = gbifDel.length + inatDel.length;

    // Drop county_presence — rebuilt on next ingest tick / lock.
    await tx
      .delete(countyPresence)
      .where(eq(countyPresence.projectId, projectId));

    // Drop open conflicts — re-detected on consolidate after re-ingest.
    await tx
      .delete(taxonConflicts)
      .where(eq(taxonConflicts.projectId, projectId));

    // Reset ingest jobs back to pending @ cursor 0.
    await tx
      .update(ingestJobs)
      .set({
        status: "pending",
        cursor: "0",
        fetched: 0,
        startedAt: null,
        finishedAt: null,
        error: null,
      })
      .where(eq(ingestJobs.projectId, projectId));

    // Drop taxa that no longer have any records OR cite-only references.
    // (We leave manual-only taxa intact.)
    const remainingTaxa = await tx
      .selectDistinct({ taxonId: records.taxonId })
      .from(records)
      .where(eq(records.projectId, projectId));
    const keepSet = new Set(remainingTaxa.map((r) => r.taxonId));
    const allTaxa = await tx
      .select({ id: taxa.id })
      .from(taxa)
      .where(eq(taxa.projectId, projectId));
    for (const t of allTaxa) {
      if (!keepSet.has(t.id)) {
        await tx.delete(taxa).where(eq(taxa.id, t.id));
      }
    }

    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "restart_ingest",
      targetType: "project",
      targetId: projectId,
      after: { deletedRecords: deleted },
    });
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true, data: { deletedRecords: deleted } };
}

/**
 * Delete the project entirely. Lead-only. Cascades remove all related rows
 * (taxa, records, conflicts, comments, activity_log, etc.). Requires the
 * caller to confirm the project name (echo back) to avoid accidents.
 */
export async function deleteProject(
  projectId: string,
  confirmName: string,
): Promise<ActionResult> {
  const userId = await requireCurrentUserId();
  try {
    await requireRole(projectId, "Lead");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return { ok: false, error: "project not found" };
  if (project.name.trim() !== confirmName.trim()) {
    return {
      ok: false,
      error: "confirmation name does not match the project name",
    };
  }

  void userId; // Audit trail will not include this delete — the project row vanishes.
  await db.delete(projects).where(eq(projects.id, projectId));

  revalidatePath(`/dashboard`);
  redirect(`/dashboard`);
}
