/**
 * Best-effort taxon-ID resolver. Given a scientific name (and optional
 * authority + already-known source keys), queries GBIF backbone and iNat
 * taxa for the missing IDs and returns whatever it could resolve.
 *
 * Never throws — used by addManualTaxon, editTaxon, and the ingest's
 * ensureTaxon to fill in cross-source IDs automatically. If GBIF or iNat
 * is unreachable we still save the taxon with whatever the user provided.
 *
 * Matching rule: prefer an *exact* canonical-name match (the same string
 * we canonicalized the input to). Falls back to canonicalizing each
 * candidate and comparing — this catches GBIF rows that put authorship
 * in `scientificName` but no `canonicalName`.
 */

import { canonicalize } from "@/lib/insectid/canonicalize";
import { gbifTaxonAutocomplete, type GbifTaxonSuggest } from "./gbif";
import { inatTaxonAutocomplete, type InatTaxonSuggest } from "./inat";

export interface ResolveInput {
  scientificName: string;
  /** Pre-existing keys are preserved verbatim — only missing ones get filled. */
  gbifKey?: number;
  inatId?: number;
}

export interface ResolveResult {
  gbifKey?: number;
  inatId?: number;
}

export async function resolveTaxonIds(
  input: ResolveInput,
): Promise<ResolveResult> {
  const { canonical } = canonicalize(input.scientificName);
  const wantGbif = !input.gbifKey;
  const wantInat = !input.inatId;

  if (!canonical || (!wantGbif && !wantInat)) {
    return { gbifKey: input.gbifKey, inatId: input.inatId };
  }

  // Parallel lookups; allSettled so one provider's failure doesn't blow
  // away the other's result.
  const [gbifRes, inatRes] = await Promise.allSettled([
    wantGbif ? gbifTaxonAutocomplete(canonical) : Promise.resolve(EMPTY_GBIF),
    wantInat ? inatTaxonAutocomplete(canonical) : Promise.resolve(EMPTY_INAT),
  ]);

  let gbifKey = input.gbifKey;
  if (wantGbif && gbifRes.status === "fulfilled") {
    const match = pickGbifMatch(gbifRes.value, canonical);
    if (match) gbifKey = match.key;
  }

  let inatId = input.inatId;
  if (wantInat && inatRes.status === "fulfilled") {
    const match = pickInatMatch(inatRes.value, canonical);
    if (match) inatId = match.id;
  }

  return { gbifKey, inatId };
}

const EMPTY_GBIF: ReadonlyArray<GbifTaxonSuggest> = [];
const EMPTY_INAT: ReadonlyArray<InatTaxonSuggest> = [];

function pickGbifMatch(
  results: ReadonlyArray<GbifTaxonSuggest>,
  canonical: string,
): GbifTaxonSuggest | null {
  // Exact canonicalName match wins.
  for (const r of results) {
    if (r.canonicalName === canonical) return r;
  }
  // Otherwise canonicalize the returned scientificName and compare.
  for (const r of results) {
    if (!r.scientificName) continue;
    if (canonicalize(r.scientificName).canonical === canonical) return r;
  }
  // Tolerate orthographic variants (e.g. "pennsylvanicus" vs "pensylvanicus")
  // — accept the top ACCEPTED species result where genus matches exactly and
  // the species epithet is within edit distance 2.
  for (const r of results) {
    if (r.taxonomicStatus && r.taxonomicStatus !== "ACCEPTED") continue;
    if (r.rank && r.rank.toUpperCase() !== "SPECIES") continue;
    const cand = (r.canonicalName ?? canonicalize(r.scientificName ?? "").canonical) ?? "";
    if (nearSpeciesMatch(canonical, cand)) return r;
  }
  return null;
}

function pickInatMatch(
  results: ReadonlyArray<InatTaxonSuggest>,
  canonical: string,
): InatTaxonSuggest | null {
  for (const r of results) {
    if (r.is_active === false) continue;
    if (r.name === canonical) return r;
  }
  // iNat sometimes returns `name` with subgenus or trinomial detail.
  for (const r of results) {
    if (r.is_active === false) continue;
    if (!r.name) continue;
    if (canonicalize(r.name).canonical === canonical) return r;
  }
  // Orthographic variant tolerance.
  for (const r of results) {
    if (r.is_active === false) continue;
    if (r.rank && r.rank.toLowerCase() !== "species") continue;
    if (!r.name) continue;
    if (nearSpeciesMatch(canonical, r.name)) return r;
  }
  return null;
}

/** True when two binomial names share a genus exactly and the species
 *  epithets are within Damerau-Levenshtein distance 2. Conservative enough
 *  to reject "Tenebrio molitor" ↔ "Alobates pensylvanicus" while accepting
 *  "Alobates pennsylvanicus" ↔ "Alobates pensylvanicus". */
function nearSpeciesMatch(a: string, b: string): boolean {
  const [ga, sa] = a.split(/\s+/, 2);
  const [gb, sb] = b.split(/\s+/, 2);
  if (!ga || !sa || !gb || !sb) return false;
  if (ga !== gb) return false;
  if (sa === sb) return true;
  return editDistance(sa, sb) <= 2;
}

/** Plain Levenshtein. Two short strings; the O(n·m) cost is trivial. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
