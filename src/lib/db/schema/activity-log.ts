import { createId } from "@paralleldrive/cuid2";
import { desc } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";

export const activityLog = pgTable(
  "activity_log",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    actorId: text("actor_id")
      .references(() => users.id)
      .notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    parentId: text("parent_id"),
    ts: timestamp("ts", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_activity_project_ts").on(t.projectId, desc(t.ts)),
    index("idx_activity_actor").on(t.projectId, t.actorId),
    index("idx_activity_action").on(t.projectId, t.action),
  ],
);

export type ActivityLogRow = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
