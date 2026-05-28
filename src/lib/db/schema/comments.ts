import { createId } from "@paralleldrive/cuid2";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { users } from "./users";

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    authorId: text("author_id")
      .references(() => users.id)
      .notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_comments_target").on(t.projectId, t.targetType, t.targetId),
  ],
);

export type CommentRow = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
