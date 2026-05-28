/**
 * GBIF Occurrence API adapter — taxon autocomplete + paginated occurrence
 * search. Polite-use rate-limited (≤ 4 req/s) and Retry-After-aware.
 *
 * No API key required; UA header from GBIF_USER_AGENT (set in env).
 */

import { throttle } from "./rate-limit";

const BASE = "https://api.gbif.org/v1";
const UA = process.env.GBIF_USER_AGENT ?? "checklist-builder (mailto:dev@example.org)";

const MAX_LIMIT = 300;
const MAX_BACKOFF_MS = 60_000;

export interface GbifTaxonSuggest {
  key: number;
  scientificName: string;
  rank: string;
  taxonomicStatus?: string;
  family?: string;
  canonicalName?: string;
  authorship?: string;
}

export interface GbifOccurrence {
  key: number;
  scientificName: string;
  acceptedScientificName?: string;
  taxonKey: number;
  acceptedTaxonKey?: number;
  decimalLatitude?: number;
  decimalLongitude?: number;
  countryCode?: string;
  stateProvince?: string;
  county?: string;
  eventDate?: string;
  recordedBy?: string;
  basisOfRecord: string;
  occurrenceID?: string;
  media?: Array<{ identifier: string; type: string }>;
}

export interface GbifOccurrenceQuery {
  taxonKey: number;
  /** ISO 3166-1 alpha-2 (e.g. "US", "CA"). */
  country?: string;
  /** State/province names. Repeated as OR'd params on the URL. */
  stateProvince?: ReadonlyArray<string>;
  yearRange?: [number, number];
  basisOfRecord?: ReadonlyArray<string>;
  hasCoordinate?: boolean;
  establishmentMeans?: "NATIVE" | "INTRODUCED" | "MANAGED" | "UNCERTAIN";
  /** Offset (page size = 300). */
  offset?: number;
}

export interface GbifOccurrenceResponse {
  offset: number;
  limit: number;
  endOfRecords: boolean;
  count: number;
  results: ReadonlyArray<GbifOccurrence>;
}

async function gbifFetch(pathAndQuery: string): Promise<unknown> {
  const url = `${BASE}${pathAndQuery}`;
  let attempt = 0;
  while (true) {
    await throttle("gbif");
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (res.ok) return await res.json();
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "0");
      const backoff = Math.min(
        MAX_BACKOFF_MS,
        retryAfter > 0
          ? retryAfter * 1000
          : 500 * 2 ** attempt + Math.floor(Math.random() * 250),
      );
      attempt += 1;
      if (attempt > 6) {
        throw new Error(`GBIF ${url} failed after ${attempt} attempts (${res.status})`);
      }
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`GBIF ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
}

/** UUID of the GBIF Backbone Taxonomy dataset. Only keys in this dataset
 * can be looked up via /occurrence/search?taxonKey=…, so we filter the
 * autocomplete to backbone-only.
 *
 * https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c
 */
const GBIF_BACKBONE_DATASET = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c";

export async function gbifTaxonAutocomplete(
  q: string,
  ranks: ReadonlyArray<string> = ["GENUS", "SPECIES", "FAMILY", "SUBFAMILY"],
): Promise<ReadonlyArray<GbifTaxonSuggest>> {
  if (!q.trim()) return [];
  // GBIF wants repeated `rank=` params, not a comma-joined string. We also
  // restrict to the backbone — non-backbone keys (CoL, regional checklists)
  // don't resolve in /occurrence/search.
  const params = new URLSearchParams({
    q,
    limit: "10",
    datasetKey: GBIF_BACKBONE_DATASET,
    status: "ACCEPTED",
  });
  for (const r of ranks) params.append("rank", r);
  const json = (await gbifFetch(`/species/search?${params}`)) as {
    results: ReadonlyArray<GbifTaxonSuggest>;
  };
  return json.results ?? [];
}

/** iNaturalist research-grade observations are republished as a GBIF dataset.
 *  We already ingest them directly from iNat, so excluding this dataset on
 *  the GBIF side avoids double-counting.
 *  https://www.gbif.org/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7
 */
const INAT_REPUBLISHED_DATASET = "50c9509d-22c7-4a22-a47d-8c48425ef4a7";

export async function gbifOccurrencePage(
  q: GbifOccurrenceQuery,
): Promise<GbifOccurrenceResponse> {
  const params = new URLSearchParams();
  params.set("taxonKey", String(q.taxonKey));
  if (q.country) params.set("country", q.country);
  if (q.stateProvince && q.stateProvince.length > 0) {
    for (const s of q.stateProvince) params.append("stateProvince", s);
  }
  if (q.yearRange) params.set("year", `${q.yearRange[0]},${q.yearRange[1]}`);
  // GBIF expects repeated `&basisOfRecord=…` params, not comma-joined.
  if (q.basisOfRecord && q.basisOfRecord.length > 0) {
    for (const b of q.basisOfRecord) params.append("basisOfRecord", b);
  }
  if (q.hasCoordinate) params.set("hasCoordinate", "true");
  if (q.establishmentMeans) params.set("establishmentMeans", q.establishmentMeans);
  // Avoid double-counting iNaturalist research-grade observations.
  params.append("notDatasetKey", INAT_REPUBLISHED_DATASET);
  params.set("limit", String(MAX_LIMIT));
  params.set("offset", String(q.offset ?? 0));

  return (await gbifFetch(`/occurrence/search?${params}`)) as GbifOccurrenceResponse;
}
