/**
 * Per-species county-distribution SVG, shared by the maps export and the
 * DOCX manuscript builder. Self-contained — colors and fonts are inlined.
 */

import { geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
import { indianaCounties } from "@/lib/insectid/topojson";
import { viridis, viridisLegendStops } from "@/lib/insectid/viridis";
import type { TaxonRow } from "@/lib/db/schema";

type CountyFC = FeatureCollection<
  Geometry,
  GeoJsonProperties & { name?: string }
>;

const W = 900;
const H = 700;
const PAD = 28;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

export interface SpeciesSvgParams {
  taxon: Pick<TaxonRow, "scientificName" | "authority">;
  presence: Record<string, number>;
  citeOnly: ReadonlySet<string>;
  /** Region geometry to render. Defaults to Indiana for backwards compat,
   *  but every export caller should pass a project-scoped FeatureCollection
   *  from `regionGeometryFor(project.regionCodes)`. */
  topology?: CountyFC;
  /** State/province outline polygons rendered atop counties with a thicker
   *  stroke. Optional — falls back to no outline overlay. */
  outlines?: CountyFC;
}

export function buildSpeciesSvg({
  taxon,
  presence,
  citeOnly,
  topology,
  outlines,
}: SpeciesSvgParams): string {
  const features = (topology ?? (indianaCounties as CountyFC));
  // Fit the projection to the *union* of counties + outlines so the bounding
  // box is identical to the on-screen choropleth.
  const fitTarget: CountyFC = outlines && outlines.features.length > 0
    ? { type: "FeatureCollection", features: [...features.features, ...outlines.features] }
    : features;
  const projection = geoMercator().fitExtent(
    [
      [PAD, PAD],
      [W - PAD, H - PAD],
    ],
    fitTarget,
  );
  const path = geoPath(projection);

  let maxN = 0;
  for (const v of Object.values(presence)) {
    if (v > maxN) maxN = v;
  }

  const escapeXml = (s: string) =>
    s.replace(/[<>&'"]/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
    );

  const countyPaths = features.features
    .map((f) => {
      const fips = String(f.id ?? "");
      const n = presence[fips] ?? 0;
      const fill =
        n === 0
          ? "#F1F3F5"
          : viridis(maxN === 0 ? 0 : n / maxN);
      const d = path(f as Feature<Geometry>) ?? "";
      const name = escapeXml(String(f.properties?.name ?? "Unknown"));
      return `<path d="${d}" fill="${fill}" stroke="#E5E7EB" stroke-width="0.5"><title>${name} County · ${n} records</title></path>`;
    })
    .join("");

  const citeDots = Array.from(citeOnly)
    .map((fips) => {
      const f = features.features.find((g) => String(g.id) === fips);
      if (!f) return "";
      const [cx, cy] = path.centroid(f as Feature<Geometry>);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="#1F95B8"/>`;
    })
    .join("");

  const legendStops = viridisLegendStops(5);
  const legendY = H - 20;
  const legendX = PAD;
  const legendW = 180;
  const legendCellW = legendW / legendStops.length;
  const legend = legendStops
    .map(
      (s, i) =>
        `<rect x="${legendX + i * legendCellW}" y="${legendY}" width="${legendCellW}" height="10" fill="${s.color}" stroke="none"/>`,
    )
    .join("");

  const titleStr = `${taxon.scientificName} — county distribution`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Lato, Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(titleStr)}</title>`,
    `<rect width="100%" height="100%" fill="#FFFFFF"/>`,
    `<g>${countyPaths}</g>`,
    outlines && outlines.features.length > 0
      ? `<g fill="none" stroke="#0A3F95" stroke-width="1.8" stroke-linejoin="round">${outlines.features
          .map((f) => `<path d="${path(f as Feature<Geometry>) ?? ""}"/>`)
          .join("")}</g>`
      : "",
    `<g>${citeDots}</g>`,
    `<g>${legend}`,
    `<text x="${legendX - 4}" y="${legendY + 9}" font-size="10" fill="#5f6360" text-anchor="end">0</text>`,
    `<text x="${legendX + legendW + 4}" y="${legendY + 9}" font-size="10" fill="#5f6360">${maxN}</text>`,
    `<text x="${legendX + legendW / 2}" y="${legendY - 4}" font-size="10" fill="#5f6360" text-anchor="middle">Records</text>`,
    `</g>`,
    `<text x="${PAD}" y="${PAD - 6}" font-size="18" font-weight="700" fill="#0A3F95"><tspan font-style="italic">${escapeXml(taxon.scientificName)}</tspan> <tspan fill="#5f6360" font-weight="400">${escapeXml(taxon.authority ?? "")}</tspan></text>`,
    `</svg>`,
  ].join("");
}

export const SPECIES_SVG_DIMENSIONS = { w: W, h: H };
