import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

export interface RouteStubProps {
  eyebrow: string;
  title: ReactNode;
  step: string;
  description: ReactNode;
  children?: ReactNode;
}

/**
 * Placeholder used for routes whose UI hasn't been wired yet. Keeps sidebar
 * nav functional and surfaces the step number from CLAUDE.md so reviewers
 * know where in the build order this lands.
 */
export function RouteStub({
  eyebrow,
  title,
  step,
  description,
  children,
}: RouteStubProps) {
  return (
    <div className="flex flex-col">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="px-8 py-10">
        <div className="rounded-xl border border-dashed border-surface-3 bg-surface-1 px-6 py-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-700">
            {step}
          </span>
          <p className="mt-4 text-sm text-text-400">
            UI is wired in the upcoming build step. Layout shell + data
            plumbing are already in place.
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
