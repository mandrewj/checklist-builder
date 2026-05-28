/**
 * pnpm seed:adopt <clerk-user-id>
 *
 * Transfers ownership of every project from the placeholder `system` user
 * to the named Clerk user, and grants them Lead membership on each project.
 * Run once after the first real user signs in via Clerk so they inherit
 * the seed Tenebrionidae project.
 */

import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/lib/db/schema";

const clerkId = process.argv[2];
if (!clerkId) {
  console.error("usage: pnpm seed:adopt <clerk-user-id>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[adopt] DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  // Verify the Clerk user has been mirrored locally (the webhook should have
  // done this on user.created).
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, clerkId!),
  });
  if (!user) {
    console.error(
      `[adopt] no user with id "${clerkId}" in users table — make sure the user has signed in (the Clerk webhook seeds them).`,
    );
    process.exit(1);
  }

  // Re-point ownership.
  const projects = await db.select().from(schema.projects);
  console.log(`[adopt] transferring ${projects.length} project(s) to ${user.displayName} (${clerkId})`);
  for (const p of projects) {
    await db
      .update(schema.projects)
      .set({ createdBy: user.id, updatedAt: new Date() })
      .where(eq(schema.projects.id, p.id));
    // Grant Lead membership (idempotent — upsert).
    await db
      .insert(schema.memberships)
      .values({
        projectId: p.id,
        userId: user.id,
        role: "Lead",
      })
      .onConflictDoUpdate({
        target: [schema.memberships.projectId, schema.memberships.userId],
        set: { role: "Lead" },
      });
  }

  // Re-point cite-only addedBy on seed records.
  await db.execute(
    sql`UPDATE records SET added_by = ${user.id} WHERE added_by = 'system'`,
  );

  console.log("[adopt] done");
  await pool.end();
}

main().catch((err) => {
  console.error("[adopt] failed:", err);
  process.exit(1);
});
