import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import type { IngestFilters, TaxonQuery } from "./types";

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    taxonQuery: jsonb("taxon_query").$type<TaxonQuery>().notNull(),
    regionCodes: text("region_codes").array().notNull(),
    ingestFilters: jsonb("ingest_filters").$type<IngestFilters>().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedSnapshotId: text("locked_snapshot_id"),
    isPublic: boolean("is_public").notNull().default(false),
    createdBy: text("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_projects_created_by").on(t.createdBy),
    index("idx_projects_locked")
      .on(t.lockedAt)
      .where(sql`${t.lockedAt} IS NOT NULL`),
  ],
);

export type ProjectRow = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
