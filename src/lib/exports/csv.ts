import type { ProjectSnapshot } from "./snapshot";
import {
  CA_PROVINCES,
  US_COUNTIES,
  US_STATES_BY_CODE,
} from "@/lib/insectid/regions";

const COLUMNS = [
  "scientific_name",
  "authority",
  "family",
  "rank",
  "sources",
  "gbif_taxon_key",
  "inat_taxon_id",
  "n_records_accepted",
  "n_records_rejected",
  "n_counties_present",
  // Human-readable counties grouped by state, e.g.
  // "Indiana: Adams, Allen; Illinois: Adams, Champaign; Ontario (province)"
  "counties_by_state",
  "inclusion",
  "inclusion_reasoning",
  "has_cite_only",
  "taxonomic_notes",
  "last_updated",
] as const;

function escapeCsv(v: string): string {
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Builds the species-checklist CSV per EXPORTS.md §"CSV".
 * Includes all non-excluded rows (include + undecided). UTF-8, RFC 4180, LF line endings.
 */
export function buildCsvExport(snapshot: ProjectSnapshot): Buffer {
  const includedTaxa = snapshot.taxa.filter((t) => t.included !== "exclude");
  const recordsByTaxon = new Map<string, typeof snapshot.records>();
  for (const r of snapshot.records) {
    const arr = (recordsByTaxon.get(r.taxonId) ?? []) as typeof snapshot.records;
    (arr as typeof snapshot.records[number][]).push(r);
    recordsByTaxon.set(r.taxonId, arr);
  }
  const presenceByTaxon = new Map<string, typeof snapshot.countyPresence>();
  for (const cp of snapshot.countyPresence) {
    const arr =
      (presenceByTaxon.get(cp.taxonId) ?? []) as typeof snapshot.countyPresence;
    (arr as typeof snapshot.countyPresence[number][]).push(cp);
    presenceByTaxon.set(cp.taxonId, arr);
  }
  const conflictNotesByTaxon = new Map<string, string>();
  for (const c of snapshot.taxonConflicts) {
    if (!c.taxonId || !c.resolution) continue;
    conflictNotesByTaxon.set(
      c.taxonId,
      `Resolved as "${c.resolution}"${c.customName ? ` (${c.customName})` : ""}`,
    );
  }

  const rows: string[] = [];
  rows.push(COLUMNS.join(","));

  for (const t of includedTaxa) {
    const recs = recordsByTaxon.get(t.id) ?? [];
    const presence = presenceByTaxon.get(t.id) ?? [];
    const sources = Array.from(new Set(recs.map((r) => r.source))).join(";");
    const accepted = recs.filter((r) => r.status === "accepted").length;
    const rejected = recs.filter((r) => r.status === "rejected").length;
    const counties = presence.length;
    const countiesByState = formatCountiesByState(
      presence.map((p) => p.countyFips),
    );
    const hasCiteOnly = presence.some((p) => p.hasCiteOnly);
    const lastUpdated = (t.inclusionUpdatedAt ?? new Date()).toISOString();

    const row = [
      t.scientificName,
      t.authority ?? "",
      t.family ?? "",
      t.rank,
      sources,
      t.externalIds.gbifKey?.toString() ?? "",
      t.externalIds.inatId?.toString() ?? "",
      accepted.toString(),
      rejected.toString(),
      counties.toString(),
      countiesByState,
      t.included,
      t.inclusionReasoning ?? "",
      hasCiteOnly ? "true" : "false",
      conflictNotesByTaxon.get(t.id) ?? "",
      lastUpdated,
    ];
    rows.push(row.map(escapeCsv).join(","));
  }

  return Buffer.from(rows.join("\n") + "\n", "utf8");
}

/**
 * Format the per-taxon region atoms (US 5-digit FIPS or CA province codes)
 * as a human-readable string grouped by state/province. Example output:
 *   "Illinois: Adams, Champaign; Indiana: Adams, Allen, Bartholomew; Ontario (province)"
 * Falls back to the raw atom if it isn't in either registry.
 */
function formatCountiesByState(atoms: ReadonlyArray<string>): string {
  if (atoms.length === 0) return "";
  const byState = new Map<string, string[]>(); // state name → county names
  const provinces: string[] = [];
  const unknown: string[] = [];

  for (const atom of atoms) {
    const us = US_COUNTIES[atom];
    if (us) {
      const stateName =
        US_STATES_BY_CODE[us.stateCode]?.name ?? us.stateCode;
      const arr = byState.get(stateName) ?? [];
      arr.push(us.name);
      byState.set(stateName, arr);
      continue;
    }
    const ca = CA_PROVINCES[atom];
    if (ca) {
      provinces.push(`${ca.name} (province)`);
      continue;
    }
    unknown.push(atom);
  }

  const segments: string[] = [];
  for (const [state, counties] of [...byState.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    segments.push(`${state}: ${counties.sort().join(", ")}`);
  }
  for (const p of provinces.sort()) segments.push(p);
  for (const u of unknown.sort()) segments.push(u);
  return segments.join("; ");
}
