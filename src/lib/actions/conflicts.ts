"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  projects,
  taxa,
  taxonConflicts,
  type NewActivityLog,
} from "@/lib/db/schema";
import {
  AuthorizationError,
  requireCurrentUserId,
  requireRole,
} from "@/lib/auth/dev-auth";

type ConflictResolution = "gbif" | "inat" | "separate" | "merged";
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
 * Resolve a taxonomic conflict. Contributor+ required; project unlocked.
 *
 * Resolutions:
 *  - gbif:     keep the GBIF name on the taxon row
 *  - inat:     rename the taxon to the iNat name
 *  - separate: leave the taxon alone (we don't try to split into 2 taxa in MVP)
 *  - merged:   set the taxon's scientific_name to `customName`
 */
export async function resolveConflict(
  conflictId: string,
  resolution: ConflictResolution,
  customName?: string,
): Promise<ActionResult> {
  const userId = await requireCurrentUserId();
  const conflict = await db.query.taxonConflicts.findFirst({
    where: eq(taxonConflicts.id, conflictId),
  });
  if (!conflict) return { ok: false, error: "conflict not found" };

  try {
    await requireRole(conflict.projectId, "Contributor");
    await requireUnlocked(conflict.projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  if (resolution === "merged" && !customName?.trim()) {
    return { ok: false, error: "merged resolution requires a custom name" };
  }

  // Determine the resolved name + source the taxon should adopt.
  const trimmedCustom = customName?.trim();
  let resolvedName: string | null = null;
  let resolvedAuthority: string | null = null;
  if (resolution === "gbif") {
    resolvedName = conflict.gbifName;
    resolvedAuthority = conflict.gbifAuthority;
  } else if (resolution === "inat") {
    resolvedName = conflict.inatName;
    resolvedAuthority = conflict.inatAuthority;
  } else if (resolution === "merged") {
    resolvedName = trimmedCustom!;
    resolvedAuthority = null;
  }
  // 'separate' leaves the taxon untouched.

  const before = {
    resolution: conflict.resolution,
    customName: conflict.customName,
  };

  await db.transaction(async (tx) => {
    await tx
      .update(taxonConflicts)
      .set({
        resolution,
        customName: trimmedCustom ?? null,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(eq(taxonConflicts.id, conflictId));

    if (resolvedName && conflict.taxonId) {
      await tx
        .update(taxa)
        .set({
          scientificName: resolvedName,
          authority: resolvedAuthority,
        })
        .where(eq(taxa.id, conflict.taxonId));
    }

    const entry: NewActivityLog = {
      projectId: conflict.projectId,
      actorId: userId,
      action: "conflict_resolve",
      targetType: "conflict",
      targetId: conflictId,
      before,
      after: { resolution, customName: trimmedCustom ?? null },
    };
    await tx.insert(activityLog).values(entry);
  });

  revalidatePath(`/projects/${conflict.projectId}/conflicts`);
  revalidatePath(`/projects/${conflict.projectId}/checklist`);
  revalidatePath(`/projects/${conflict.projectId}`);
  if (conflict.taxonId) {
    revalidatePath(
      `/projects/${conflict.projectId}/species/${conflict.taxonId}`,
    );
  }
  return { ok: true, data: undefined };
}
