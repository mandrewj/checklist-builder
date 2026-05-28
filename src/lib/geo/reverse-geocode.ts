/**
 * Reverse geocoding lat/lng → region atom (US county FIPS *or* CA province
 * code), via point-in-polygon against the bundled GeoJSONs. Loads the
 * geometry once per process and keeps it in memory.
 *
 * STRICT mode: callers pass the project's regionCodes (e.g. ["US-IN","CA-ON"])
 * and the search is confined to polygons in those regions. No global
 * fallback — points outside the project's region return null and the calling
 * ingest worker drops those records.
 *
 * For US regions the returned `countyFips` is a 5-digit FIPS like "18001".
 * For CA regions the returned `countyFips` is the province ISO code like
 * "CA-ON" — since CA census divisions are out of scope, provinces are the
 * region atom. The naming is preserved across both for schema simplicity:
 * `records.countyFips` + `county_presence.countyFips` aggregate over either.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { geoContains } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";

// ---------- US counties ----------

type UsCountyProps = {
  name?: string;
  stateCode?: string;
  stateName?: string;
};
type UsCountyFeature = Feature<Geometry, UsCountyProps>;

let usCountiesCache: ReadonlyArray<UsCountyFeature> | null = null;
let usStateBuckets: Map<string, UsCountyFeature[]> | null = null;

function loadUsCounties(): {
  features: ReadonlyArray<UsCountyFeature>;
  byState: Map<string, UsCountyFeature[]>;
} {
  if (usCountiesCache && usStateBuckets) {
    return { features: usCountiesCache, byState: usStateBuckets };
  }
  const p = path.resolve(process.cwd(), "public", "topojson", "us-counties.geojson");
  const fc = JSON.parse(readFileSync(p, "utf8")) as FeatureCollection<
    Geometry,
    UsCountyProps
  >;
  const features = fc.features;
  const byState = new Map<string, UsCountyFeature[]>();
  for (const f of features) {
    const sc = f.properties?.stateCode;
    if (!sc) continue;
    const arr = byState.get(sc) ?? [];
    arr.push(f);
    byState.set(sc, arr);
  }
  usCountiesCache = features;
  usStateBuckets = byState;
  return { features, byState };
}

// ---------- CA provinces ----------

type CaProvinceProps = { name?: string; provinceCode?: string };
type CaProvinceFeature = Feature<Geometry, CaProvinceProps>;

let caProvincesCache: ReadonlyArray<CaProvinceFeature> | null = null;
let caProvinceByCode: Map<string, CaProvinceFeature> | null = null;

function loadCaProvinces(): {
  features: ReadonlyArray<CaProvinceFeature>;
  byCode: Map<string, CaProvinceFeature>;
} {
  if (caProvincesCache && caProvinceByCode) {
    return { features: caProvincesCache, byCode: caProvinceByCode };
  }
  const p = path.resolve(
    process.cwd(),
    "public",
    "topojson",
    "canada-provinces.geojson",
  );
  const fc = JSON.parse(readFileSync(p, "utf8")) as FeatureCollection<
    Geometry,
    CaProvinceProps
  >;
  const features = fc.features;
  const byCode = new Map<string, CaProvinceFeature>();
  for (const f of features) {
    const code =
      f.properties?.provinceCode ?? (typeof f.id === "string" ? f.id : null);
    if (!code) continue;
    byCode.set(code, f);
  }
  caProvincesCache = features;
  caProvinceByCode = byCode;
  return { features, byCode };
}

// ---------- Reverse geocode ----------

export interface ReverseGeocodeResult {
  /** US county FIPS (e.g. "18001") OR CA province code (e.g. "CA-ON"). */
  countyFips: string;
  /** US county name OR CA province name. */
  countyName: string;
  /** US state ISO ("US-IN") OR CA province ISO ("CA-ON"). */
  stateCode: string;
}

export function reverseGeocode(
  lng: number,
  lat: number,
  regionCodes: ReadonlyArray<string>,
): ReverseGeocodeResult | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (regionCodes.length === 0) return null;

  // US counties first — fastest path for most projects.
  const usCodes = regionCodes.filter((c) => c.startsWith("US-"));
  if (usCodes.length > 0) {
    const { byState } = loadUsCounties();
    for (const code of usCodes) {
      const counties = byState.get(code);
      if (!counties) continue;
      for (const f of counties) {
        if (geoContains(f as Feature<Geometry>, [lng, lat])) {
          return {
            countyFips: String(f.id ?? ""),
            countyName: f.properties?.name ?? "Unknown",
            stateCode: f.properties?.stateCode ?? code,
          };
        }
      }
    }
  }

  // CA provinces — only one polygon per code so this loop is cheap.
  const caCodes = regionCodes.filter((c) => c.startsWith("CA-"));
  if (caCodes.length > 0) {
    const { byCode } = loadCaProvinces();
    for (const code of caCodes) {
      const f = byCode.get(code);
      if (!f) continue;
      if (geoContains(f as Feature<Geometry>, [lng, lat])) {
        return {
          countyFips: code,
          countyName: f.properties?.name ?? "Unknown",
          stateCode: code,
        };
      }
    }
  }

  return null;
}

/**
 * Coordinate precision check — refuse to geocode if precision is below the
 * project's threshold (default 2 decimal places ≈ 1.1 km, gazetteer-friendly).
 */
export function hasSufficientPrecision(
  lng: number,
  lat: number,
  decimals = 2,
): boolean {
  const re = new RegExp(`\\.\\d{${decimals},}$|^-?\\d+\\.\\d{${decimals},}$`);
  return re.test(String(lng)) && re.test(String(lat));
}
