/**
 * Loads the full project state needed for any export format. One big read
 * transaction; the result is shared across all formatters.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  activityLog,
  comments,
  countyPresence,
  memberships,
  projects,
  records,
  taxa,
  taxonConflicts,
  users,
  type ActivityLogRow,
  type CommentRow,
  type CountyPresenceRow,
  type MembershipRow,
  type ProjectRow,
  type RecordRow,
  type TaxonConflictRow,
  type TaxonRow,
  type UserRow,
} from "@/lib/db/schema";

export interface ProjectSnapshot {
  project: ProjectRow;
  snapshotId: string;
  members: ReadonlyArray<{ user: UserRow; role: MembershipRow["role"] }>;
  taxa: ReadonlyArray<TaxonRow>;
  records: ReadonlyArray<RecordRow>;
  countyPresence: ReadonlyArray<CountyPresenceRow>;
  taxonConflicts: ReadonlyArray<TaxonConflictRow>;
  comments: ReadonlyArray<CommentRow>;
  activityLog: ReadonlyArray<ActivityLogRow>;
  generatedAt: Date;
}

export async function loadSnapshot(
  projectId: string,
): Promise<ProjectSnapshot> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error("project not found");
  if (!project.lockedSnapshotId) {
    throw new Error("project must be locked before exporting");
  }

  const [
    memberRows,
    taxaRows,
    recordRows,
    countyPresenceRows,
    conflictRows,
    commentRows,
    activityRows,
  ] = await Promise.all([
    db
      .select({ user: users, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.projectId, projectId)),
    db.select().from(taxa).where(eq(taxa.projectId, projectId)),
    db.select().from(records).where(eq(records.projectId, projectId)),
    db
      .select()
      .from(countyPresence)
      .where(eq(countyPresence.projectId, projectId)),
    db
      .select()
      .from(taxonConflicts)
      .where(eq(taxonConflicts.projectId, projectId)),
    db.select().from(comments).where(eq(comments.projectId, projectId)),
    db
      .select()
      .from(activityLog)
      .where(eq(activityLog.projectId, projectId)),
  ]);

  return {
    project,
    snapshotId: project.lockedSnapshotId,
    members: memberRows,
    taxa: taxaRows,
    records: recordRows,
    countyPresence: countyPresenceRows,
    taxonConflicts: conflictRows,
    comments: commentRows,
    activityLog: activityRows,
    generatedAt: new Date(),
  };
}
