/**
 * Ingest job runner. Advances one running `ingest_jobs` row by one page,
 * upserting records and (where coordinates allow) reverse-geocoding to a
 * county FIPS. Designed to be polled by Vercel Cron (1/min) but exposed via
 * a "Run ingest" button for local dev too.
 *
 * Idempotent: re-running a job with the same cursor is safe because we
 * upsert on (project_id, source, externalId). Status flips to 'done' when
 * the source returns 0 results.
 */

import { createId } from "@paralleldrive/cuid2";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  countyPresence,
  ingestJobs,
  records,
  taxa,
  type IngestJobRow,
  type IngestFilters,
  type NewRecord,
  type TaxonExternalIds,
} from "@/lib/db/schema";
import { projects } from "@/lib/db/schema";
import { gbifOccurrencePage, type GbifOccurrence } from "@/lib/sources/gbif";
import { inatObservationPage, type InatObservation } from "@/lib/sources/inat";
import { inatPlaceIdsFor } from "@/lib/sources/inat-places";
import { reverseGeocode } from "@/lib/geo/reverse-geocode";
import { canonicalize } from "@/lib/insectid/canonicalize";
import { resolveTaxonIds } from "@/lib/sources/taxon-resolver";

const MAX_PAGES_PER_TICK = 1;

interface ProjectContext {
  id: string;
  createdBy: string; // used as the actor for system-generated activity entries
  taxonQuery: { gbifKey?: number; inatId?: number };
  filters: IngestFilters;
  regionCodes: string[];
  taxonId?: string; // resolved at first ingest
}

export interface AdvanceResult {
  jobId: string;
  status: IngestJobRow["status"];
  fetched: number;
  inserted: number;
  cursor: string | null;
  error?: string;
}

async function loadProjectContext(projectId: string): Promise<ProjectContext> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error(`project ${projectId} not found`);
  return {
    id: project.id,
    createdBy: project.createdBy,
    taxonQuery: project.taxonQuery,
    filters: project.ingestFilters,
    regionCodes: project.regionCodes,
  };
}

async function ensureTaxon(
  projectId: string,
  rawName: string,
  rawAuthority: string | null,
  source: "gbif" | "inat",
  externalIds: TaxonExternalIds,
  family: string | null,
): Promise<string> {
  // Canonical-name dedup so GBIF ("Anthicus cervinus LaFerté-Sénectère, 1849")
  // and iNat ("Anthicus cervinus") collapse to one taxon row. Authorship is
  // captured separately when the caller didn't already supply it.
  const { canonical, authority: parsedAuthority } = canonicalize(rawName);
  const authority = rawAuthority ?? parsedAuthority;

  const existing = await db.query.taxa.findFirst({
    where: and(
      eq(taxa.projectId, projectId),
      eq(taxa.scientificName, canonical),
    ),
  });
  if (existing) {
    // If the existing row was missing an authority and we now have one
    // (e.g. iNat created the row, GBIF supplies authority), fill it in.
    // Also merge externalIds so both backbone keys are stored.
    const updates: Partial<typeof taxa.$inferInsert> = {};
    if (!existing.authority && authority) updates.authority = authority;
    let mergedIds: TaxonExternalIds | null = null;
    if (existing.externalIds) {
      const merged = { ...existing.externalIds, ...externalIds };
      if (
        merged.gbifKey !== existing.externalIds.gbifKey ||
        merged.inatId !== existing.externalIds.inatId
      ) {
        mergedIds = merged;
        updates.externalIds = merged;
      } else {
        mergedIds = existing.externalIds;
      }
    } else {
      mergedIds = externalIds;
      updates.externalIds = externalIds;
    }
    if (!existing.family && family) updates.family = family;

    // If still missing the *other* source's ID after the merge, try to
    // resolve it. This fires the *first* time a taxon is seen from a
    // second source as well as the first source — once both IDs are set,
    // it's a no-op.
    if (mergedIds && (!mergedIds.gbifKey || !mergedIds.inatId)) {
      try {
        const resolved = await resolveTaxonIds({
          scientificName: canonical,
          gbifKey: mergedIds.gbifKey,
          inatId: mergedIds.inatId,
        });
        if (
          resolved.gbifKey !== mergedIds.gbifKey ||
          resolved.inatId !== mergedIds.inatId
        ) {
          updates.externalIds = {
            ...mergedIds,
            ...(resolved.gbifKey ? { gbifKey: resolved.gbifKey } : {}),
            ...(resolved.inatId ? { inatId: resolved.inatId } : {}),
          };
        }
      } catch (err) {
        console.warn("[ingest] cross-source resolve failed for", canonical, err);
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(taxa).set(updates).where(eq(taxa.id, existing.id));
    }
    return existing.id;
  }

  // New taxon: try to fill in whichever source didn't seed the row.
  let mergedExternalIds = externalIds;
  if (!externalIds.gbifKey || !externalIds.inatId) {
    try {
      const resolved = await resolveTaxonIds({
        scientificName: canonical,
        gbifKey: externalIds.gbifKey,
        inatId: externalIds.inatId,
      });
      mergedExternalIds = {
        ...(resolved.gbifKey ? { gbifKey: resolved.gbifKey } : {}),
        ...(resolved.inatId ? { inatId: resolved.inatId } : {}),
      };
    } catch (err) {
      console.warn("[ingest] cross-source resolve failed for", canonical, err);
    }
  }

  const id = createId();
  await db.insert(taxa).values({
    id,
    projectId,
    scientificName: canonical,
    authority: authority ?? null,
    rank: "species",
    source,
    externalIds: mergedExternalIds,
    family,
    included: "undecided",
  });
  return id;
}

function gbifStateProvincesFor(regionCodes: string[]): string[] {
  // Return ALL US state names in the project so GBIF can OR them via
  // repeated `&stateProvince=` params. Canada-only projects rely on
  // country=CA (province-level filter handled by reverseGeocode strictness).
  const names: string[] = [];
  for (const code of regionCodes) {
    if (!code.startsWith("US-")) continue;
    const name = USPS_TO_STATE_NAME[code.slice(3)];
    if (name) names.push(name);
  }
  return names;
}

// USPS → "Indiana"-style state name (subset; extend as needed).
const USPS_TO_STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
  MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

async function ingestGbifPage(
  job: IngestJobRow,
  ctx: ProjectContext,
): Promise<{ inserted: number; cursor: string | null; done: boolean }> {
  if (!ctx.taxonQuery.gbifKey) {
    return { inserted: 0, cursor: null, done: true };
  }
  const offset = Number(job.cursor ?? "0");
  const page = await gbifOccurrencePage({
    taxonKey: ctx.taxonQuery.gbifKey,
    country: ctx.regionCodes.some((c) => c.startsWith("CA-")) ? "CA" : "US",
    stateProvince: gbifStateProvincesFor(ctx.regionCodes),
    yearRange: [ctx.filters.yearStart, ctx.filters.yearEnd],
    basisOfRecord: ctx.filters.basisOfRecord,
    hasCoordinate: ctx.filters.requireCoordinates,
    offset,
  });
  if (page.results.length === 0) {
    return { inserted: 0, cursor: null, done: true };
  }

  const inserted = await upsertGbifRecords(ctx, page.results);
  const nextOffset = offset + page.results.length;
  return {
    inserted,
    cursor: String(nextOffset),
    done: page.endOfRecords,
  };
}

async function upsertGbifRecords(
  ctx: ProjectContext,
  rows: ReadonlyArray<GbifOccurrence>,
): Promise<number> {
  // Step 1 — pre-resolve a taxon id for each unique GBIF scientificName.
  // Done serially before the bulk insert so we never collide on the
  // taxa(unique scientificName) constraint during a transaction.
  const taxonByName = new Map<string, string>();
  for (const r of rows) {
    if (!r.scientificName || !r.taxonKey) continue;
    if (taxonByName.has(r.scientificName)) continue;
    const id = await ensureTaxon(
      ctx.id,
      r.scientificName,
      null,
      "gbif",
      { gbifKey: r.taxonKey },
      null,
    );
    taxonByName.set(r.scientificName, id);
  }

  // Step 2 — build the full list of new records (no DB yet).
  const values: NewRecord[] = [];
  for (const r of rows) {
    if (!r.scientificName || !r.taxonKey) continue;
    const taxonId = taxonByName.get(r.scientificName);
    if (!taxonId) continue;
    const lat = r.decimalLatitude ?? null;
    const lng = r.decimalLongitude ?? null;
    const geocoded =
      lat !== null && lng !== null
        ? reverseGeocode(lng, lat, ctx.regionCodes)
        : null;
    // Skip records whose coordinates are outside the project region entirely.
    // (GBIF's stateProvince filter is OR'd text-matching; some records slip
    // through with miscategorized state names. We trust the geometry.)
    if (lat !== null && lng !== null && geocoded === null) continue;
    values.push({
      id: createId(),
      projectId: ctx.id,
      taxonId,
      source: "gbif",
      externalId: `GBIF:${r.key}`,
      lat,
      lng,
      stateCode: geocoded?.stateCode ?? null,
      countyFips: geocoded?.countyFips ?? null,
      observedAt: r.eventDate?.slice(0, 10) ?? null,
      collector: r.recordedBy ?? null,
      imageUrl: r.media?.[0]?.identifier ?? null,
      raw: r as unknown as Record<string, unknown>,
      status: "pending",
      flagReason: null,
      addedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (values.length === 0) return 0;
  return bulkInsertRecords(values);
}

/**
 * Bulk-insert records in chunks well under Postgres' 65 535 bound-param
 * limit. Per-record column count × chunk size must stay under that.
 */
async function bulkInsertRecords(values: NewRecord[]): Promise<number> {
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    const rows = await db
      .insert(records)
      .values(slice)
      .onConflictDoNothing({
        target: [records.projectId, records.source, records.externalId],
      })
      .returning({ id: records.id });
    inserted += rows.length;
  }
  return inserted;
}

async function ingestInatPage(
  job: IngestJobRow,
  ctx: ProjectContext,
): Promise<{ inserted: number; cursor: string | null; done: boolean }> {
  if (!ctx.taxonQuery.inatId) {
    return { inserted: 0, cursor: null, done: true };
  }
  const idAbove = Number(job.cursor ?? "0");
  const placeIds = inatPlaceIdsFor(ctx.regionCodes);
  if (placeIds.length === 0 && ctx.regionCodes.length > 0) {
    throw new Error(
      `no iNat place_id for region codes: ${ctx.regionCodes.join(", ")}`,
    );
  }
  const page = await inatObservationPage({
    taxon_id: ctx.taxonQuery.inatId,
    place_ids: placeIds,
    quality: ctx.filters.qualityGrade === "research" ? "research" : "verifiable",
    d1: `${ctx.filters.yearStart}-01-01`,
    d2: `${ctx.filters.yearEnd}-12-31`,
    captive: !ctx.filters.excludeCaptive,
    requireCoordinates: ctx.filters.requireCoordinates,
    idAbove,
  });
  if (page.results.length === 0) {
    return { inserted: 0, cursor: null, done: true };
  }

  const inserted = await upsertInatRecords(ctx, page.results);
  const lastId = page.results.reduce(
    (max, o) => Math.max(max, o.id),
    idAbove,
  );
  return {
    inserted,
    cursor: String(lastId),
    done: page.results.length < (page.per_page || 200),
  };
}

async function upsertInatRecords(
  ctx: ProjectContext,
  rows: ReadonlyArray<InatObservation>,
): Promise<number> {
  // Pre-resolve taxa (serial, outside the bulk insert).
  const taxonByName = new Map<string, string>();
  for (const o of rows) {
    if (!o.taxon?.name) continue;
    if (taxonByName.has(o.taxon.name)) continue;
    const id = await ensureTaxon(
      ctx.id,
      o.taxon.name,
      null,
      "inat",
      { inatId: o.taxon.id },
      null,
    );
    taxonByName.set(o.taxon.name, id);
  }

  const values: NewRecord[] = [];
  for (const o of rows) {
    if (!o.taxon?.name) continue;
    const taxonId = taxonByName.get(o.taxon.name);
    if (!taxonId) continue;
    const lng = o.geojson?.coordinates[0] ?? null;
    const lat = o.geojson?.coordinates[1] ?? null;
    const geocoded =
      lat !== null && lng !== null && !o.obscured
        ? reverseGeocode(lng, lat, ctx.regionCodes)
        : null;
    // Skip non-obscured records whose coords don't fall within the project
    // region. iNat's place_id filter is reliable but a record can still hit
    // the edge between two states; we trust the polygon.
    if (
      lat !== null &&
      lng !== null &&
      !o.obscured &&
      geocoded === null
    ) continue;
    const imageUrl = o.photos?.[0]?.url
      ? o.photos[0].url.replace("/square.", "/medium.")
      : null;
    values.push({
      id: createId(),
      projectId: ctx.id,
      taxonId,
      source: "inat",
      externalId: `iNat:${o.id}`,
      lat,
      lng,
      stateCode: geocoded?.stateCode ?? null,
      countyFips: geocoded?.countyFips ?? null,
      observedAt: o.observed_on ?? null,
      collector: o.user.name ?? o.user.login ?? null,
      imageUrl,
      raw: o as unknown as Record<string, unknown>,
      status: o.obscured ? "flagged" : "pending",
      flagReason: o.obscured
        ? "iNat obscured coordinate (vulnerable taxon)"
        : null,
      addedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (values.length === 0) return 0;
  return bulkInsertRecords(values);
}

/**
 * Rebuild county_presence for a project from the records table.
 * Called after an ingest tick completes for a source (or on demand).
 */
export async function rebuildCountyPresence(projectId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(countyPresence).where(eq(countyPresence.projectId, projectId));
    // Aggregate accepted + pending records by taxon+county.
    const grouped = await tx
      .select({
        taxonId: records.taxonId,
        countyFips: records.countyFips,
        nRecords: sql<number>`count(*)::int`.as("n"),
        hasCiteOnly: sql<boolean>`bool_or(${records.source} = 'cite')`.as("has_cite"),
      })
      .from(records)
      .where(
        and(
          eq(records.projectId, projectId),
          sql`${records.countyFips} IS NOT NULL`,
          sql`${records.status} <> 'rejected'`,
        ),
      )
      .groupBy(records.taxonId, records.countyFips);
    for (const g of grouped) {
      if (!g.countyFips) continue;
      await tx.insert(countyPresence).values({
        projectId,
        taxonId: g.taxonId,
        countyFips: g.countyFips,
        nRecords: g.nRecords,
        hasCiteOnly: g.hasCiteOnly,
      });
    }
  });
}

/** Advance a single ingest_job by one page. Idempotent. */
export async function advanceOneJob(jobId: string): Promise<AdvanceResult> {
  const job = await db.query.ingestJobs.findFirst({
    where: eq(ingestJobs.id, jobId),
  });
  if (!job) throw new Error(`job ${jobId} not found`);
  if (job.status !== "running" && job.status !== "pending") {
    return {
      jobId,
      status: job.status,
      fetched: job.fetched,
      inserted: 0,
      cursor: job.cursor,
    };
  }

  await db
    .update(ingestJobs)
    .set({
      status: "running",
      startedAt: job.startedAt ?? new Date(),
      error: null,
    })
    .where(eq(ingestJobs.id, jobId));

  const ctx = await loadProjectContext(job.projectId);

  let inserted = 0;
  let cursor: string | null = job.cursor;
  let done = false;
  let error: string | undefined;

  try {
    for (let i = 0; i < MAX_PAGES_PER_TICK && !done; i++) {
      if (job.source === "gbif") {
        const step = await ingestGbifPage({ ...job, cursor }, ctx);
        inserted += step.inserted;
        cursor = step.cursor;
        done = step.done;
      } else if (job.source === "inat") {
        const step = await ingestInatPage({ ...job, cursor }, ctx);
        inserted += step.inserted;
        cursor = step.cursor;
        done = step.done;
      } else {
        throw new Error(`unknown source ${job.source}`);
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const newFetched = job.fetched + inserted;
  const status: IngestJobRow["status"] = error
    ? "failed"
    : done
      ? "done"
      : "running";

  await db
    .update(ingestJobs)
    .set({
      status,
      cursor,
      fetched: newFetched,
      finishedAt: done || error ? new Date() : null,
      error: error ?? null,
    })
    .where(eq(ingestJobs.id, jobId));

  if (done && !error) {
    await rebuildCountyPresence(ctx.id);
    // Attribute system-generated entries to the project owner so the FK on
    // activity_log.actor_id holds. Cron-driven ingest in production carries
    // the same provenance.
    await db.insert(activityLog).values({
      projectId: ctx.id,
      actorId: ctx.createdBy,
      action: "ingest_done",
      targetType: "project",
      targetId: ctx.id,
      after: { source: job.source, fetched: newFetched, automated: true },
    });
  }

  return { jobId, status, fetched: newFetched, inserted, cursor, error };
}

/** Advance every `running` or `pending` job; used by the cron handler. */
export async function advanceAllRunningJobs(): Promise<AdvanceResult[]> {
  const rows = await db
    .select({ id: ingestJobs.id })
    .from(ingestJobs)
    .where(sql`${ingestJobs.status} IN ('running', 'pending')`)
    .limit(5);
  const results: AdvanceResult[] = [];
  for (const r of rows) {
    results.push(await advanceOneJob(r.id));
  }
  return results;
}
