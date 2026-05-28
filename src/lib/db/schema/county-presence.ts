import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { taxa } from "./taxa";

// Maintained by triggers in production; rebuilt on lock for export snapshots.
// The seed script populates this directly from the canned dataset.
export const countyPresence = pgTable(
  "county_presence",
  {
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    taxonId: text("taxon_id")
      .references(() => taxa.id, { onDelete: "cascade" })
      .notNull(),
    countyFips: text("county_fips").notNull(),
    nRecords: integer("n_records").notNull(),
    hasCiteOnly: boolean("has_cite_only").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.taxonId, t.countyFips] }),
    index("idx_cp_taxon_county").on(t.taxonId, t.countyFips),
  ],
);

export type CountyPresenceRow = typeof countyPresence.$inferSelect;
export type NewCountyPresence = typeof countyPresence.$inferInsert;
