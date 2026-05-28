import { notFound } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { Lock } from "lucide-react";
import { db } from "@/lib/db/client";
import {
  memberships,
  projects,
  records,
  taxonConflicts,
  users,
} from "@/lib/db/schema";
import { getProjectAccess } from "@/lib/auth/dev-auth";
import { AppShell } from "@/components/layout/app-shell";
import { KeyboardHelp } from "@/components/layout/keyboard-help";
import { ProjectSidebar } from "@/components/layout/project-sidebar";
import { ProjectTopBar } from "@/components/layout/project-top-bar";

export const dynamic = "force-dynamic";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { id } = await params;

  const access = await getProjectAccess(id);
  if (!access) notFound();
  const project = access.project;
  // For public viewers we use "Public" as a synthetic, mutation-blocked role.
  const role: "Lead" | "Contributor" | "Reviewer" | "Public" =
    access.kind === "member" ? access.membership.role : "Public";

  // Sidebar/top-bar data — kept in parallel.
  const [members, openConflicts, citeOnlyRecords] = await Promise.all([
    db
      .select({
        userId: memberships.userId,
        initials: users.initials,
        displayName: users.displayName,
        joinedAt: memberships.joinedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.projectId, id))
      .orderBy(memberships.joinedAt),
    db
      .select({ n: count() })
      .from(taxonConflicts)
      .where(
        and(
          eq(taxonConflicts.projectId, id),
          isNull(taxonConflicts.resolution),
        ),
      ),
    db
      .select({ n: count() })
      .from(records)
      .where(and(eq(records.projectId, id), eq(records.source, "cite"))),
  ]);

  return (
    <AppShell
      topBar={
        <ProjectTopBar
          project={project}
          role={role}
          members={members}
        />
      }
      banner={
        project.lockedAt ? <LockedBanner snapshotId={project.lockedSnapshotId} /> : null
      }
      sidebar={
        <ProjectSidebar
          projectId={id}
          openConflictsCount={openConflicts[0]?.n ?? 0}
          manualCount={citeOnlyRecords[0]?.n ?? 0}
        />
      }
    >
      {children}
      <KeyboardHelp />
    </AppShell>
  );
}

function LockedBanner({ snapshotId }: { snapshotId: string | null }) {
  return (
    <div className="flex items-center gap-2 border-b border-warning-600/30 bg-warning-50 px-6 py-2 text-sm text-warning-700">
      <Lock className="size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-bold">Project locked — read only.</strong>{" "}
        Mutating actions are blocked. Snapshot{" "}
        <code className="font-mono text-xs">{snapshotId ?? "—"}</code> is
        being used by Exports.
      </span>
    </div>
  );
}
