/**
 * pnpm seed:adopt <clerk-user-id> [email] [display-name]
 *
 * Transfers ownership of every project from the placeholder `system` user
 * to the named Clerk user, and grants them Lead membership on each project.
 * Run once after the first real user signs in via Clerk so they inherit
 * the seed Tenebrionidae project.
 *
 * If the user row doesn't exist yet (e.g. they signed up before the Clerk
 * webhook was configured), it is created. Pass email + display-name to make
 * the row accurate; otherwise placeholders are used and the webhook will
 * correct them on the next user.updated event.
 */

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, sql } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/lib/db/schema";
import { deriveInitials } from "../src/lib/auth/user-identity";

const clerkId = process.argv[2];
const argEmail = process.argv[3];
const argName = process.argv[4];
if (!clerkId) {
  console.error('usage: pnpm seed:adopt <clerk-user-id> [email] ["Display Name"]');
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

  // Normally the Clerk webhook mirrors the user on user.created. If the row
  // isn't there yet (signed up before the webhook was configured), create one.
  // When a name is provided, set displayName + initials (e.g. "Andrew
  // Johnston" → "AJ") on both the create and the update path so an existing
  // email-derived row gets fixed.
  let user = await db.query.users.findFirst({
    where: eq(schema.users.id, clerkId!),
  });
  const nameProvided = (argName ?? argEmail) !== undefined;
  const displayName = argName ?? argEmail ?? "Lab Lead";
  const initials = deriveInitials(displayName);

  if (!user) {
    const email = argEmail ?? `${clerkId}@placeholder.local`;
    console.log(`[adopt] user ${clerkId} not found — creating row (${displayName}, ${initials})`);
    const [created] = await db
      .insert(schema.users)
      .values({ id: clerkId!, email, displayName, initials })
      .returning();
    user = created;
  } else if (nameProvided) {
    console.log(`[adopt] updating ${clerkId} → ${displayName} (${initials})`);
    const set: { displayName: string; initials: string; email?: string } = {
      displayName,
      initials,
    };
    if (argEmail) set.email = argEmail;
    const [updated] = await db
      .update(schema.users)
      .set(set)
      .where(eq(schema.users.id, clerkId!))
      .returning();
    user = updated;
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
