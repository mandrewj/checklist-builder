"use client";

import { useState, useTransition } from "react";
import { Play, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { runIngestForProject } from "@/lib/actions/run-ingest";
import { cn } from "@/lib/utils";

export interface IngestJobView {
  id: string;
  source: string;
  status: "pending" | "running" | "done" | "failed";
  cursor: string | null;
  fetched: number;
  error: string | null;
}

const STATUS_ICON: Record<IngestJobView["status"], typeof Play> = {
  pending: Play,
  running: Loader2,
  done: CheckCircle2,
  failed: AlertTriangle,
};
const STATUS_TONE: Record<IngestJobView["status"], string> = {
  pending: "text-text-500",
  running: "text-blue-700",
  done: "text-success-700",
  failed: "text-danger-600",
};

export function IngestStatus({
  projectId,
  jobs,
  canRun,
}: {
  projectId: string;
  jobs: ReadonlyArray<IngestJobView>;
  canRun: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeJobs = jobs.filter(
    (j) => j.status === "pending" || j.status === "running",
  );
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const runnable = activeJobs.length + failedJobs.length;
  const allDone = jobs.length > 0 && runnable === 0;

  function go() {
    setFeedback(null);
    startTransition(async () => {
      const res = await runIngestForProject(projectId);
      if (!res.ok) {
        setFeedback(res.error);
        return;
      }
      const { results, ticks, drainedMs, timedOut } = res.data;
      const totalInserted = results.reduce((a, r) => a + r.inserted, 0);
      const summary =
        results.map((r) => `${r.status} +${r.inserted}`).join(", ") ||
        "no active jobs";
      const tail = timedOut
        ? ` · timed out at 45s — click again to continue`
        : "";
      setFeedback(
        `${summary} · ${ticks} ${ticks === 1 ? "tick" : "ticks"} · ${totalInserted} inserted · ${Math.round(drainedMs / 100) / 10}s${tail}`,
      );
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-blue-800">Ingest</h3>
        {activeJobs.length > 0 && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-blue-700">
            {activeJobs.length} active
          </span>
        )}
        {failedJobs.length > 0 && activeJobs.length === 0 && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-danger-600">
            {failedJobs.length} failed — retry below
          </span>
        )}
        {allDone && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-success-700">
            Complete
          </span>
        )}
      </header>

      {jobs.length === 0 ? (
        <p className="text-xs text-text-400">
          No ingest jobs queued for this project.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {jobs.map((j) => {
            const Icon = STATUS_ICON[j.status];
            return (
              <li key={j.id} className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "size-3.5",
                        STATUS_TONE[j.status],
                        j.status === "running" && "animate-spin",
                      )}
                      aria-hidden
                    />
                    <span className="font-bold uppercase tracking-[0.06em]">
                      {j.source}
                    </span>
                    <span className={STATUS_TONE[j.status]}>{j.status}</span>
                  </span>
                  <span className="font-mono tabular-nums text-text-400">
                    {j.fetched.toLocaleString()} fetched
                  </span>
                </div>
                {j.error && (
                  <p
                    className="ml-5 break-words rounded-md border border-danger-600/30 bg-danger-50 px-2 py-1 text-[11px] text-danger-600"
                    title={j.error}
                  >
                    {j.error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-surface-3 pt-3">
        <p
          className={cn(
            "text-[11px]",
            feedback?.startsWith("unauthorized") || feedback?.startsWith("not a member")
              ? "text-danger-600"
              : "text-text-400",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback ?? "Production runs the cron worker every minute."}
        </p>
        <button
          type="button"
          onClick={go}
          disabled={!canRun || pending || runnable === 0}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="size-3" aria-hidden />
          {pending
            ? "Running…"
            : failedJobs.length > 0 && activeJobs.length === 0
              ? "Retry failed"
              : "Run ingest"}
        </button>
      </div>
    </section>
  );
}
