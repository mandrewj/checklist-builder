import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-24">
      <header className="flex flex-col gap-4">
        <span className="eyebrow">
          Insect Diversity &amp; Diagnostics Lab · Purdue Entomology
        </span>
        <h1 className="rule text-5xl font-black tracking-tightish">
          Checklist Builder
        </h1>
      </header>

      <p className="text-lg text-text-500">
        A guided workflow for compressing weeks of manual GBIF + iNaturalist
        scraping and map-drawing into a publication-ready manuscript pack —
        DOCX draft, county-distribution maps, Darwin Core Archive, JSON
        snapshot.
      </p>

      <p className="text-sm text-text-400">
        Built for working research entomologists. Every system-inferred
        decision is badged and overridable; no canonical taxonomy is forced;
        exports run against an immutable locked snapshot.
      </p>

      <div className="flex flex-wrap gap-3 pt-4">
        <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
          <Link href="/sign-in">Sign in to continue</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/dashboard">Open dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
