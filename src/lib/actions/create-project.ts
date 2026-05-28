"use server";

import { redirect } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db/client";
import {
  activityLog,
  ingestJobs,
  memberships,
  projects,
  type IngestFilters,
  type TaxonQuery,
} from "@/lib/db/schema";
import { requireCurrentUserId } from "@/lib/auth/dev-auth";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreateProjectInput {
  name: string;
  description?: string;
  taxonQuery: TaxonQuery;
  regionCodes: ReadonlyArray<string>;
  ingestFilters: IngestFilters;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<ActionResult<{ projectId: string }>> {
  const userId = await requireCurrentUserId();
  if (!input.name.trim()) {
    return { ok: false, error: "name is required" };
  }
  if (!input.regionCodes.length) {
    return { ok: false, error: "at least one region is required" };
  }
  if (!input.taxonQuery.gbifKey && !input.taxonQuery.inatId) {
    return {
      ok: false,
      error: "taxon must have a GBIF key or iNat id for ingest to work",
    };
  }

  const projectId = createId();
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(projects).values({
        id: projectId,
        name: input.name.trim(),
        description: input.description?.trim() ?? "",
        taxonQuery: input.taxonQuery,
        regionCodes: input.regionCodes as string[],
        ingestFilters: input.ingestFilters,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(memberships).values({
        projectId,
        userId,
        role: "Lead",
        joinedAt: now,
      });
      const sources: Array<"gbif" | "inat"> = [];
      if (input.taxonQuery.gbifKey) sources.push("gbif");
      if (input.taxonQuery.inatId) sources.push("inat");
      if (sources.length > 0) {
        await tx.insert(ingestJobs).values(
          sources.map((s) => ({
            projectId,
            source: s,
            status: "pending" as const,
            cursor: "0",
          })),
        );
      }
      await tx.insert(activityLog).values({
        projectId,
        actorId: userId,
        action: "create",
        targetType: "project",
        targetId: projectId,
        after: {
          name: input.name.trim(),
          taxonQuery: input.taxonQuery,
          regionCodes: input.regionCodes,
        },
      });
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "failed to create project",
    };
  }

  redirect(`/projects/${projectId}`);
}
