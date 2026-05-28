"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ingestJobs } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dev-auth";
import { advanceOneJob, type AdvanceResult } from "@/lib/jobs/ingest";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Soft deadline for the dev-trigger drain. Production cron stays one-page-
 *  per-tick (configured in /api/cron/ingest). */
const DRAIN_DEADLINE_MS = 45_000;
/** Cap to keep a single click from running forever if jobs never finish. */
const MAX_TICKS = 200;

/**
 * Manual dev-trigger for the ingest worker. **Drains**: keeps advancing
 * every pending/running/failed job by one page until they all reach `done`
 * or the soft deadline elapses (whichever comes first). Returns the final
 * AdvanceResult for each job plus how many ticks we ran.
 *
 * Contributor+ required; project must be unlocked.
 *
 * Production cron at /api/cron/ingest stays one-page-per-tick.
 */
export async function runIngestForProject(
  projectId: string,
): Promise<
  ActionResult<{
    results: AdvanceResult[];
    ticks: number;
    drainedMs: number;
    timedOut: boolean;
  }>
> {
  try {
    await requireRole(projectId, "Contributor");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unauthorized",
    };
  }

  const start = Date.now();
  const deadline = start + DRAIN_DEADLINE_MS;
  const latestResultByJob = new Map<string, AdvanceResult>();
  let ticks = 0;
  let timedOut = false;

  while (ticks < MAX_TICKS) {
    if (Date.now() > deadline) {
      timedOut = true;
      break;
    }

    // Pull the currently-runnable jobs each tick — they may have moved
    // pending → running → done since the previous tick.
    const jobs = await db
      .select({ id: ingestJobs.id, status: ingestJobs.status })
      .from(ingestJobs)
      .where(
        and(
          eq(ingestJobs.projectId, projectId),
          sql`${ingestJobs.status} IN ('pending', 'running', 'failed')`,
        ),
      );

    if (jobs.length === 0) break;

    // Reset any failed jobs once per drain so we don't infinite-loop on a
    // permanent error (e.g. bad GBIF taxonKey). After the reset, if the
    // next tick fails the same way, the status flips back to 'failed' and
    // we exit on the next iteration.
    for (const j of jobs) {
      if (j.status === "failed") {
        await db
          .update(ingestJobs)
          .set({ status: "running", error: null, finishedAt: null })
          .where(eq(ingestJobs.id, j.id));
      }
    }

    let advanced = false;
    for (const j of jobs) {
      if (Date.now() > deadline) {
        timedOut = true;
        break;
      }
      const res = await advanceOneJob(j.id);
      latestResultByJob.set(j.id, res);
      // Only keep looping if the job advanced AND isn't done/failed.
      if (res.status === "running" || res.status === "pending") advanced = true;
    }
    ticks += 1;
    if (!advanced) break;
  }

  revalidatePath(`/projects/${projectId}`, "layout");
  return {
    ok: true,
    data: {
      results: Array.from(latestResultByJob.values()),
      ticks,
      drainedMs: Date.now() - start,
      timedOut,
    },
  };
}
