/**
 * Builds the topojson-derived assets bundled with the app.
 *
 * Inputs:
 *   - node_modules/us-atlas/counties-10m.json — TIGER 2024-equivalent (Mike Bostock)
 *   - scripts/data/canada-provinces-source.geojson — Code for America public dataset
 *
 * Outputs:
 *   - public/topojson/us-counties.geojson      — all US counties (FC, ~600 KB)
 *   - public/topojson/us-states.geojson        — all US states (FC)
 *   - public/topojson/canada-provinces.geojson — Canadian provinces (FC, ISO ids)
 *   - public/topojson/indiana-counties.json    — preserved for backwards compat
 *   - src/lib/insectid/regions.generated.ts    — typed FIPS → name registry
 *
 * Rerun manually when source data updates: `pnpm tsx scripts/build-topojson.ts`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type {
  GeometryCollection as TopoGeometryCollection,
  Topology,
} from "topojson-specification";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";

const ROOT = path.resolve(__dirname, "..");
const TOPO_OUT = path.join(ROOT, "public", "topojson");
const SRC_OUT = path.join(ROOT, "src", "lib", "insectid", "regions.generated.ts");
mkdirSync(TOPO_OUT, { recursive: true });

// ---------------------------------------------------------------------------
// US states: FIPS → (USPS, name)
//
// Sourced inline because us-atlas only carries the state name, not the USPS
// abbreviation. This is the canonical FIPS-to-USPS mapping (Federal
// Information Processing Standards Publication 5-2, current).
// ---------------------------------------------------------------------------

const US_STATE_FIPS_TO_USPS: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
  // Territories / commonwealth
  "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};

// ---------------------------------------------------------------------------
// Canada province name → ISO 3166-2 code
// ---------------------------------------------------------------------------

const CA_NAME_TO_ISO: Record<string, string> = {
  "Alberta": "CA-AB",
  "British Columbia": "CA-BC",
  "Manitoba": "CA-MB",
  "New Brunswick": "CA-NB",
  "Newfoundland and Labrador": "CA-NL",
  "Northwest Territories": "CA-NT",
  "Nova Scotia": "CA-NS",
  "Nunavut": "CA-NU",
  "Ontario": "CA-ON",
  "Prince Edward Island": "CA-PE",
  "Quebec": "CA-QC",
  "Québec": "CA-QC",
  "Saskatchewan": "CA-SK",
  "Yukon": "CA-YT",
  "Yukon Territory": "CA-YT",
};

interface CountyEntry {
  fips: string;
  name: string;
  stateCode: string;
  stateName: string;
}
interface StateEntry {
  fips: string;
  code: string;
  name: string;
}
interface ProvinceEntry {
  code: string;
  name: string;
}

// ---------------------------------------------------------------------------
// 1) Process us-atlas counties + states
// ---------------------------------------------------------------------------

console.log("[build-topojson] reading us-atlas/counties-10m.json");
const usTopo = JSON.parse(
  readFileSync(path.join(ROOT, "node_modules", "us-atlas", "counties-10m.json"), "utf8"),
) as Topology;

const usCounties = usTopo.objects.counties as TopoGeometryCollection;
const usStates = usTopo.objects.states as TopoGeometryCollection;

const usStatesFc = feature(usTopo, usStates) as FeatureCollection<
  Geometry,
  GeoJsonProperties & { name?: string }
>;
const usCountiesFc = feature(usTopo, usCounties) as FeatureCollection<
  Geometry,
  GeoJsonProperties & { name?: string }
>;

// Annotate each county/state with USPS + composite code.
const stateNameByFips = new Map<string, string>();
const stateEntries: StateEntry[] = [];
for (const f of usStatesFc.features) {
  const fips = String(f.id ?? "");
  const usps = US_STATE_FIPS_TO_USPS[fips];
  const name = (f.properties?.name as string | undefined) ?? "Unknown";
  if (!usps) continue;
  stateNameByFips.set(fips, name);
  (f.properties as Record<string, unknown>).stateCode = `US-${usps}`;
  (f.properties as Record<string, unknown>).usps = usps;
  stateEntries.push({ fips, code: `US-${usps}`, name });
}
// Filter the states FC to only those we have USPS for (excludes weird ids).
usStatesFc.features = usStatesFc.features.filter((f) =>
  US_STATE_FIPS_TO_USPS[String(f.id ?? "")],
);

const countyEntries: CountyEntry[] = [];
for (const f of usCountiesFc.features) {
  const fips = String(f.id ?? "");
  if (fips.length !== 5) continue;
  const stateFips = fips.slice(0, 2);
  const usps = US_STATE_FIPS_TO_USPS[stateFips];
  if (!usps) continue;
  const name = (f.properties?.name as string | undefined) ?? "Unknown";
  const stateName = stateNameByFips.get(stateFips) ?? "Unknown";
  (f.properties as Record<string, unknown>).stateCode = `US-${usps}`;
  (f.properties as Record<string, unknown>).stateName = stateName;
  countyEntries.push({ fips, name, stateCode: `US-${usps}`, stateName });
}
// Strip counties that ended up outside the canonical state list.
usCountiesFc.features = usCountiesFc.features.filter(
  (f) => typeof f.id === "string" && US_STATE_FIPS_TO_USPS[String(f.id).slice(0, 2)],
);

console.log(
  `[build-topojson] US: ${usStatesFc.features.length} states · ${usCountiesFc.features.length} counties`,
);

// ---------------------------------------------------------------------------
// 2) Process Canada provinces
// ---------------------------------------------------------------------------

console.log("[build-topojson] reading scripts/data/canada-provinces-source.geojson");
const caSource = JSON.parse(
  readFileSync(path.join(ROOT, "scripts", "data", "canada-provinces-source.geojson"), "utf8"),
) as FeatureCollection<Geometry, GeoJsonProperties & { name?: string }>;

const caProvincesFc: FeatureCollection<Geometry, GeoJsonProperties & { name?: string }> = {
  type: "FeatureCollection",
  features: [],
};
const provinceEntries: ProvinceEntry[] = [];
for (const f of caSource.features) {
  const name = (f.properties?.name as string | undefined) ?? "Unknown";
  const code = CA_NAME_TO_ISO[name];
  if (!code) {
    console.warn(`[build-topojson] no ISO match for Canadian province ${name}`);
    continue;
  }
  const annotated: Feature<Geometry, GeoJsonProperties & { name?: string }> = {
    ...f,
    id: code,
    properties: {
      ...(f.properties ?? {}),
      name,
      provinceCode: code,
    },
  };
  caProvincesFc.features.push(annotated);
  provinceEntries.push({ code, name });
}

console.log(
  `[build-topojson] Canada: ${caProvincesFc.features.length} provinces`,
);

// ---------------------------------------------------------------------------
// 3) Build the Indiana-only file (preserved for backwards compat).
// ---------------------------------------------------------------------------

const indianaFc: FeatureCollection<Geometry, GeoJsonProperties & { name?: string }> = {
  type: "FeatureCollection",
  features: usCountiesFc.features.filter(
    (f) => typeof f.id === "string" && f.id.startsWith("18"),
  ),
};
console.log(`[build-topojson] Indiana: ${indianaFc.features.length} counties`);

// ---------------------------------------------------------------------------
// 4) Write all assets
// ---------------------------------------------------------------------------

const writeJson = (name: string, data: unknown) => {
  const p = path.join(TOPO_OUT, name);
  writeFileSync(p, JSON.stringify(data));
  console.log(`  → ${p} (${(readFileSync(p).byteLength / 1024).toFixed(1)} KB)`);
};
writeJson("us-counties.geojson", usCountiesFc);
writeJson("us-states.geojson", usStatesFc);
writeJson("canada-provinces.geojson", caProvincesFc);
writeJson("indiana-counties.json", indianaFc);

// ---------------------------------------------------------------------------
// 5) Generate the name registry TS module
// ---------------------------------------------------------------------------

const ts = [
  "// AUTOGENERATED by scripts/build-topojson.ts — do not edit by hand.",
  "// Region name + code lookups for FIPS-equivalent identifiers.",
  "",
  "export interface CountyEntry { name: string; stateCode: string; stateName: string }",
  "export interface StateEntry  { fips: string; name: string }",
  "export interface ProvinceEntry { name: string }",
  "",
  `export const US_COUNTIES: Readonly<Record<string, CountyEntry>> = ${JSON.stringify(
    Object.fromEntries(countyEntries.map((c) => [c.fips, { name: c.name, stateCode: c.stateCode, stateName: c.stateName }])),
  )};`,
  "",
  `export const US_STATES_BY_FIPS: Readonly<Record<string, StateEntry>> = ${JSON.stringify(
    Object.fromEntries(stateEntries.map((s) => [s.fips, { fips: s.fips, name: s.name }])),
  )};`,
  "",
  `export const US_STATES_BY_CODE: Readonly<Record<string, StateEntry>> = ${JSON.stringify(
    Object.fromEntries(stateEntries.map((s) => [s.code, { fips: s.fips, name: s.name }])),
  )};`,
  "",
  `export const CA_PROVINCES: Readonly<Record<string, ProvinceEntry>> = ${JSON.stringify(
    Object.fromEntries(provinceEntries.map((p) => [p.code, { name: p.name }])),
  )};`,
  "",
].join("\n");
writeFileSync(SRC_OUT, ts);
console.log(`  → ${SRC_OUT}`);
console.log("[build-topojson] done.");
