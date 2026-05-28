/**
 * Auth helpers — wraps Clerk's `auth()` so the rest of the app reads roles
 * and memberships from our own `users` + `memberships` tables.
 *
 * The Clerk webhook (`/api/clerk/webhook`) mirrors user.created events into
 * the users table so a Clerk userId always resolves to a local row. The
 * `system` placeholder user from the seed is the only exception; it owns
 * seed-time projects until `pnpm seed:adopt <clerk-user-id>` re-points
 * ownership to a real user.
 */

import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  memberships,
  projects,
  users,
  type MembershipRow,
  type ProjectRow,
  type UserRow,
} from "@/lib/db/schema";

const ROLE_RANK = { Reviewer: 1, Contributor: 2, Lead: 3 } as const;
type Role = keyof typeof ROLE_RANK;

export class AuthorizationError extends Error {
  constructor(message = "unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Returns the Clerk userId of the signed-in caller, or null if the request
 * is anonymous. Anonymous callers can still read public projects via
 * `getProjectAccess`.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Same as getCurrentUserId but throws when anonymous — for action paths. */
export async function requireCurrentUserId(): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new AuthorizationError("sign-in required");
  return uid;
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const id = await getCurrentUserId();
  if (!id) return null;
  const row = await db.query.users.findFirst({ where: eq(users.id, id) });
  return row ?? null;
}

/**
 * Whether the signed-in caller is a super-user. Memoized per request so the
 * admin lookup doesn't fan out across every getMembership call.
 */
export const isCurrentUserAdmin = cache(async (): Promise<boolean> => {
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const u = await db.query.users.findFirst({
    where: eq(users.id, uid),
    columns: { isAdmin: true },
  });
  return u?.isAdmin ?? false;
});

export async function getMembership(
  projectId: string,
  userId?: string,
): Promise<MembershipRow | null> {
  const currentUid = await getCurrentUserId();
  const uid = userId ?? currentUid;
  if (!uid) return null;
  const row = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.projectId, projectId),
      eq(memberships.userId, uid),
    ),
  });
  if (row) return row;

  // Super-user: synthesize a Lead membership on any project they aren't an
  // explicit member of. Only for the *current* signed-in user — never for
  // an arbitrary userId lookup (e.g. when inspecting another member's role).
  if (uid === currentUid && (await isCurrentUserAdmin())) {
    return {
      projectId,
      userId: uid,
      role: "Lead",
      joinedAt: new Date(0),
    } satisfies MembershipRow;
  }
  return null;
}

export async function requireRole(
  projectId: string,
  min: Role,
): Promise<MembershipRow> {
  const m = await getMembership(projectId);
  if (!m) throw new AuthorizationError(`not a member of project ${projectId}`);
  if (ROLE_RANK[m.role as Role] < ROLE_RANK[min]) {
    throw new AuthorizationError(
      `role ${m.role} below required ${min} on project ${projectId}`,
    );
  }
  return m;
}

/**
 * Read-only access resolver. Returns either the caller's membership OR a
 * `public` marker when the project's `isPublic` toggle is on. Returns null
 * for projects that are neither public nor visible to the current user.
 */
export type ProjectAccess =
  | {
      kind: "member";
      membership: MembershipRow;
      project: ProjectRow;
      /** True when access is granted by super-user status rather than a real
       *  membership row — lets the UI show an "Admin" indicator. */
      viaAdmin: boolean;
    }
  | { kind: "public"; project: ProjectRow };

export async function getProjectAccess(
  projectId: string,
): Promise<ProjectAccess | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) return null;

  const currentUid = await getCurrentUserId();
  if (currentUid) {
    // Real membership wins and is never flagged as admin access.
    const real = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.projectId, projectId),
        eq(memberships.userId, currentUid),
      ),
    });
    if (real) {
      return { kind: "member", membership: real, project, viaAdmin: false };
    }
    // Super-user: synthetic Lead, flagged as admin access.
    if (await isCurrentUserAdmin()) {
      return {
        kind: "member",
        membership: {
          projectId,
          userId: currentUid,
          role: "Lead",
          joinedAt: new Date(0),
        },
        project,
        viaAdmin: true,
      };
    }
  }
  if (project.isPublic) return { kind: "public", project };
  return null;
}
