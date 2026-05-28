"use server";

import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activityLog, projects } from "@/lib/db/schema";
import { requireCurrentUserId, requireRole } from "@/lib/auth/dev-auth";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Lock a project for export. Lead-only. Stamps `locked_at` and generates a
 * fresh `locked_snapshot_id` (`ss_<cuid>`). Exports run against this
 * snapshot id.
 */
export async function lockProject(
  projectId: string,
): Promise<ActionResult<{ snapshotId: string }>> {
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
  if (project.lockedAt) {
    return {
      ok: true,
      data: { snapshotId: project.lockedSnapshotId ?? "" },
    };
  }

  const snapshotId = `ss_${createId()}`;
  const lockedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ lockedAt, lockedSnapshotId: snapshotId, updatedAt: lockedAt })
      .where(eq(projects.id, projectId));
    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "lock",
      targetType: "project",
      targetId: projectId,
      after: { snapshotId, lockedAt: lockedAt.toISOString() },
    });
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true, data: { snapshotId } };
}

/** Unlock the project. Lead-only. Retains export artifacts. */
export async function unlockProject(
  projectId: string,
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
  if (!project.lockedAt) return { ok: true, data: undefined };

  const lockedAt = project.lockedAt;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ lockedAt: null, updatedAt: now })
      .where(eq(projects.id, projectId));
    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "unlock",
      targetType: "project",
      targetId: projectId,
      before: { lockedAt: lockedAt.toISOString() },
    });
  });

  revalidatePath(`/projects/${projectId}`, "layout");
  return { ok: true, data: undefined };
}
