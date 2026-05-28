import { createId } from "@paralleldrive/cuid2";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { inclusionEnum, taxonSourceEnum } from "./enums";
import { projects } from "./projects";
import { users } from "./users";
import type { TaxonExternalIds } from "./types";

export const taxa = pgTable(
  "taxa",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    scientificName: text("scientific_name").notNull(),
    authority: text("authority"),
    rank: text("rank").notNull(),
    parentId: text("parent_id"),
    source: taxonSourceEnum("source").notNull(),
    externalIds: jsonb("external_ids").$type<TaxonExternalIds>().notNull(),
    family: text("family"),
    subfamily: text("subfamily"),
    included: inclusionEnum("included").notNull().default("undecided"),
    inclusionReasoning: text("inclusion_reasoning").default(""),
    inclusionUpdatedAt: timestamp("inclusion_updated_at", {
      withTimezone: true,
    }),
    inclusionUpdatedBy: text("inclusion_updated_by").references(() => users.id),
  },
  (t) => [
    index("idx_taxa_project").on(t.projectId),
    index("idx_taxa_name").on(t.projectId, t.scientificName),
    index("idx_taxa_included").on(t.projectId, t.included),
  ],
);

export type TaxonRow = typeof taxa.$inferSelect;
export type NewTaxon = typeof taxa.$inferInsert;
