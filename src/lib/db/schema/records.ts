import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  check,
  date,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { recordSourceEnum, recordStatusEnum } from "./enums";
import { projects } from "./projects";
import { taxa } from "./taxa";
import { users } from "./users";

export const records = pgTable(
  "records",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    taxonId: text("taxon_id")
      .references(() => taxa.id, { onDelete: "cascade" })
      .notNull(),
    source: recordSourceEnum("source").notNull(),
    externalId: text("external_id"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    stateCode: text("state_code"),
    countyFips: text("county_fips"),
    observedAt: date("observed_at"),
    collector: text("collector"),
    imageUrl: text("image_url"),
    raw: jsonb("raw"),
    status: recordStatusEnum("status").notNull().default("pending"),
    flagReason: text("flag_reason"),
    citation: text("citation"),
    doi: text("doi"),
    notes: text("notes"),
    addedBy: text("added_by").references(() => users.id),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_records_project_taxon").on(t.projectId, t.taxonId),
    index("idx_records_county").on(t.projectId, t.countyFips),
    index("idx_records_status").on(t.projectId, t.status),
    index("idx_records_source").on(t.projectId, t.source),
    uniqueIndex("uq_records_external").on(t.projectId, t.source, t.externalId),
    check(
      "ck_cite_citation",
      sql`${t.source} <> 'cite' OR ${t.citation} IS NOT NULL`,
    ),
  ],
);

export type RecordRow = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
