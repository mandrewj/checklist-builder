/**
 * Clerk webhook handler — mirrors user.created / user.updated / user.deleted
 * events into our local `users` table so FKs from memberships, records, and
 * activity_log can use the Clerk userId verbatim.
 *
 * Configure the webhook in Clerk's dashboard (or via the Vercel marketplace
 * setup) and point it at `https://<your-vercel-domain>/api/clerk/webhook`.
 * Set `CLERK_WEBHOOK_SIGNING_SECRET` in the env (Clerk gives you the value
 * when you create the endpoint).
 */

import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { resolveIdentity } from "@/lib/auth/user-identity";

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return new Response("CLERK_WEBHOOK_SIGNING_SECRET is not configured", {
      status: 500,
    });
  }

  const hdrs = await headers();
  const svixId = hdrs.get("svix-id");
  const svixTimestamp = hdrs.get("svix-timestamp");
  const svixSignature = hdrs.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("missing svix headers", { status: 400 });
  }

  const body = await req.text();
  let evt: WebhookEvent;
  try {
    evt = new Webhook(secret).verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("[clerk-webhook] verification failed:", err);
    return new Response("invalid signature", { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
    case "user.updated": {
      const u = evt.data;
      const id = resolveIdentity(u);
      // Always keep email fresh. Only (re)write displayName/initials when we
      // actually resolved a real name — otherwise a name-less Clerk profile
      // would clobber a good name (e.g. one set via seed:adopt) with an
      // email-derived fallback on every sign-in.
      const set: Partial<typeof users.$inferInsert> = { email: id.email };
      if (id.hasRealName) {
        set.displayName = id.displayName;
        set.initials = id.initials;
      }
      await db
        .insert(users)
        .values({
          id: u.id,
          email: id.email,
          displayName: id.displayName,
          initials: id.initials,
        })
        .onConflictDoUpdate({ target: users.id, set });
      break;
    }
    case "user.deleted": {
      const id = evt.data.id;
      if (id) {
        // Hard-delete. Memberships cascade; records keep added_by pointing at
        // the deleted id (FK is set null on delete elsewhere or we leave it).
        await db.delete(users).where(eq(users.id, id));
      }
      break;
    }
    default:
      // No-op for other event types.
      break;
  }

  return new Response("ok", { status: 200 });
}
