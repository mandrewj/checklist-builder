import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { exportFormatEnum } from "./enums";
import { projects } from "./projects";
import { users } from "./users";

export const exportArtifacts = pgTable(
  "export_artifacts",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    snapshotId: text("snapshot_id").notNull(),
    format: exportFormatEnum("format").notNull(),
    blobUrl: text("blob_url").notNull(),
    bytes: integer("bytes"),
    generatedBy: text("generated_by")
      .references(() => users.id)
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_exports_proj_snap").on(t.projectId, t.snapshotId)],
);

export type ExportArtifactRow = typeof exportArtifacts.$inferSelect;
export type NewExportArtifact = typeof exportArtifacts.$inferInsert;
