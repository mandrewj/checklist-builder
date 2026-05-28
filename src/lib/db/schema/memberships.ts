import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { roleEnum } from "./enums";
import { projects } from "./projects";
import { users } from "./users";

export const memberships = pgTable(
  "memberships",
  {
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    role: roleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("idx_memberships_user").on(t.userId),
  ],
);

export type MembershipRow = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
