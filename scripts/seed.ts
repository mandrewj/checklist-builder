/**
 * pnpm seed
 *
 * Resets the Neon database referenced by DATABASE_URL and seeds it with the
 * single Tenebrionidae of Indiana (2018–2024) reference project. No dev
 * users; the project is owned by a placeholder `system` user. Once a real
 * user signs in via Clerk, run `pnpm seed:adopt <clerk-user-id>` to transfer
 * ownership and grant Lead.
 *
 * Safe to re-run; every table is truncated in FK-safe order first.
 */

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { sql } from "drizzle-orm";
import ws from "ws";

import * as schema from "../src/lib/db/schema";
import {
  CONFLICTS,
  MANUAL_ENTRIES,
  PROJECTS,
  RECORDS_BY_TAXON,
  TAXA,
} from "../src/lib/seed/tenebrionidae-indiana";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "drizzle");

const SYSTEM_USER_ID = "system";
const SEED_PROJECT_ID = "p1";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed] DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  console.log("[seed] applying migrations");
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  // Wipe in FK-safe order. Cascades on projects handle most child rows, but
  // explicit deletes are cheaper and make the script idempotent regardless.
  console.log("[seed] wiping existing data");
  await db.execute(sql`TRUNCATE TABLE
    activity_log,
    comments,
    county_presence,
    export_artifacts,
    ingest_jobs,
    memberships,
    records,
    taxon_conflicts,
    taxa,
    projects,
    users
    RESTART IDENTITY CASCADE`);

  // Step 1 — placeholder system user. Lives only so FKs from the seed
  // project resolve; real users come from Clerk's user.created webhook.
  console.log("[seed] inserting system placeholder user");
  await db.insert(schema.users).values({
    id: SYSTEM_USER_ID,
    email: "system@checklist-builder.invalid",
    displayName: "Seed",
    initials: "SY",
  });

  // Step 2 — the single seed project (Tenebrionidae of Indiana).
  const p = PROJECTS.find((proj) => proj.id === SEED_PROJECT_ID);
  if (!p) throw new Error(`seed project ${SEED_PROJECT_ID} not found in fixtures`);
  console.log(`[seed] inserting project ${p.name}`);
  await db.insert(schema.projects).values({
    id: p.id,
    name: p.name,
    description: p.description,
    taxonQuery: {
      name: p.taxonQuery,
      rank: "family" as const,
      gbifKey: 7919,
      inatId: 52719,
    },
    regionCodes: p.regionCodes,
    ingestFilters: {
      yearStart: 2018,
      yearEnd: 2024,
      basisOfRecord: ["HUMAN_OBSERVATION", "PRESERVED_SPECIMEN", "MATERIAL_SAMPLE"],
      qualityGrade: "research_or_needs_id" as const,
      requireCoordinates: true,
      excludeCaptive: true,
      coordinatePrecisionDp: 2,
    },
    lockedAt: null,
    lockedSnapshotId: null,
    createdBy: SYSTEM_USER_ID,
  });

  // Step 3 — taxa.
  console.log(`[seed] inserting ${TAXA.length} taxa`);
  await db.insert(schema.taxa).values(
    TAXA.map((t) => ({
      id: t.id,
      projectId: SEED_PROJECT_ID,
      scientificName: t.scientificName,
      authority: t.authority,
      rank: t.rank,
      source:
        t.sources.length === 1
          ? (t.sources[0] as "gbif" | "inat")
          : ("gbif" as const),
      externalIds: {
        ...(t.gbifKey ? { gbifKey: t.gbifKey } : {}),
        ...(t.inatId ? { inatId: t.inatId } : {}),
      },
      family: t.family,
      subfamily: t.subfamily,
      included: t.inclusion,
      inclusionReasoning: t.inclusionReasoning,
    })),
  );

  // Step 4 — county_presence.
  console.log("[seed] inserting county_presence rows");
  const presenceRows: Array<typeof schema.countyPresence.$inferInsert> = [];
  for (const t of TAXA) {
    for (const [fips, n] of Object.entries(t.countyPresence)) {
      presenceRows.push({
        projectId: SEED_PROJECT_ID,
        taxonId: t.id,
        countyFips: fips,
        nRecords: n,
        hasCiteOnly: MANUAL_ENTRIES.some(
          (m) => m.taxonId === t.id && m.countyFips === fips,
        ),
      });
    }
  }
  if (presenceRows.length > 0) {
    await db.insert(schema.countyPresence).values(presenceRows);
  }

  // Step 5 — occurrence records.
  const allRecords = Object.values(RECORDS_BY_TAXON).flat();
  console.log(`[seed] inserting ${allRecords.length} occurrence records`);
  if (allRecords.length > 0) {
    await db.insert(schema.records).values(
      allRecords.map((r) => ({
        id: r.id,
        projectId: SEED_PROJECT_ID,
        taxonId: r.taxonId,
        source: r.source,
        externalId: r.externalId,
        lat: r.lat,
        lng: r.lng,
        stateCode: "US-IN",
        countyFips: r.countyFips,
        observedAt: r.observedAt,
        collector: r.collector,
        imageUrl: r.imageUrl,
        status: r.status,
        flagReason: r.flagReason ?? null,
        addedBy: null,
        addedAt: new Date(r.observedAt),
        updatedAt: new Date(r.observedAt),
      })),
    );
  }

  // Step 6 — cite-only manual entries.
  console.log(`[seed] inserting ${MANUAL_ENTRIES.length} cite-only entries`);
  if (MANUAL_ENTRIES.length > 0) {
    await db.insert(schema.records).values(
      MANUAL_ENTRIES.map((m) => ({
        id: m.id,
        projectId: SEED_PROJECT_ID,
        taxonId: m.taxonId,
        source: "cite" as const,
        externalId: null,
        lat: null,
        lng: null,
        stateCode: "US-IN",
        countyFips: m.countyFips,
        observedAt: null,
        collector: null,
        imageUrl: null,
        status: "accepted" as const,
        citation: m.citation,
        doi: m.doi || null,
        notes: m.notes,
        addedBy: SYSTEM_USER_ID,
        addedAt: new Date(m.addedAt),
        updatedAt: new Date(m.addedAt),
      })),
    );
  }

  // Step 7 — taxon conflicts.
  console.log(`[seed] inserting ${CONFLICTS.length} conflicts`);
  if (CONFLICTS.length > 0) {
    await db.insert(schema.taxonConflicts).values(
      CONFLICTS.map((c) => ({
        id: c.id,
        projectId: SEED_PROJECT_ID,
        taxonId: c.taxonId,
        gbifName: c.gbifName,
        gbifAuthority: c.gbifAuthority,
        inatName: c.inatName,
        inatAuthority: c.inatAuthority,
        gbifRecords: c.gbifRecords,
        inatRecords: c.inatRecords,
        note: c.note,
        resolution: null,
      })),
    );
  }

  const counts = {
    users: (await db.select().from(schema.users)).length,
    projects: (await db.select().from(schema.projects)).length,
    taxa: (await db.select().from(schema.taxa)).length,
    records: (await db.select().from(schema.records)).length,
    conflicts: (await db.select().from(schema.taxonConflicts)).length,
  };
  console.log("[seed] done:", counts);

  await pool.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "cause" in err) {
    console.error("[seed] cause:", (err as { cause: unknown }).cause);
  }
  process.exit(1);
});
