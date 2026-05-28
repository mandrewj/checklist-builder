"use client";

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";
import { cn } from "@/lib/utils";
import { viridis, viridisLegendStops } from "@/lib/insectid/viridis";

export type ChoroplethMode = "count" | "binary";
export type ChoroplethSize = "sm" | "md" | "lg" | "print";

type CountyFeature = Feature<Geometry, GeoJsonProperties & { name?: string }>;

export interface CountyChoroplethProps {
  /** Pre-loaded GeoJSON FeatureCollection (one Feature per county). */
  topology: FeatureCollection<Geometry, GeoJsonProperties & { name?: string }>;
  /** Optional state/province outline polygons rendered on top of counties
   *  with a thicker stroke so political boundaries read heavier than
   *  internal county lines. */
  outlines?: FeatureCollection<Geometry, GeoJsonProperties & { name?: string }>;
  /** Per-county record counts keyed by 5-digit FIPS. */
  countyPresence: Record<string, number>;
  /** Counties whose presence comes only from a cite-only literature record. */
  citeOnlyCounties?: ReadonlySet<string>;
  mode?: ChoroplethMode;
  size?: ChoroplethSize;
  showLabels?: boolean;
  showLegend?: boolean;
  highlightFips?: string | null;
  ariaLabel?: string;
  className?: string;
}

const DIMENSIONS: Record<ChoroplethSize, { w: number; h: number; pad: number }> =
  {
    sm: { w: 240, h: 180, pad: 8 },
    md: { w: 420, h: 320, pad: 16 },
    lg: { w: 620, h: 480, pad: 20 },
    print: { w: 900, h: 700, pad: 28 },
  };

export function CountyChoropleth({
  topology,
  outlines,
  countyPresence,
  citeOnlyCounties,
  mode = "count",
  size = "md",
  showLabels = false,
  showLegend = true,
  highlightFips,
  ariaLabel,
  className,
}: CountyChoroplethProps) {
  const [hover, setHover] = useState<{
    fips: string;
    name: string;
    n: number;
  } | null>(null);
  const { w, h, pad } = DIMENSIONS[size];

  const { paths, outlinePaths, maxN, totalPresent } = useMemo(() => {
    // Fit projection to the bounding box of counties + outlines so the
    // extent matches the on-screen choropleth exactly.
    const fitTarget: FeatureCollection<Geometry, GeoJsonProperties> =
      outlines && outlines.features.length > 0
        ? {
            type: "FeatureCollection",
            features: [...topology.features, ...outlines.features],
          }
        : topology;
    const projection = geoMercator().fitExtent(
      [
        [pad, pad],
        [w - pad, h - pad],
      ],
      fitTarget,
    );
    const path = geoPath(projection);
    const outlinePaths = (outlines?.features ?? []).map((f) =>
      path(f as CountyFeature) ?? "",
    );

    let maxN = 0;
    let totalPresent = 0;
    for (const v of Object.values(countyPresence)) {
      if (v > 0) {
        maxN = Math.max(maxN, v);
        totalPresent += 1;
      }
    }

    const paths = topology.features.map((f) => {
      const fips = String(f.id ?? "");
      const n = countyPresence[fips] ?? 0;
      const isCiteOnly = !!citeOnlyCounties?.has(fips);
      let fill: string;
      if (n === 0) {
        fill = "var(--color-surface-2)";
      } else if (mode === "binary") {
        fill = "var(--color-blue-600)";
      } else {
        // Sequential viridis. t = n / maxN, clamped.
        fill = viridis(maxN === 0 ? 0 : n / maxN);
      }
      return {
        fips,
        name: (f.properties?.name as string | undefined) ?? "Unknown",
        n,
        d: path(f as CountyFeature) ?? "",
        fill,
        isCiteOnly,
      };
    });
    return { paths, outlinePaths, maxN, totalPresent };
  }, [topology, outlines, countyPresence, citeOnlyCounties, mode, w, h, pad]);

  const label =
    ariaLabel ??
    `County choropleth — ${totalPresent} of ${topology.features.length} counties with at least one record`;

  // Counties with at least one record, sorted by name. Surfaced to
  // screen readers via a sr-only list because the SVG paths themselves
  // are only decorative for AT.
  const presentCounties = paths
    .filter((p) => p.n > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <figure
      className={cn(
        "relative inline-flex flex-col items-stretch gap-2",
        className,
      )}
      style={{ width: w }}
      role="img"
      aria-label={label}
    >
      <div className="sr-only">
        <p>{label}.</p>
        {presentCounties.length > 0 && (
          <ul>
            {presentCounties.map((p) => (
              <li key={p.fips}>
                {p.name} County: {p.n} record{p.n === 1 ? "" : "s"}
                {p.isCiteOnly ? " (cite-only)" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width={w}
        height={h}
        xmlns="http://www.w3.org/2000/svg"
        className="block overflow-visible rounded-md bg-surface-0"
      >
        <title>{label}</title>
        <g aria-hidden>
          {paths.map((p) => {
            const isHovered = hover?.fips === p.fips;
            const isHighlit = highlightFips === p.fips;
            return (
              <path
                key={p.fips}
                d={p.d}
                fill={p.fill}
                stroke={
                  isHovered || isHighlit
                    ? "var(--color-blue-600)"
                    : "var(--color-surface-3)"
                }
                strokeWidth={isHovered || isHighlit ? 1.5 : 0.5}
                onMouseEnter={() => setHover({ fips: p.fips, name: p.name, n: p.n })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              >
                <desc>
                  {p.name} County · {p.n} record{p.n === 1 ? "" : "s"}
                  {p.isCiteOnly ? " (cite-only)" : ""}
                </desc>
              </path>
            );
          })}
        </g>

        {/* State/province outline overlay — drawn after counties so the
            thicker stroke reads as the political boundary atop county lines. */}
        {outlinePaths.length > 0 && (
          <g
            aria-hidden
            pointerEvents="none"
            fill="none"
            stroke="var(--color-blue-800)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          >
            {outlinePaths.map((d, i) => (
              <path key={`outline-${i}`} d={d} />
            ))}
          </g>
        )}

        {/* Cite-only stipple overlay — small dot inside each county that only
            has a literature record. */}
        {citeOnlyCounties && citeOnlyCounties.size > 0 && (
          <g aria-hidden pointerEvents="none">
            {paths
              .filter((p) => p.isCiteOnly)
              .map((p) => {
                const projection = geoMercator().fitExtent(
                  [
                    [pad, pad],
                    [w - pad, h - pad],
                  ],
                  topology,
                );
                const path = geoPath(projection);
                const centroid = path.centroid(
                  topology.features.find((f) => String(f.id) === p.fips) ??
                    topology.features[0],
                );
                return (
                  <circle
                    key={`cite-${p.fips}`}
                    cx={centroid[0]}
                    cy={centroid[1]}
                    r={2}
                    fill="var(--color-cyan-500)"
                  />
                );
              })}
          </g>
        )}

        {showLabels && (
          <g aria-hidden pointerEvents="none">
            {paths.map((p) => {
              const projection = geoMercator().fitExtent(
                [
                  [pad, pad],
                  [w - pad, h - pad],
                ],
                topology,
              );
              const path = geoPath(projection);
              const centroid = path.centroid(
                topology.features.find((f) => String(f.id) === p.fips) ??
                  topology.features[0],
              );
              return (
                <text
                  key={`label-${p.fips}`}
                  x={centroid[0]}
                  y={centroid[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fontFamily="var(--font-sans)"
                  fill="var(--color-text-700)"
                >
                  {p.name}
                </text>
              );
            })}
          </g>
        )}
      </svg>

      {(showLegend || hover) && (
        <figcaption className="flex items-center justify-between gap-3 text-[11px] text-text-500">
          {showLegend && mode === "count" && maxN > 0 && (
            <Legend max={maxN} />
          )}
          {showLegend && mode === "binary" && (
            <BinaryLegend />
          )}
          {hover && (
            <span className="ml-auto rounded bg-surface-2 px-2 py-0.5 font-medium text-text-700">
              {hover.name} · {hover.n} record{hover.n === 1 ? "" : "s"}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function Legend({ max }: { max: number }) {
  const stops = viridisLegendStops(5);
  return (
    <div className="flex items-center gap-2">
      <span className="font-bold uppercase tracking-[0.08em] text-text-400">
        Records
      </span>
      <span>0</span>
      <div className="flex h-3 w-24 overflow-hidden rounded-sm">
        {stops.map((s) => (
          <div
            key={s.t}
            style={{ background: s.color, width: `${100 / stops.length}%` }}
          />
        ))}
      </div>
      <span>{max}</span>
    </div>
  );
}

function BinaryLegend() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block size-3 rounded-sm bg-blue-600" />
      <span>Present</span>
      <span className="ml-2 inline-block size-3 rounded-sm bg-surface-2" />
      <span>Absent</span>
    </div>
  );
}
