"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createProject } from "@/lib/actions/create-project";
import { cn } from "@/lib/utils";
import { SourceChip } from "@/components/insectid/source-chip";

export interface RegionOption {
  code: string;
  name: string;
  country: "US" | "CA";
}

interface GbifSuggest {
  key: number;
  scientificName: string;
  rank: string;
  family?: string;
  canonicalName?: string;
  authorship?: string;
}
interface InatSuggest {
  id: number;
  name: string;
  rank: string;
  preferred_common_name?: string;
  ancestry?: string;
}

interface ChosenTaxon {
  gbifKey?: number;
  inatId?: number;
  name: string;
  rank: string;
  family?: string;
}

const DEFAULT_FILTERS = {
  yearStart: 1800,
  yearEnd: new Date().getFullYear(),
  // GBIF basis-of-record set; HUMAN_OBSERVATION intentionally excluded so we
  // don't double-count records that already arrive via iNat (much of GBIF's
  // human-observation pool is iNat data re-published under various keys).
  basisOfRecord: [
    "PRESERVED_SPECIMEN",
    "MATERIAL_SAMPLE",
    "OBSERVATION",
    "LIVING_SPECIMEN",
    "FOSSIL_SPECIMEN",
  ] as string[],
  qualityGrade: "research_or_needs_id" as const,
  requireCoordinates: true,
  excludeCaptive: true,
  // 2 decimal places ≈ 1.1 km — gazetteer-friendly default. Entomologists
  // working from county-level localities still get records assigned.
  coordinatePrecisionDp: 2,
};

export function NewProjectForm({
  regionOptions,
}: {
  regionOptions: ReadonlyArray<RegionOption>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [taxonQuery, setTaxonQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{
    gbif: GbifSuggest[];
    inat: InatSuggest[];
  } | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [chosenTaxon, setChosenTaxon] = useState<ChosenTaxon | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [yearRange, setYearRange] = useState<[number, number]>([
    DEFAULT_FILTERS.yearStart,
    DEFAULT_FILTERS.yearEnd,
  ]);
  const [excludeCaptive, setExcludeCaptive] = useState(true);
  const [requireCoords, setRequireCoords] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!taxonQuery.trim()) {
      setSuggestions(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch(
          `/api/taxon-suggest?q=${encodeURIComponent(taxonQuery)}`,
        );
        const json = (await res.json()) as {
          gbif: GbifSuggest[];
          inat: InatSuggest[];
        };
        setSuggestions(json);
      } catch (err) {
        setFeedback(err instanceof Error ? err.message : "lookup failed");
      } finally {
        setSuggestLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [taxonQuery]);

  const groupedRegions = useMemo(() => {
    const us = regionOptions.filter((r) => r.country === "US");
    const ca = regionOptions.filter((r) => r.country === "CA");
    return { us, ca };
  }, [regionOptions]);

  function toggleRegion(code: string) {
    setSelectedRegions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function pickGbif(s: GbifSuggest) {
    setChosenTaxon((prev) => ({
      gbifKey: s.key,
      inatId: prev?.inatId,
      name: s.canonicalName ?? s.scientificName,
      rank: s.rank.toLowerCase(),
      family: s.family,
    }));
  }
  function pickInat(s: InatSuggest) {
    setChosenTaxon((prev) => ({
      gbifKey: prev?.gbifKey,
      inatId: s.id,
      name: prev?.name ?? s.name,
      rank: (prev?.rank ?? s.rank).toLowerCase(),
      family: prev?.family,
    }));
  }

  function submit() {
    setFeedback(null);
    if (!name.trim()) return setFeedback("Project name is required.");
    if (!chosenTaxon) return setFeedback("Pick a taxon from GBIF or iNat.");
    if (selectedRegions.length === 0) return setFeedback("Pick at least one region.");

    startTransition(async () => {
      const res = await createProject({
        name,
        description,
        taxonQuery: {
          name: chosenTaxon.name,
          rank: chosenTaxon.rank,
          gbifKey: chosenTaxon.gbifKey,
          inatId: chosenTaxon.inatId,
        },
        regionCodes: selectedRegions,
        ingestFilters: {
          yearStart: yearRange[0],
          yearEnd: yearRange[1],
          basisOfRecord: DEFAULT_FILTERS.basisOfRecord,
          qualityGrade: DEFAULT_FILTERS.qualityGrade,
          requireCoordinates: requireCoords,
          excludeCaptive,
          coordinatePrecisionDp: DEFAULT_FILTERS.coordinatePrecisionDp,
        },
      });
      // createProject redirects on success. If we land here, it failed.
      if (!res.ok) setFeedback(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
        <h2 className="rule-sm text-base font-bold">1. Identify the project</h2>
        <Field label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tenebrionidae of Indiana (2018–2024)"
            className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Short description of what this checklist is for."
            className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
        <h2 className="rule-sm text-base font-bold">
          2. Pick the taxon
        </h2>
        <p className="text-xs text-text-500">
          Search GBIF + iNat. Pick from each side — the wizard pairs them so
          ingest covers both backbones.
        </p>
        <input
          type="search"
          value={taxonQuery}
          onChange={(e) => setTaxonQuery(e.target.value)}
          placeholder="Search for a taxon (e.g. Tenebrionidae)"
          className="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        />
        {suggestLoading && (
          <p className="text-xs text-text-400">Searching backbones…</p>
        )}
        {suggestions && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SuggestColumn
              source="gbif"
              suggestions={suggestions.gbif.map((s) => ({
                id: s.key,
                name: s.canonicalName ?? s.scientificName,
                rank: s.rank,
                authority: s.authorship,
                family: s.family,
                status: "ACCEPTED" as const,
              }))}
              chosenId={chosenTaxon?.gbifKey}
              onPick={(id) => {
                const s = suggestions.gbif.find((x) => x.key === id);
                if (s) pickGbif(s);
              }}
            />
            <SuggestColumn
              source="inat"
              suggestions={suggestions.inat.map((s) => ({
                id: s.id,
                name: s.name,
                rank: s.rank,
                authority: s.preferred_common_name,
                family: undefined,
                status: "ACCEPTED" as const,
              }))}
              chosenId={chosenTaxon?.inatId}
              onPick={(id) => {
                const s = suggestions.inat.find((x) => x.id === id);
                if (s) pickInat(s);
              }}
            />
          </div>
        )}
        {chosenTaxon && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Will ingest{" "}
            <strong className="italic">{chosenTaxon.name}</strong>{" "}
            (rank {chosenTaxon.rank})
            {chosenTaxon.gbifKey ? `, GBIF #${chosenTaxon.gbifKey}` : ""}
            {chosenTaxon.inatId ? `, iNat #${chosenTaxon.inatId}` : ""}.
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
        <h2 className="rule-sm text-base font-bold">3. Pick regions</h2>
        <p className="text-xs text-text-500">
          {selectedRegions.length} selected · multi-state projects render as a
          composite map at export time.
        </p>
        <RegionPicker
          label="US states"
          options={groupedRegions.us}
          selected={selectedRegions}
          onToggle={toggleRegion}
        />
        <RegionPicker
          label="Canadian provinces / territories"
          options={groupedRegions.ca}
          selected={selectedRegions}
          onToggle={toggleRegion}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-surface-3 bg-surface-0 p-5 shadow-card">
        <h2 className="rule-sm text-base font-bold">4. Filters</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Field label="From year">
            <input
              type="number"
              value={yearRange[0]}
              min={1700}
              max={yearRange[1]}
              onChange={(e) =>
                setYearRange([Number(e.target.value) || 1800, yearRange[1]])
              }
              className="w-24 rounded-md border border-surface-3 bg-surface-0 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </Field>
          <Field label="To year">
            <input
              type="number"
              value={yearRange[1]}
              min={yearRange[0]}
              max={new Date().getFullYear()}
              onChange={(e) =>
                setYearRange([
                  yearRange[0],
                  Number(e.target.value) || new Date().getFullYear(),
                ])
              }
              className="w-24 rounded-md border border-surface-3 bg-surface-0 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-text-600">
          <input
            type="checkbox"
            checked={requireCoords}
            onChange={(e) => setRequireCoords(e.target.checked)}
            className="size-4 accent-blue-600"
          />
          Require coordinates (precision ≥ 2 decimal places, ~1.1 km)
        </label>
        <label className="flex items-center gap-2 text-xs text-text-600">
          <input
            type="checkbox"
            checked={excludeCaptive}
            onChange={(e) => setExcludeCaptive(e.target.checked)}
            className="size-4 accent-blue-600"
          />
          Exclude captive / cultivated observations
        </label>
      </section>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p
          className={cn(
            "text-xs",
            feedback ? "text-danger-600" : "text-text-400",
          )}
          role="status"
          aria-live="polite"
        >
          {feedback ??
            "Submitting queues the ingest jobs. Page redirects to the new project."}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create project & start ingest"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
        {label}
        {required && <span className="ml-1 text-danger-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function SuggestColumn({
  source,
  suggestions,
  chosenId,
  onPick,
}: {
  source: "gbif" | "inat";
  suggestions: ReadonlyArray<{
    id: number;
    name: string;
    rank: string;
    authority?: string;
    family?: string;
    status?: "ACCEPTED" | "SYNONYM";
  }>;
  chosenId?: number;
  onPick: (id: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-surface-3 bg-surface-1 p-3">
      <div className="flex items-center justify-between gap-2">
        <SourceChip source={source} />
        <span className="text-[10px] uppercase tracking-[0.08em] text-text-400">
          {source === "gbif"
            ? "Accepted backbone names only"
            : "Active iNat taxa only"}
        </span>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-xs text-text-400">No matches.</p>
      ) : (
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto nice-scroll">
          {suggestions.map((s) => {
            const chosen = s.id === chosenId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                    chosen
                      ? "border-blue-600 bg-blue-50"
                      : "border-surface-3 bg-surface-0 hover:border-blue-200",
                  )}
                  aria-pressed={chosen}
                >
                  <div className="flex w-full items-baseline justify-between gap-2">
                    <span className="truncate font-bold italic text-text-700">
                      {s.name}
                    </span>
                    {s.status && (
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.06em]",
                          s.status === "ACCEPTED"
                            ? "bg-success-50 text-success-700"
                            : "bg-warning-50 text-warning-700",
                        )}
                      >
                        {s.status === "ACCEPTED" ? "Accepted" : "Synonym"}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-text-400">
                    {s.rank}
                    {s.family ? ` · ${s.family}` : ""}
                  </span>
                  {s.authority && (
                    <span className="text-[10px] text-text-400">
                      {s.authority}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RegionPicker({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: ReadonlyArray<RegionOption>;
  selected: ReadonlyArray<string>;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = selected.includes(o.code);
          return (
            <button
              key={o.code}
              type="button"
              onClick={() => onToggle(o.code)}
              aria-pressed={active}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-bold transition-colors",
                active
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-surface-3 bg-surface-0 text-text-500 hover:border-blue-200 hover:text-text-700",
              )}
              title={o.code}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
