import Link from "next/link";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  memberships,
  projects,
  records,
  taxa,
  taxonConflicts,
  users,
  type MembershipRow,
  type ProjectRow,
  type UserRow,
} from "@/lib/db/schema";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/auth/dev-auth";
import { AvatarStack } from "@/components/insectid/avatar-stack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface ProjectCardRow extends ProjectRow {
  role: MembershipRow["role"];
  nTaxa: number;
  nRecords: number;
  nOpenConflicts: number;
  members: ReadonlyArray<Pick<UserRow, "initials" | "displayName">>;
}

async function loadDashboardData(
  userId: string,
  isAdmin: boolean,
): Promise<ProjectCardRow[]> {
  // Step 1 — projects to show. Members see their own; admins see every
  // project (left-joining their own membership so the badge reflects an
  // explicit role when they have one, else Lead via the super-user rule).
  const userProjects = isAdmin
    ? (
        await db
          .select({ project: projects, role: memberships.role })
          .from(projects)
          .leftJoin(
            memberships,
            and(
              eq(memberships.projectId, projects.id),
              eq(memberships.userId, userId),
            ),
          )
          .orderBy(desc(projects.updatedAt))
      ).map((r) => ({ project: r.project, role: r.role ?? ("Lead" as const) }))
    : await db
        .select({ project: projects, role: memberships.role })
        .from(projects)
        .innerJoin(memberships, eq(memberships.projectId, projects.id))
        .where(eq(memberships.userId, userId))
        .orderBy(desc(projects.updatedAt));

  if (userProjects.length === 0) return [];

  const projectIds = userProjects.map((p) => p.project.id);

  // Step 2 — per-project aggregates in three parallel grouped queries.
  const [taxaCounts, recordCounts, openConflictCounts, allMemberships] =
    await Promise.all([
      db
        .select({
          projectId: taxa.projectId,
          n: count(),
        })
        .from(taxa)
        .where(inArray(taxa.projectId, projectIds))
        .groupBy(taxa.projectId),
      db
        .select({
          projectId: records.projectId,
          n: count(),
        })
        .from(records)
        .where(inArray(records.projectId, projectIds))
        .groupBy(records.projectId),
      db
        .select({
          projectId: taxonConflicts.projectId,
          n: count(),
        })
        .from(taxonConflicts)
        .where(
          and(
            inArray(taxonConflicts.projectId, projectIds),
            isNull(taxonConflicts.resolution),
          ),
        )
        .groupBy(taxonConflicts.projectId),
      db
        .select({
          projectId: memberships.projectId,
          initials: users.initials,
          displayName: users.displayName,
          joinedAt: memberships.joinedAt,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(inArray(memberships.projectId, projectIds))
        .orderBy(memberships.joinedAt),
    ]);

  const byProject = <T extends { projectId: string }>(
    rows: T[],
  ): Map<string, T> => new Map(rows.map((r) => [r.projectId, r]));

  const taxaByProject = byProject(taxaCounts);
  const recordsByProject = byProject(recordCounts);
  const openConflictsByProject = byProject(openConflictCounts);
  const membersByProject = new Map<
    string,
    Array<{ initials: string; displayName: string }>
  >();
  for (const row of allMemberships) {
    const arr = membersByProject.get(row.projectId) ?? [];
    arr.push({ initials: row.initials, displayName: row.displayName });
    membersByProject.set(row.projectId, arr);
  }

  return userProjects.map(({ project, role }) => ({
    ...project,
    role,
    nTaxa: taxaByProject.get(project.id)?.n ?? 0,
    nRecords: recordsByProject.get(project.id)?.n ?? 0,
    nOpenConflicts: openConflictsByProject.get(project.id)?.n ?? 0,
    members: membersByProject.get(project.id) ?? [],
  }));
}

function roleBadgeVariant(role: MembershipRow["role"]) {
  switch (role) {
    case "Lead":
      return "default" as const;
    case "Contributor":
      return "secondary" as const;
    case "Reviewer":
      return "outline" as const;
  }
}

export default async function DashboardPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/sign-in");
  const isAdmin = me.isAdmin;
  const projectsForMe = await loadDashboardData(me.id, isAdmin);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-8 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Dashboard</span>
          <h1 className="rule text-3xl font-black">
            {isAdmin ? "All projects" : "Your projects"}
          </h1>
          <p className="text-sm text-text-400">
            Signed in as <strong className="text-text-700">{me.displayName}</strong>{" "}
            ({me.email})
            {isAdmin && (
              <span className="ml-2 inline-flex items-center rounded-full border border-blue-600/40 bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-blue-700">
                Admin · all projects
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Link href="/projects/new">+ New project</Link>
          </Button>
          <UserButton />
        </div>
      </header>

      {projectsForMe.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {projectsForMe.map((p) => (
            <li key={p.id}>
              <ProjectCard p={p} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ProjectCard({ p }: { p: ProjectCardRow }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card transition-shadow hover:shadow-pop">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold leading-snug text-blue-800">
            {p.name}
          </h2>
          <p className="text-[11px] uppercase tracking-[0.08em] text-text-400">
            {p.taxonQuery.name} · {p.regionCodes.join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {p.lockedAt && (
            <Badge variant="outline" className="border-warning-600/40 text-warning-700">
              Locked
            </Badge>
          )}
          <Badge variant={roleBadgeVariant(p.role)}>{p.role}</Badge>
        </div>
      </header>

      <p className="line-clamp-3 text-sm text-text-500">{p.description}</p>

      <div className="grid grid-cols-3 gap-2 border-t border-surface-3 pt-4">
        <Stat label="Taxa" value={p.nTaxa} />
        <Stat label="Records" value={p.nRecords} />
        <Stat
          label="Open conflicts"
          value={p.nOpenConflicts}
          tone={p.nOpenConflicts > 0 ? "warning" : "neutral"}
        />
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-surface-3 pt-4">
        <AvatarStack
          list={p.members.map((m) => ({
            initials: m.initials,
            title: m.displayName,
          }))}
          size="sm"
          max={4}
        />
        <Button asChild size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
          <Link href={`/projects/${p.id}`}>Open →</Link>
        </Button>
      </footer>
    </article>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-text-400">
        {label}
      </span>
      <span
        className={
          tone === "warning" && value > 0
            ? "text-xl font-black text-warning-700"
            : "text-xl font-black text-text-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-3 bg-surface-1 px-8 py-16 text-center">
      <h2 className="text-lg font-bold text-blue-800">No projects yet</h2>
      <p className="max-w-sm text-sm text-text-400">
        You are not a member of any projects. Switch user, or once project
        creation is wired, start a new checklist.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/sign-in">Switch user</Link>
      </Button>
    </div>
  );
}
