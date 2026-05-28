/**
 * Apply Drizzle migrations against the Neon database referenced by
 * DATABASE_URL. Run `pnpm db:migrate` locally after generating a new
 * migration with `pnpm db:generate`.
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import ws from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "drizzle");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

async function main() {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  console.log(`[migrate] applying migrations from ${MIGRATIONS_DIR}`);
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  await pool.end();
  console.log("[migrate] done");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
