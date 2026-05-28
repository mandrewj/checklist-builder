import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    initials: text("initials").notNull(),
    // Super-user: treated as Lead on every project and sees all projects on
    // the dashboard. Granted out-of-band via `pnpm set-admin <clerk-id>`.
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("uq_users_email").on(t.email)],
);

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
