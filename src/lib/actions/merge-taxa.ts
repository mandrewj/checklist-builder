"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  comments,
  countyPresence,
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

/**
 * Merge `mergeIds[]` into `keepId`. All foreign keys to the merged taxa get
 * re-pointed to keepId; the merged taxa rows are deleted at the end. The
 * kept taxon's externalIds get unioned with the merged ones so both GBIF
 * and iNat keys are retained.
 *
 * Contributor+ required; project unlocked. Idempotent (re-running with the
 * same args is a no-op).
 */
export async function mergeTaxa(
  projectId: string,
  keepId: string,
  mergeIds: ReadonlyArray<string>,
): Promise<ActionResult<{ mergedCount: number }>> {
  const userId = await requireCurrentUserId();
  if (mergeIds.length === 0) {
    return { ok: false, error: "no taxa selected to merge" };
  }
  if (mergeIds.includes(keepId)) {
    return { ok: false, error: "cannot merge a taxon into itself" };
  }

  try {
    await requireRole(projectId, "Contributor");
    await requireUnlocked(projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  const keep = await db.query.taxa.findFirst({
    where: and(eq(taxa.id, keepId), eq(taxa.projectId, projectId)),
  });
  if (!keep) return { ok: false, error: "keep taxon not found in this project" };

  const mergeRows = await db
    .select()
    .from(taxa)
    .where(and(eq(taxa.projectId, projectId), inArray(taxa.id, [...mergeIds])));
  if (mergeRows.length === 0) {
    return { ok: false, error: "no merge taxa found in this project" };
  }

  // Merge externalIds across kept + all merged taxa so both backbone keys
  // are preserved on the surviving row.
  const mergedExternalIds = mergeRows.reduce(
    (acc, r) => ({ ...acc, ...r.externalIds }),
    { ...keep.externalIds },
  );
  // Merge family if the kept row was missing it.
  const family = keep.family ?? mergeRows.find((r) => r.family)?.family ?? null;

  await db.transaction(async (tx) => {
    // Update the kept taxon's metadata.
    await tx
      .update(taxa)
      .set({ externalIds: mergedExternalIds, family })
      .where(eq(taxa.id, keepId));

    // Re-point records.
    await tx
      .update(records)
      .set({ taxonId: keepId })
      .where(
        and(
          eq(records.projectId, projectId),
          inArray(records.taxonId, [...mergeIds]),
        ),
      );

    // Re-point comments (target_type = 'taxon').
    for (const mid of mergeIds) {
      await tx
        .update(comments)
        .set({ targetId: keepId })
        .where(
          and(
            eq(comments.projectId, projectId),
            eq(comments.targetType, "taxon"),
            eq(comments.targetId, mid),
          ),
        );
    }

    // Re-point activity_log entries that target the merged taxa.
    for (const mid of mergeIds) {
      await tx
        .update(activityLog)
        .set({ targetId: keepId })
        .where(
          and(
            eq(activityLog.projectId, projectId),
            eq(activityLog.targetType, "taxon"),
            eq(activityLog.targetId, mid),
          ),
        );
    }

    // Re-point taxon_conflicts (the conflict row's taxonId).
    await tx
      .update(taxonConflicts)
      .set({ taxonId: keepId })
      .where(
        and(
          eq(taxonConflicts.projectId, projectId),
          inArray(taxonConflicts.taxonId, [...mergeIds]),
        ),
      );

    // Drop any county_presence rows for the merged taxa — they'll be
    // rebuilt below from the now-repointed records.
    await tx
      .delete(countyPresence)
      .where(
        and(
          eq(countyPresence.projectId, projectId),
          inArray(countyPresence.taxonId, [...mergeIds]),
        ),
      );
    await tx
      .delete(countyPresence)
      .where(
        and(
          eq(countyPresence.projectId, projectId),
          eq(countyPresence.taxonId, keepId),
        ),
      );

    // Rebuild county_presence for the kept taxon from the re-pointed records.
    const grouped = await tx
      .select({
        countyFips: records.countyFips,
        nRecords: sql<number>`count(*)::int`.as("n"),
        hasCiteOnly: sql<boolean>`bool_or(${records.source} = 'cite')`.as("c"),
      })
      .from(records)
      .where(
        and(
          eq(records.projectId, projectId),
          eq(records.taxonId, keepId),
          sql`${records.countyFips} IS NOT NULL`,
          sql`${records.status} <> 'rejected'`,
        ),
      )
      .groupBy(records.countyFips);
    for (const g of grouped) {
      if (!g.countyFips) continue;
      await tx.insert(countyPresence).values({
        projectId,
        taxonId: keepId,
        countyFips: g.countyFips,
        nRecords: g.nRecords,
        hasCiteOnly: g.hasCiteOnly,
      });
    }

    // Finally drop the merged taxa rows.
    await tx
      .delete(taxa)
      .where(
        and(eq(taxa.projectId, projectId), inArray(taxa.id, [...mergeIds])),
      );

    // Audit entry.
    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "merge_taxa",
      targetType: "taxon",
      targetId: keepId,
      before: { mergedIds: mergeIds, mergedNames: mergeRows.map((r) => r.scientificName) },
      after: { keptName: keep.scientificName, externalIds: mergedExternalIds },
    });
  });

  revalidatePath(`/projects/${projectId}/checklist`);
  revalidatePath(`/projects/${projectId}/species/${keepId}`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: { mergedCount: mergeRows.length } };
}
