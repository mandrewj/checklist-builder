/**
 * pnpm set-admin <clerk-user-id> [--off]
 *
 * Grants (or with --off, revokes) super-user status. An admin is treated as
 * Lead on every project and sees all projects on their dashboard.
 *
 * If the user row doesn't exist yet, it's created (same as seed:adopt) so you
 * can promote an account that signed up before the Clerk webhook existed.
 */

import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/lib/db/schema";

const clerkId = process.argv[2];
const turnOff = process.argv.includes("--off");
if (!clerkId || clerkId.startsWith("--")) {
  console.error("usage: pnpm set-admin <clerk-user-id> [--off]");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[set-admin] DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.id, clerkId!),
  });
  if (!existing) {
    if (turnOff) {
      console.error(`[set-admin] no user ${clerkId} to revoke.`);
      process.exit(1);
    }
    console.log(`[set-admin] user ${clerkId} not found — creating row`);
    await db.insert(schema.users).values({
      id: clerkId!,
      email: `${clerkId}@placeholder.local`,
      displayName: "Admin",
      initials: "AD",
      isAdmin: true,
    });
  } else {
    await db
      .update(schema.users)
      .set({ isAdmin: !turnOff })
      .where(eq(schema.users.id, clerkId!));
  }

  console.log(
    `[set-admin] ${clerkId} isAdmin = ${!turnOff}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("[set-admin] failed:", err);
  process.exit(1);
});
