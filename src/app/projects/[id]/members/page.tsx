import { asc, eq } from "drizzle-orm";
import { Mail } from "lucide-react";
import { db } from "@/lib/db/client";
import { memberships, users } from "@/lib/db/schema";
import { getMembership } from "@/lib/auth/dev-auth";
import { PageHeader } from "@/components/insectid/page-header";
import { Avatar } from "@/components/insectid/avatar";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface MembersPageProps {
  params: Promise<{ id: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { id: projectId } = await params;

  const [callerMembership, members] = await Promise.all([
    getMembership(projectId),
    db
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        initials: users.initials,
        role: memberships.role,
        joinedAt: memberships.joinedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.projectId, projectId))
      .orderBy(asc(memberships.joinedAt)),
  ]);

  const isLead = callerMembership?.role === "Lead";

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Members"
        title="Project members"
        description={
          isLead
            ? "Invite, change role, remove. Lead-only edits — wired in once Clerk is in place."
            : "Lead-only edits. Contact the project Lead to add or change roles."
        }
      />

      <div className="flex flex-col gap-5 px-8 py-6">
        <ul className="overflow-hidden rounded-xl border border-surface-3 bg-surface-0 shadow-card">
          {members.map((m, idx) => (
            <li
              key={m.userId}
              className={`flex items-center gap-4 px-5 py-3 ${
                idx > 0 ? "border-t border-surface-3" : ""
              }`}
            >
              <Avatar initials={m.initials} title={m.displayName} size="md" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold text-text-700">
                  {m.displayName}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-text-500">
                  <Mail className="size-3" aria-hidden />
                  {m.email}
                </span>
              </div>
              <Badge variant={roleBadgeVariant(m.role)} className="shrink-0">
                {m.role}
              </Badge>
              <span className="hidden text-[11px] text-text-400 sm:inline-block">
                joined{" "}
                {new Date(m.joinedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </li>
          ))}
        </ul>

        {isLead && (
          <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-8">
            <span className="eyebrow">Invite by email</span>
            <p className="mt-2 text-sm text-text-500">
              Invitation flow lands once Clerk is wired. It will use Clerk's
              <code className="mx-1 rounded bg-surface-3 px-1 py-0.5 font-mono text-xs">
                invitations.createInvitation
              </code>
              API and stamp the new member's role via{" "}
              <code className="mx-1 rounded bg-surface-3 px-1 py-0.5 font-mono text-xs">
                publicMetadata
              </code>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function roleBadgeVariant(role: "Lead" | "Contributor" | "Reviewer") {
  switch (role) {
    case "Lead":
      return "default" as const;
    case "Contributor":
      return "secondary" as const;
    case "Reviewer":
      return "outline" as const;
  }
}
