import type { ProjectSnapshot } from "./snapshot";

/** Stable JSON serialization of the project snapshot. */
export function buildJsonExport(snapshot: ProjectSnapshot): Buffer {
  const payload = {
    snapshot: {
      id: snapshot.snapshotId,
      generatedAt: snapshot.generatedAt.toISOString(),
    },
    project: snapshot.project,
    members: snapshot.members.map((m) => ({
      role: m.role,
      ...m.user,
    })),
    taxa: snapshot.taxa,
    records: snapshot.records,
    county_presence: snapshot.countyPresence,
    taxon_conflicts: snapshot.taxonConflicts,
    comments: snapshot.comments,
    activity_log: snapshot.activityLog,
  };
  return Buffer.from(JSON.stringify(payload, null, 2), "utf8");
}
