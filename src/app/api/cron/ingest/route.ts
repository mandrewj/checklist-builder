import { NextResponse } from "next/server";
import { advanceAllRunningJobs } from "@/lib/jobs/ingest";

/**
 * Vercel Cron entry-point. Configure in vercel.json:
 *
 *   {
 *     "crons": [
 *       { "path": "/api/cron/ingest", "schedule": "* * * * *" }
 *     ]
 *   }
 *
 * In dev, this route is also callable directly (no CRON_SECRET locally).
 * In prod we gate via Bearer ${CRON_SECRET}.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const results = await advanceAllRunningJobs();
  return NextResponse.json({ ok: true, results });
}

export async function GET(req: Request) {
  // Vercel Cron sometimes uses GET; accept both.
  return POST(req);
}
