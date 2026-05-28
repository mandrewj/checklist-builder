import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { ingestStatusEnum } from "./enums";
import { projects } from "./projects";

export const ingestJobs = pgTable(
  "ingest_jobs",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    source: text("source").notNull(),
    status: ingestStatusEnum("status").notNull().default("pending"),
    cursor: text("cursor"),
    pageSize: integer("page_size").notNull().default(300),
    fetched: integer("fetched").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    index("idx_ingest_proj_status").on(t.projectId, t.status),
    index("idx_ingest_running")
      .on(t.status)
      .where(sql`${t.status} = 'running'`),
  ],
);

export type IngestJobRow = typeof ingestJobs.$inferSelect;
export type NewIngestJob = typeof ingestJobs.$inferInsert;
