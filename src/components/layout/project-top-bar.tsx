import Link from "next/link";
import { Globe, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/insectid/avatar-stack";
import { cn } from "@/lib/utils";
import type { MembershipRow, ProjectRow, UserRow } from "@/lib/db/schema";
import { LockControls } from "./lock-controls";

export type ViewerRole = MembershipRow["role"] | "Public";

export interface ProjectTopBarProps {
  project: ProjectRow;
  role: ViewerRole;
  /** True when the viewer is here via super-user status, not a real
   *  membership. Shows an "Admin" badge in place of the role badge. */
  viaAdmin?: boolean;
  members: ReadonlyArray<Pick<UserRow, "initials" | "displayName">>;
}

function roleBadgeVariant(role: ViewerRole) {
  switch (role) {
    case "Lead":
      return "default" as const;
    case "Contributor":
      return "secondary" as const;
    case "Reviewer":
      return "outline" as const;
    case "Public":
      return "outline" as const;
  }
}

export function ProjectTopBar({
  project,
  role,
  viaAdmin,
  members,
}: ProjectTopBarProps) {
  const locked = !!project.lockedAt;
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-surface-3 bg-surface-0 px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-400 transition-colors hover:text-blue-600"
        >
          ← Dashboard
        </Link>
        <span className="text-surface-3" aria-hidden>|</span>
        <h1 className="truncate text-sm font-bold text-text-700">
          {project.name}
        </h1>
        {viaAdmin ? (
          <Badge
            variant="default"
            className="shrink-0 gap-1 bg-blue-800 text-white"
            title="You are viewing this project as a super-user, not a member. You have full Lead-level control."
          >
            <ShieldCheck className="size-3" aria-hidden />
            Admin
          </Badge>
        ) : (
          <Badge variant={roleBadgeVariant(role)} className="shrink-0">
            {role}
          </Badge>
        )}
        {locked && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 border-warning-600/40 text-warning-700",
              "gap-1",
            )}
          >
            <Lock className="size-3" aria-hidden />
            Locked
          </Badge>
        )}
        {project.isPublic && (
          <Badge
            variant="outline"
            className="shrink-0 gap-1 border-blue-600/40 text-blue-700"
          >
            <Globe className="size-3" aria-hidden />
            Public
          </Badge>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {members.length > 0 && (
          <AvatarStack
            list={members.map((m) => ({
              initials: m.initials,
              title: m.displayName,
            }))}
            size="sm"
            max={4}
          />
        )}
        {role === "Lead" && (
          <LockControls projectId={project.id} locked={locked} />
        )}
      </div>
    </header>
  );
}
