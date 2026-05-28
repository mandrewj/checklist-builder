import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { activityLog, users } from "@/lib/db/schema";
import { PageHeader } from "@/components/insectid/page-header";
import { Avatar } from "@/components/insectid/avatar";
import { FilterChip } from "@/components/insectid/filter-chip";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ActivityPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ACTION_TONE: Record<string, string> = {
  include:          "bg-success-50 text-success-700",
  accepted:         "bg-success-50 text-success-700",
  exclude:          "bg-surface-2  text-text-500",
  rejected:         "bg-danger-50  text-danger-600",
  reject:           "bg-danger-50  text-danger-600",
  flag:             "bg-warning-50 text-warning-700",
  flagged:          "bg-warning-50 text-warning-700",
  comment:          "bg-blue-50    text-blue-800",
  conflict_open:    "bg-warning-50 text-warning-700",
  conflict_resolve: "bg-blue-50    text-blue-800",
  add_manual:       "bg-cyan-50    text-cyan-600",
  ingest:           "bg-blue-50    text-blue-800",
  create:           "bg-blue-50    text-blue-800",
};

export default async function ActivityPage({
  params,
  searchParams,
}: ActivityPageProps) {
  const { id: projectId } = await params;
  const sp = await searchParams;
  const memberFilter = Array.isArray(sp.member) ? sp.member[0] : sp.member;
  const actionFilter = Array.isArray(sp.action) ? sp.action[0] : sp.action;

  const [entries, projectMembers, distinctActions] = await Promise.all([
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        targetType: activityLog.targetType,
        targetId: activityLog.targetId,
        before: activityLog.before,
        after: activityLog.after,
        ts: activityLog.ts,
        actorId: activityLog.actorId,
        actorInitials: users.initials,
        actorName: users.displayName,
      })
      .from(activityLog)
      .innerJoin(users, eq(users.id, activityLog.actorId))
      .where(
        and(
          eq(activityLog.projectId, projectId),
          memberFilter ? eq(activityLog.actorId, memberFilter) : undefined,
          actionFilter ? eq(activityLog.action, actionFilter) : undefined,
        ),
      )
      .orderBy(desc(activityLog.ts))
      .limit(200),
    db
      .selectDistinct({
        userId: activityLog.actorId,
        initials: users.initials,
        displayName: users.displayName,
      })
      .from(activityLog)
      .innerJoin(users, eq(users.id, activityLog.actorId))
      .where(eq(activityLog.projectId, projectId))
      .orderBy(asc(users.displayName)),
    db
      .selectDistinct({ action: activityLog.action })
      .from(activityLog)
      .where(eq(activityLog.projectId, projectId))
      .orderBy(asc(activityLog.action)),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Activity"
        title="Project activity"
        description={`${entries.length} entries shown · append-only audit trail. Filter by actor or action below.`}
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
              Actor
            </span>
            <FilterChip
              label="Everyone"
              param="member"
              value={null}
              active={!memberFilter}
            />
            {projectMembers.map((m) => (
              <FilterChip
                key={m.userId}
                label={m.displayName}
                param="member"
                value={m.userId}
                active={memberFilter === m.userId}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">
              Action
            </span>
            <FilterChip
              label="All actions"
              param="action"
              value={null}
              active={!actionFilter}
            />
            {distinctActions.map((a) => (
              <FilterChip
                key={a.action}
                label={a.action}
                param="action"
                value={a.action}
                active={actionFilter === a.action}
              />
            ))}
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-16 text-center text-sm text-text-400">
            No activity matches these filters.
          </div>
        ) : (
          <ol className="flex flex-col">
            {entries.map((e, idx) => {
              const tone = ACTION_TONE[e.action] ?? "bg-surface-2 text-text-500";
              const detail = extractDetail(e.after);
              return (
                <li key={e.id} className="flex gap-4 px-1 py-3">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <Avatar
                      initials={e.actorInitials}
                      title={e.actorName}
                      size="sm"
                    />
                    {idx !== entries.length - 1 && (
                      <span className="mt-1 h-full w-px bg-surface-3" aria-hidden />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pb-3">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-bold text-text-700">
                        {e.actorName}
                      </span>
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.06em]",
                          tone,
                        )}
                      >
                        {e.action}
                      </span>
                      <span className="text-[11px] text-text-400">
                        {e.targetType}/{e.targetId}
                      </span>
                      <span className="ml-auto text-[11px] text-text-400">
                        {new Date(e.ts).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    {detail && (
                      <p className="text-xs text-text-500">{detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function extractDetail(after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const obj = after as Record<string, unknown>;
  if (typeof obj.detail === "string") return obj.detail;
  // Best-effort summary of common shapes.
  if (typeof obj.included === "string") {
    const r =
      typeof obj.inclusionReasoning === "string" && obj.inclusionReasoning.trim()
        ? ` — ${obj.inclusionReasoning}`
        : "";
    return `${obj.included}${r}`;
  }
  if (typeof obj.status === "string") {
    const f = typeof obj.flagReason === "string" ? ` — ${obj.flagReason}` : "";
    return `${obj.status}${f}`;
  }
  if (typeof obj.resolution === "string") {
    const c =
      typeof obj.customName === "string" && obj.customName
        ? ` (${obj.customName})`
        : "";
    return `resolved as "${obj.resolution}"${c}`;
  }
  if (typeof obj.citation === "string") return obj.citation;
  return null;
}
