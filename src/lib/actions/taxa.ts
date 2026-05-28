"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  projects,
  taxa,
  type NewActivityLog,
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
    throw new AuthorizationError(
      "project is locked — unlock to make changes",
    );
  }
}

/**
 * Set a taxon's inclusion state. Contributor+ required; project must be
 * unlocked. The mutation + activity-log insert run in one transaction.
 */
export async function setTaxonInclusion(
  taxonId: string,
  value: "include" | "exclude" | "undecided",
  reasoning: string,
): Promise<ActionResult> {
  const userId = await requireCurrentUserId();
  const taxon = await db.query.taxa.findFirst({
    where: eq(taxa.id, taxonId),
  });
  if (!taxon) return { ok: false, error: "taxon not found" };

  try {
    await requireRole(taxon.projectId, "Contributor");
    await requireUnlocked(taxon.projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  const before = {
    included: taxon.included,
    inclusionReasoning: taxon.inclusionReasoning,
  };
  const trimmedReasoning = reasoning.trim();

  await db.transaction(async (tx) => {
    await tx
      .update(taxa)
      .set({
        included: value,
        inclusionReasoning: trimmedReasoning,
        inclusionUpdatedAt: new Date(),
        inclusionUpdatedBy: userId,
      })
      .where(eq(taxa.id, taxonId));

    const entry: NewActivityLog = {
      projectId: taxon.projectId,
      actorId: userId,
      action: value, // 'include' | 'exclude' | 'undecided'
      targetType: "taxon",
      targetId: taxonId,
      before,
      after: { included: value, inclusionReasoning: trimmedReasoning },
    };
    await tx.insert(activityLog).values(entry);
  });

  revalidatePath(`/projects/${taxon.projectId}/species/${taxonId}`);
  revalidatePath(`/projects/${taxon.projectId}/checklist`);
  revalidatePath(`/projects/${taxon.projectId}`);
  return { ok: true, data: undefined };
}
