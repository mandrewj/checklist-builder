/**
 * iNaturalist API v1 adapter — taxon autocomplete + paginated occurrence
 * search via id_above cursor (since iNat caps `page` at 30).
 *
 * Polite-use rate-limited (≤ 2 req/s); honors Retry-After.
 */

import { throttle } from "./rate-limit";

const BASE = "https://api.inaturalist.org/v1";
const UA = process.env.INAT_USER_AGENT ?? "checklist-builder (mailto:dev@example.org)";

const PER_PAGE = 200;
const MAX_BACKOFF_MS = 60_000;

export interface InatTaxonSuggest {
  id: number;
  name: string;
  rank: string;
  preferred_common_name?: string;
  matched_term?: string;
  ancestry?: string;
  parent_id?: number;
  is_active?: boolean;
  /** Comma-separated higher-classification (kingdom > phylum > ...) when /taxa returns it. */
  ancestor_names?: ReadonlyArray<string>;
  iconic_taxon_name?: string;
}

export interface InatPhoto {
  id: number;
  url: string;
  attribution?: string;
}

export interface InatObservation {
  id: number;
  taxon: { id: number; name: string; rank: string; preferred_common_name?: string };
  observed_on?: string;
  observed_on_details?: { date?: string };
  user: { login: string; name?: string };
  quality_grade: "research" | "needs_id" | "casual";
  geojson?: { type: "Point"; coordinates: [number, number] };
  place_guess?: string;
  uri: string;
  obscured?: boolean;
  photos?: ReadonlyArray<InatPhoto>;
}

export interface InatObservationQuery {
  taxon_id: number;
  /** iNat numeric place ids (resolved from US states / CA provinces). Joined
   *  with commas in the URL — iNat treats this as a logical OR. */
  place_ids?: ReadonlyArray<number>;
  /** "research" = research-grade only; "verifiable" = research + needs_id
   *  (casual is always excluded). Defaults to "verifiable". */
  quality?: "research" | "verifiable";
  /** Date range (inclusive, YYYY-MM-DD). */
  d1?: string;
  d2?: string;
  captive?: boolean;
  /** When true, return only observations with coordinates. */
  requireCoordinates?: boolean;
  per_page?: number;
  /** Pagination cursor; pass `0` for the first page. */
  idAbove?: number;
}

export interface InatObservationResponse {
  total_results: number;
  page: number;
  per_page: number;
  results: ReadonlyArray<InatObservation>;
}

async function inatFetch(pathAndQuery: string): Promise<unknown> {
  const url = `${BASE}${pathAndQuery}`;
  let attempt = 0;
  while (true) {
    await throttle("inat");
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
          : 750 * 2 ** attempt + Math.floor(Math.random() * 500),
      );
      attempt += 1;
      if (attempt > 6) {
        throw new Error(`iNat ${url} failed after ${attempt} attempts (${res.status})`);
      }
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`iNat ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
}

export async function inatTaxonAutocomplete(
  q: string,
): Promise<ReadonlyArray<InatTaxonSuggest>> {
  if (!q.trim()) return [];
  // Use /taxa (not /taxa/autocomplete) so we can explicitly require
  // `is_active=true` — this drops merged/deprecated synonyms which the
  // autocomplete endpoint sometimes returns.
  const params = new URLSearchParams({
    q,
    per_page: "10",
    is_active: "true",
    rank: "family,subfamily,genus,species",
    order_by: "observations_count",
    order: "desc",
  });
  const json = (await inatFetch(`/taxa?${params}`)) as {
    results: ReadonlyArray<InatTaxonSuggest>;
  };
  return json.results ?? [];
}

export async function inatObservationPage(
  q: InatObservationQuery,
): Promise<InatObservationResponse> {
  const params = new URLSearchParams();
  params.set("taxon_id", String(q.taxon_id));
  if (q.place_ids && q.place_ids.length > 0) {
    params.set("place_id", q.place_ids.join(","));
  }
  // Always exclude casual observations. iNat's `verifiable=true` is the
  // canonical "research + needs_id" filter.
  if (q.quality === "research") {
    params.set("quality_grade", "research");
  } else {
    params.set("verifiable", "true");
  }
  if (q.d1) params.set("d1", q.d1);
  if (q.d2) params.set("d2", q.d2);
  params.set("captive", q.captive ? "true" : "false");
  if (q.requireCoordinates) params.set("geo", "true");
  params.set("per_page", String(q.per_page ?? PER_PAGE));
  params.set("order_by", "id");
  params.set("order", "asc");
  params.set("id_above", String(q.idAbove ?? 0));

  return (await inatFetch(`/observations?${params}`)) as InatObservationResponse;
}
