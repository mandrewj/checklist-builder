"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db/client";
import {
  activityLog,
  countyPresence,
  projects,
  records,
  taxa,
  type TaxonExternalIds,
} from "@/lib/db/schema";
import {
  AuthorizationError,
  requireCurrentUserId,
  requireRole,
} from "@/lib/auth/dev-auth";
import { canonicalize } from "@/lib/insectid/canonicalize";
import { US_COUNTIES } from "@/lib/insectid/regions.generated";
import { resolveTaxonIds } from "@/lib/sources/taxon-resolver";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const US_FIPS = /^\d{5}$/;
const CA_PROVINCE = /^CA-[A-Z]{2}$/;

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
 * Validate `countyFips` against the project's regionCodes and derive the
 * `stateCode` we'll persist on the record. Accepts either a 5-digit US FIPS
 * (the county must belong to a US-XX state the project covers) or a CA-XX
 * province code that the project covers.
 */
async function resolveRegionAtom(
  projectId: string,
  countyFips: string,
): Promise<{ ok: true; stateCode: string } | { ok: false; error: string }> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return { ok: false, error: "project not found" };

  if (US_FIPS.test(countyFips)) {
    const county = US_COUNTIES[countyFips];
    if (!county) return { ok: false, error: `unknown US county FIPS ${countyFips}` };
    if (!project.regionCodes.includes(county.stateCode)) {
      return {
        ok: false,
        error: `county ${countyFips} is not in this project's regions`,
      };
    }
    return { ok: true, stateCode: county.stateCode };
  }

  if (CA_PROVINCE.test(countyFips)) {
    if (!project.regionCodes.includes(countyFips)) {
      return {
        ok: false,
        error: `province ${countyFips} is not in this project's regions`,
      };
    }
    return { ok: true, stateCode: countyFips };
  }

  return {
    ok: false,
    error: "region must be a 5-digit FIPS or CA-XX province code",
  };
}

export interface AddManualRecordInput {
  projectId: string;
  taxonId: string;
  /** One or more 5-digit US FIPS / CA-XX province codes. Each generates a
   *  separate record sharing the same citation/doi/notes. */
  countyFips: string | ReadonlyArray<string>;
  citation: string;
  doi?: string;
  notes?: string;
}

/**
 * Insert cite-only records (source='cite') for an existing taxon. When
 * `countyFips` is an array, one record per atom is inserted in a single
 * transaction and county_presence is upserted per atom. Contributor+;
 * project must be unlocked.
 */
export async function addManualRecord(
  input: AddManualRecordInput,
): Promise<ActionResult<{ recordIds: string[] }>> {
  const userId = await requireCurrentUserId();

  if (!input.citation.trim()) {
    return { ok: false, error: "citation is required" };
  }
  const atoms = Array.isArray(input.countyFips)
    ? Array.from(new Set(input.countyFips))
    : [input.countyFips];
  if (atoms.length === 0) {
    return { ok: false, error: "at least one county/province is required" };
  }

  const taxon = await db.query.taxa.findFirst({
    where: and(eq(taxa.id, input.taxonId), eq(taxa.projectId, input.projectId)),
  });
  if (!taxon) return { ok: false, error: "taxon not found in this project" };

  try {
    await requireRole(input.projectId, "Contributor");
    await requireUnlocked(input.projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  // Validate all atoms up front; bail before any insert if one is bad.
  const resolved: Array<{ atom: string; stateCode: string }> = [];
  for (const atom of atoms) {
    const r = await resolveRegionAtom(input.projectId, atom);
    if (!r.ok) return r;
    resolved.push({ atom, stateCode: r.stateCode });
  }

  const citation = input.citation.trim();
  const recordIds: string[] = [];

  await db.transaction(async (tx) => {
    for (const { atom, stateCode } of resolved) {
      const recordId = createId();
      recordIds.push(recordId);
      await tx.insert(records).values({
        id: recordId,
        projectId: input.projectId,
        taxonId: input.taxonId,
        source: "cite",
        stateCode,
        countyFips: atom,
        citation,
        doi: input.doi?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "accepted",
        addedBy: userId,
      });

      await tx
        .insert(countyPresence)
        .values({
          projectId: input.projectId,
          taxonId: input.taxonId,
          countyFips: atom,
          nRecords: 1,
          hasCiteOnly: true,
        })
        .onConflictDoUpdate({
          target: [
            countyPresence.projectId,
            countyPresence.taxonId,
            countyPresence.countyFips,
          ],
          set: {
            nRecords: sql`${countyPresence.nRecords} + 1`,
            hasCiteOnly: true,
          },
        });

      await tx.insert(activityLog).values({
        projectId: input.projectId,
        actorId: userId,
        action: "add_manual",
        targetType: "record",
        targetId: recordId,
        after: { taxonId: input.taxonId, countyFips: atom, citation },
      });
    }
  });

  revalidatePath(`/projects/${input.projectId}/manual`);
  revalidatePath(`/projects/${input.projectId}/checklist`);
  revalidatePath(`/projects/${input.projectId}/species/${input.taxonId}`);
  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, data: { recordIds } };
}

export interface AddManualRecordWithNewTaxonInput {
  projectId: string;
  newTaxon: {
    scientificName: string;
    authority?: string;
    family?: string;
    gbifKey?: number;
    inatId?: number;
  };
  /** One or more 5-digit US FIPS / CA-XX province codes. */
  countyFips: string | ReadonlyArray<string>;
  citation: string;
  doi?: string;
  notes?: string;
}

/**
 * Create a new taxon (with auto-resolved GBIF + iNat IDs) and attach a
 * cite-only record to it, in a single transaction. Used by the cite-only
 * sheet's "+ create new taxon" mode. If a taxon with the same canonical
 * name already exists, returns that existing taxonId so the UI can offer
 * to attach to it instead.
 */
export async function addManualRecordWithNewTaxon(
  input: AddManualRecordWithNewTaxonInput,
): Promise<
  | ActionResult<{ recordIds: string[]; taxonId: string }>
  | { ok: false; error: string; existingTaxonId: string }
> {
  const userId = await requireCurrentUserId();

  if (!input.newTaxon.scientificName.trim()) {
    return { ok: false, error: "scientific name is required" };
  }
  if (!input.citation.trim()) {
    return { ok: false, error: "citation is required" };
  }
  const atoms = Array.isArray(input.countyFips)
    ? Array.from(new Set(input.countyFips))
    : [input.countyFips];
  if (atoms.length === 0) {
    return { ok: false, error: "at least one county/province is required" };
  }

  try {
    await requireRole(input.projectId, "Contributor");
    await requireUnlocked(input.projectId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  // Validate every atom before mutating anything.
  const resolvedAtoms: Array<{ atom: string; stateCode: string }> = [];
  for (const atom of atoms) {
    const r = await resolveRegionAtom(input.projectId, atom);
    if (!r.ok) return r;
    resolvedAtoms.push({ atom, stateCode: r.stateCode });
  }

  const { canonical, authority: parsedAuthority } = canonicalize(
    input.newTaxon.scientificName,
  );
  if (!canonical) {
    return { ok: false, error: "could not parse scientific name" };
  }

  // Collision check first — surface the existing taxon so the UI can offer
  // to attach to it.
  const existing = await db.query.taxa.findFirst({
    where: and(
      eq(taxa.projectId, input.projectId),
      eq(taxa.scientificName, canonical),
    ),
  });
  if (existing) {
    return {
      ok: false,
      error: "a taxon with this name already exists in the project",
      existingTaxonId: existing.id,
    };
  }

  // Auto-resolve any missing source IDs (best effort).
  const resolvedIds = await resolveTaxonIds({
    scientificName: canonical,
    gbifKey: input.newTaxon.gbifKey,
    inatId: input.newTaxon.inatId,
  });
  const externalIds: TaxonExternalIds = {};
  if (resolvedIds.gbifKey) externalIds.gbifKey = resolvedIds.gbifKey;
  if (resolvedIds.inatId) externalIds.inatId = resolvedIds.inatId;

  const taxonId = createId();
  const citation = input.citation.trim();
  const authority =
    (input.newTaxon.authority ?? parsedAuthority)?.trim() || null;
  const recordIds: string[] = [];

  await db.transaction(async (tx) => {
    await tx.insert(taxa).values({
      id: taxonId,
      projectId: input.projectId,
      scientificName: canonical,
      authority,
      rank: "species",
      source: "manual",
      externalIds,
      family: input.newTaxon.family?.trim() || null,
      included: "undecided",
    });
    await tx.insert(activityLog).values({
      projectId: input.projectId,
      actorId: userId,
      action: "taxon_add",
      targetType: "taxon",
      targetId: taxonId,
      after: { scientificName: canonical, authority, externalIds },
    });

    for (const { atom, stateCode } of resolvedAtoms) {
      const recordId = createId();
      recordIds.push(recordId);
      await tx.insert(records).values({
        id: recordId,
        projectId: input.projectId,
        taxonId,
        source: "cite",
        stateCode,
        countyFips: atom,
        citation,
        doi: input.doi?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "accepted",
        addedBy: userId,
      });

      await tx
        .insert(countyPresence)
        .values({
          projectId: input.projectId,
          taxonId,
          countyFips: atom,
          nRecords: 1,
          hasCiteOnly: true,
        })
        .onConflictDoUpdate({
          target: [
            countyPresence.projectId,
            countyPresence.taxonId,
            countyPresence.countyFips,
          ],
          set: {
            nRecords: sql`${countyPresence.nRecords} + 1`,
            hasCiteOnly: true,
          },
        });

      await tx.insert(activityLog).values({
        projectId: input.projectId,
        actorId: userId,
        action: "add_manual",
        targetType: "record",
        targetId: recordId,
        after: { taxonId, countyFips: atom, citation },
      });
    }
  });

  revalidatePath(`/projects/${input.projectId}/manual`);
  revalidatePath(`/projects/${input.projectId}/checklist`);
  revalidatePath(`/projects/${input.projectId}/species/${taxonId}`);
  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true, data: { recordIds, taxonId } };
}
