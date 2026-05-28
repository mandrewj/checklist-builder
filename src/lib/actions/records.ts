"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  projects,
  records,
  type NewActivityLog,
  type RecordRow,
} from "@/lib/db/schema";
import {
  AuthorizationError,
  requireCurrentUserId,
  requireRole,
} from "@/lib/auth/dev-auth";

type RecordStatus = "pending" | "accepted" | "rejected" | "flagged";
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

async function loadProjectScopedRecords(ids: string[]): Promise<RecordRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(records)
    .where(inArray(records.id, ids));
}

/** Single-record status mutation. Contributor+ required; project unlocked. */
export async function setRecordStatus(
  recordId: string,
  status: RecordStatus,
  flagReason?: string,
): Promise<ActionResult> {
  return setRecordStatusBatch([recordId], status, flagReason);
}

/** Bulk status mutation — same auth + project semantics, one transaction. */
export async function setRecordStatusBatch(
  recordIds: string[],
  status: RecordStatus,
  flagReason?: string,
): Promise<ActionResult> {
  if (recordIds.length === 0) {
    return { ok: false, error: "no records selected" };
  }

  const userId = await requireCurrentUserId();
  const rows = await loadProjectScopedRecords(recordIds);
  if (rows.length !== recordIds.length) {
    return { ok: false, error: "some records were not found" };
  }
  const projectIds = new Set(rows.map((r) => r.projectId));
  if (projectIds.size > 1) {
    return { ok: false, error: "records span multiple projects" };
  }
  const projectId = rows[0].projectId;
  const taxonIds = new Set(rows.map((r) => r.taxonId));

  try {
    await requireRole(projectId, "Contributor");
    await requireUnlocked(projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  const trimmedReason = (flagReason ?? "").trim() || null;

  await db.transaction(async (tx) => {
    await tx
      .update(records)
      .set({
        status,
        flagReason: status === "flagged" ? trimmedReason : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(records.projectId, projectId),
          inArray(records.id, recordIds),
        ),
      );

    const entries: NewActivityLog[] = rows.map((r) => ({
      projectId,
      actorId: userId,
      action: status,
      targetType: "record",
      targetId: r.id,
      before: { status: r.status, flagReason: r.flagReason },
      after: {
        status,
        flagReason: status === "flagged" ? trimmedReason : null,
      },
    }));
    await tx.insert(activityLog).values(entries);
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/checklist`);
  for (const tid of taxonIds) {
    revalidatePath(`/projects/${projectId}/species/${tid}`);
  }
  revalidatePath(`/projects/${projectId}/records`);
  return { ok: true, data: undefined };
}
