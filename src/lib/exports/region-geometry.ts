/**
 * Server-side region geometry loader — used by the export pipeline.
 *
 * Reads `public/topojson/us-counties.geojson` + `canada-provinces.geojson`
 * once per Node process and filters by the project's `regionCodes`. The
 * resulting FeatureCollection feeds `buildSpeciesSvg`, so the exported
 * SVG/PNG/PDF maps show exactly the same extent as the website's
 * RegionChoropleth (which does the same filtering client-side via fetch).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";

type RegionProps = GeoJsonProperties & {
  name?: string;
  stateCode?: string;
  provinceCode?: string;
};

type RegionFeatureCollection = FeatureCollection<Geometry, RegionProps>;

let usCache: RegionFeatureCollection | null = null;
let usStatesCache: RegionFeatureCollection | null = null;
let caCache: RegionFeatureCollection | null = null;

function loadUs(): RegionFeatureCollection {
  if (usCache) return usCache;
  const p = path.resolve(
    process.cwd(),
    "public",
    "topojson",
    "us-counties.geojson",
  );
  usCache = JSON.parse(readFileSync(p, "utf8")) as RegionFeatureCollection;
  return usCache;
}

function loadUsStates(): RegionFeatureCollection {
  if (usStatesCache) return usStatesCache;
  const p = path.resolve(
    process.cwd(),
    "public",
    "topojson",
    "us-states.geojson",
  );
  usStatesCache = JSON.parse(readFileSync(p, "utf8")) as RegionFeatureCollection;
  return usStatesCache;
}

function loadCa(): RegionFeatureCollection {
  if (caCache) return caCache;
  const p = path.resolve(
    process.cwd(),
    "public",
    "topojson",
    "canada-provinces.geojson",
  );
  caCache = JSON.parse(readFileSync(p, "utf8")) as RegionFeatureCollection;
  return caCache;
}

/**
 * Returns a FeatureCollection of all geometries within `regionCodes`.
 * Empty regionCodes returns an empty collection. Unknown codes are skipped.
 */
export function regionGeometryFor(
  regionCodes: ReadonlyArray<string>,
): RegionFeatureCollection {
  const features: Feature<Geometry, RegionProps>[] = [];

  const usWanted = new Set(regionCodes.filter((c) => c.startsWith("US-")));
  if (usWanted.size > 0) {
    for (const f of loadUs().features) {
      const sc = f.properties?.stateCode;
      if (sc && usWanted.has(sc)) features.push(f);
    }
  }

  const caWanted = new Set(regionCodes.filter((c) => c.startsWith("CA-")));
  if (caWanted.size > 0) {
    for (const f of loadCa().features) {
      const code =
        f.properties?.provinceCode ??
        (typeof f.id === "string" ? f.id : null);
      if (code && caWanted.has(code)) features.push(f);
    }
  }

  return { type: "FeatureCollection", features };
}

/**
 * Returns a FeatureCollection of state/province outline polygons matching
 * `regionCodes`. Used by maps to draw a bold border between political
 * boundaries (state lines should read heavier than county lines).
 *
 * For CA the per-province geometry from `canada-provinces.geojson` IS the
 * outline, so we reuse it. For US we load the separate `us-states.geojson`.
 */
export function regionOutlinesFor(
  regionCodes: ReadonlyArray<string>,
): RegionFeatureCollection {
  const features: Feature<Geometry, RegionProps>[] = [];

  const usWanted = new Set(regionCodes.filter((c) => c.startsWith("US-")));
  if (usWanted.size > 0) {
    for (const f of loadUsStates().features) {
      const sc = f.properties?.stateCode;
      if (sc && usWanted.has(sc)) features.push(f);
    }
  }

  const caWanted = new Set(regionCodes.filter((c) => c.startsWith("CA-")));
  if (caWanted.size > 0) {
    for (const f of loadCa().features) {
      const code =
        f.properties?.provinceCode ??
        (typeof f.id === "string" ? f.id : null);
      if (code && caWanted.has(code)) features.push(f);
    }
  }

  return { type: "FeatureCollection", features };
}
