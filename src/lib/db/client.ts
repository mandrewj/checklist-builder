/**
 * Neon Postgres client + Drizzle binding.
 *
 * Lazily initializes the pool the first time the schema is touched so the
 * Next.js build can collect page data even when DATABASE_URL is unset
 * (e.g. in CI without secrets). At runtime, missing DATABASE_URL still
 * throws — just at the point of the first query, not at module evaluation.
 *
 * The Pool is cached on globalThis so Next.js hot-reload doesn't churn
 * fresh sockets on every request.
 *
 * Migrations are *not* applied at import time — use `pnpm db:migrate`
 * explicitly. Neon supports a real DDL transaction so the Drizzle migrator
 * works without quirks.
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const globalForDb = globalThis as unknown as {
  __neonPool?: Pool;
  __drizzleDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function getPool(): Pool {
  if (globalForDb.__neonPool) return globalForDb.__neonPool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set — populate it from Neon (Vercel Marketplace) in .env.local for local dev or via the Vercel project env for deploys.",
    );
  }
  globalForDb.__neonPool = new Pool({ connectionString: databaseUrl });
  return globalForDb.__neonPool;
}

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (globalForDb.__drizzleDb) return globalForDb.__drizzleDb;
  globalForDb.__drizzleDb = drizzle({
    client: getPool(),
    schema,
    casing: "snake_case",
  });
  return globalForDb.__drizzleDb;
}

// Proxy so existing imports of `db` keep their ergonomics — every property
// access dereferences the lazily-initialized Drizzle instance.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[prop as string];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(real);
    }
    return value;
  },
});

export type DB = ReturnType<typeof drizzle<typeof schema>>;
export { getPool as pool };
