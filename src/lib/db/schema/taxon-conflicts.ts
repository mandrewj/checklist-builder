import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { conflictResolutionEnum } from "./enums";
import { projects } from "./projects";
import { taxa } from "./taxa";
import { users } from "./users";

export const taxonConflicts = pgTable(
  "taxon_conflicts",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    taxonId: text("taxon_id").references(() => taxa.id),
    gbifName: text("gbif_name").notNull(),
    gbifAuthority: text("gbif_authority"),
    inatName: text("inat_name").notNull(),
    inatAuthority: text("inat_authority"),
    gbifRecords: integer("gbif_records").notNull().default(0),
    inatRecords: integer("inat_records").notNull().default(0),
    note: text("note").default(""),
    resolution: conflictResolutionEnum("resolution"),
    resolvedBy: text("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    customName: text("custom_name"),
  },
  (t) => [
    index("idx_conflicts_project").on(t.projectId),
    index("idx_conflicts_open")
      .on(t.projectId)
      .where(sql`${t.resolution} IS NULL`),
  ],
);

export type TaxonConflictRow = typeof taxonConflicts.$inferSelect;
export type NewTaxonConflict = typeof taxonConflicts.$inferInsert;
