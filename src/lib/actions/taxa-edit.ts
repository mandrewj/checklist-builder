"use server";

import { revalidatePath } from "next/cache";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  projects,
  taxa,
  type TaxonExternalIds,
} from "@/lib/db/schema";
import {
  AuthorizationError,
  requireCurrentUserId,
  requireRole,
} from "@/lib/auth/dev-auth";
import { canonicalize } from "@/lib/insectid/canonicalize";
import { resolveTaxonIds } from "@/lib/sources/taxon-resolver";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type DupError = {
  ok: false;
  error: "canonical name already exists in this project";
  existingTaxonId: string;
};

async function requireUnlocked(projectId: string): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error("project not found");
  if (project.lockedAt) {
    throw new AuthorizationError("project is locked — unlock to make changes");
  }
}

export interface TaxonFormInput {
  scientificName: string;
  authority?: string | null;
  rank?: string;
  family?: string | null;
  subfamily?: string | null;
  gbifKey?: number;
  inatId?: number;
}

/**
 * Add a new taxon manually. Contributor+; project unlocked.
 * Canonicalizes the scientific name; if a matching canonical already exists
 * in this project, returns a DupError pointing at the existing taxon so the
 * UI can offer to merge.
 */
export async function addManualTaxon(
  projectId: string,
  input: TaxonFormInput,
): Promise<ActionResult<{ taxonId: string }> | DupError> {
  const userId = await requireCurrentUserId();
  try {
    await requireRole(projectId, "Contributor");
    await requireUnlocked(projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    } as ActionResult<{ taxonId: string }>;
  }

  if (!input.scientificName.trim()) {
    return { ok: false, error: "scientific name is required" };
  }
  const { canonical, authority: parsedAuthority } = canonicalize(
    input.scientificName,
  );
  if (!canonical) {
    return { ok: false, error: "could not parse scientific name" };
  }

  const existing = await db.query.taxa.findFirst({
    where: and(
      eq(taxa.projectId, projectId),
      eq(taxa.scientificName, canonical),
    ),
  });
  if (existing) {
    return {
      ok: false,
      error: "canonical name already exists in this project",
      existingTaxonId: existing.id,
    };
  }

  // Auto-resolve any missing source IDs from GBIF backbone + iNat. Best
  // effort: if a provider is down we save with whatever the user supplied.
  const resolved = await resolveTaxonIds({
    scientificName: canonical,
    gbifKey: input.gbifKey,
    inatId: input.inatId,
  });
  const externalIds: TaxonExternalIds = {};
  if (resolved.gbifKey) externalIds.gbifKey = resolved.gbifKey;
  if (resolved.inatId) externalIds.inatId = resolved.inatId;

  const id = createId();
  await db.transaction(async (tx) => {
    await tx.insert(taxa).values({
      id,
      projectId,
      scientificName: canonical,
      authority: (input.authority ?? parsedAuthority)?.trim() || null,
      rank: input.rank?.trim() || "species",
      source: "manual",
      externalIds,
      family: input.family?.trim() || null,
      subfamily: input.subfamily?.trim() || null,
      included: "undecided",
    });
    await tx.insert(activityLog).values({
      projectId,
      actorId: userId,
      action: "taxon_add",
      targetType: "taxon",
      targetId: id,
      after: {
        scientificName: canonical,
        authority: (input.authority ?? parsedAuthority) || null,
        rank: input.rank ?? "species",
        externalIds,
      },
    });
  });

  revalidatePath(`/projects/${projectId}/checklist`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, data: { taxonId: id } };
}

/**
 * Edit an existing taxon. If the canonical name changes to one that collides
 * with another taxon in the project, returns a DupError so the UI can offer
 * to merge instead.
 */
export async function editTaxon(
  taxonId: string,
  patch: TaxonFormInput,
): Promise<ActionResult | DupError> {
  const userId = await requireCurrentUserId();
  const taxon = await db.query.taxa.findFirst({ where: eq(taxa.id, taxonId) });
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

  if (!patch.scientificName?.trim()) {
    return { ok: false, error: "scientific name is required" };
  }
  const { canonical, authority: parsedAuthority } = canonicalize(
    patch.scientificName,
  );

  // Collision check — only relevant when the canonical name changed.
  if (canonical !== taxon.scientificName) {
    const collision = await db.query.taxa.findFirst({
      where: and(
        eq(taxa.projectId, taxon.projectId),
        eq(taxa.scientificName, canonical),
        ne(taxa.id, taxonId),
      ),
    });
    if (collision) {
      return {
        ok: false,
        error: "canonical name already exists in this project",
        existingTaxonId: collision.id,
      };
    }
  }

  const before = {
    scientificName: taxon.scientificName,
    authority: taxon.authority,
    rank: taxon.rank,
    family: taxon.family,
    subfamily: taxon.subfamily,
    externalIds: taxon.externalIds,
  };

  const externalIds: TaxonExternalIds = { ...taxon.externalIds };
  if (patch.gbifKey !== undefined) externalIds.gbifKey = patch.gbifKey || undefined;
  if (patch.inatId !== undefined) externalIds.inatId = patch.inatId || undefined;

  // If either source key is still missing after the patch (or if the name
  // just changed and the old IDs no longer apply), try to resolve them from
  // GBIF + iNat. Pre-existing keys take precedence over re-lookup.
  const nameChanged = canonical !== taxon.scientificName;
  if (nameChanged || !externalIds.gbifKey || !externalIds.inatId) {
    const lookup = await resolveTaxonIds({
      scientificName: canonical,
      // On a name change, drop the old IDs so the resolver looks fresh.
      gbifKey: nameChanged ? undefined : externalIds.gbifKey,
      inatId: nameChanged ? undefined : externalIds.inatId,
    });
    if (lookup.gbifKey) externalIds.gbifKey = lookup.gbifKey;
    if (lookup.inatId) externalIds.inatId = lookup.inatId;
  }

  const after = {
    scientificName: canonical,
    authority: (patch.authority ?? parsedAuthority)?.trim() || null,
    rank: patch.rank?.trim() || taxon.rank,
    family: patch.family?.trim() || null,
    subfamily: patch.subfamily?.trim() || null,
    externalIds,
  };

  await db.transaction(async (tx) => {
    await tx.update(taxa).set(after).where(eq(taxa.id, taxonId));
    await tx.insert(activityLog).values({
      projectId: taxon.projectId,
      actorId: userId,
      action: "taxon_edit",
      targetType: "taxon",
      targetId: taxonId,
      before,
      after,
    });
  });

  revalidatePath(`/projects/${taxon.projectId}/checklist`);
  revalidatePath(`/projects/${taxon.projectId}/species/${taxonId}`);
  revalidatePath(`/projects/${taxon.projectId}`);
  return { ok: true, data: undefined };
}
