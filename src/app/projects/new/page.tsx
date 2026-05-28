import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewProjectForm } from "./form";
import {
  US_STATES_BY_CODE,
  CA_PROVINCES,
} from "@/lib/insectid/regions.generated";

export default function NewProjectPage() {
  const regionOptions: Array<{ code: string; name: string; country: "US" | "CA" }> =
    [
      ...Object.entries(US_STATES_BY_CODE).map(([code, s]) => ({
        code,
        name: s.name,
        country: "US" as const,
      })),
      ...Object.entries(CA_PROVINCES).map(([code, p]) => ({
        code,
        name: p.name,
        country: "CA" as const,
      })),
    ].sort((a, b) =>
      a.country === b.country
        ? a.name.localeCompare(b.name)
        : a.country.localeCompare(b.country),
    );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-text-400 hover:text-blue-600"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Dashboard
        </Link>
        <span className="eyebrow">New project</span>
        <h1 className="rule text-3xl font-black">Set up checklist project</h1>
        <p className="text-sm text-text-500">
          Pick a taxon and a region. We&rsquo;ll queue GBIF + iNaturalist
          ingest jobs and you&rsquo;ll land on the project overview. Ingest
          runs in the background; the page polls.
        </p>
      </header>

      <NewProjectForm regionOptions={regionOptions} />
    </main>
  );
}
