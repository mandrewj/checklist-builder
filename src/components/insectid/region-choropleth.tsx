"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";
import { Loader2, MapPinOff } from "lucide-react";
import { CountyChoropleth, type ChoroplethSize } from "./county-choropleth";
import { indianaCounties } from "@/lib/insectid/topojson";

type Props = GeoJsonProperties & {
  name?: string;
  stateCode?: string;
  provinceCode?: string;
};

type RegionFeatureCollection = FeatureCollection<Geometry, Props>;

// Memoize the fetched topologies across choropleth instances per page.
const cache = new Map<string, Promise<RegionFeatureCollection>>();

async function loadJson(path: string): Promise<RegionFeatureCollection> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(path)
      .then((r) => {
        if (!r.ok) throw new Error(`fetch ${path}: HTTP ${r.status}`);
        return r.json() as Promise<RegionFeatureCollection>;
      })
      .catch((err) => {
        cache.delete(path);
        throw err;
      });
    cache.set(path, p);
  }
  return p;
}

interface RegionChoroplethProps {
  /** Region codes ('US-IN', 'CA-ON', …). Determines which topology loads. */
  regionCodes: ReadonlyArray<string>;
  countyPresence: Record<string, number>;
  citeOnlyCounties?: ReadonlySet<string>;
  mode?: "count" | "binary";
  size?: ChoroplethSize;
  showLegend?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function RegionChoropleth(props: RegionChoroplethProps) {
  const usCodes = useMemo(
    () => props.regionCodes.filter((c) => c.startsWith("US-")),
    [props.regionCodes],
  );
  const caCodes = useMemo(
    () => props.regionCodes.filter((c) => c.startsWith("CA-")),
    [props.regionCodes],
  );

  const [fc, setFc] = useState<RegionFeatureCollection | null>(null);
  const [outlines, setOutlines] = useState<RegionFeatureCollection | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setFc(null);
    setOutlines(null);

    async function build(): Promise<{
      fc: RegionFeatureCollection;
      outlines: RegionFeatureCollection;
    }> {
      const features: Feature<Geometry, Props>[] = [];
      const outlineFeatures: Feature<Geometry, Props>[] = [];

      // Indiana-only fast path — already statically bundled.
      const indianaOnly =
        usCodes.length === 1 && usCodes[0] === "US-IN" && caCodes.length === 0;
      if (indianaOnly) {
        for (const f of (indianaCounties as RegionFeatureCollection).features) {
          features.push(f);
        }
      }

      if (usCodes.length > 0) {
        const wanted = new Set(usCodes);
        if (!indianaOnly) {
          const usFc = await loadJson("/topojson/us-counties.geojson");
          for (const f of usFc.features) {
            if (f.properties?.stateCode && wanted.has(f.properties.stateCode)) {
              features.push(f);
            }
          }
        }
        const usStates = await loadJson("/topojson/us-states.geojson");
        for (const f of usStates.features) {
          if (f.properties?.stateCode && wanted.has(f.properties.stateCode)) {
            outlineFeatures.push(f);
          }
        }
      }

      if (caCodes.length > 0) {
        const caFc = await loadJson("/topojson/canada-provinces.geojson");
        const wanted = new Set(caCodes);
        for (const f of caFc.features) {
          const code =
            f.properties?.provinceCode ?? (typeof f.id === "string" ? f.id : null);
          if (code && wanted.has(code)) {
            features.push(f);
            // Province geometry already IS the outline.
            outlineFeatures.push(f);
          }
        }
      }

      return {
        fc: { type: "FeatureCollection", features },
        outlines: { type: "FeatureCollection", features: outlineFeatures },
      };
    }

    build().then(
      (out) => {
        if (!cancelled) {
          setFc(out.fc);
          setOutlines(out.outlines);
        }
      },
      (e: unknown) => {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "failed to load region geometry");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [usCodes, caCodes]);

  if (err) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-danger-600/30 bg-danger-50 px-4 py-3 text-xs text-danger-600">
        <MapPinOff className="size-4 shrink-0" aria-hidden />
        Could not load map for {props.regionCodes.join(", ")}: {err}
      </div>
    );
  }

  if (!fc) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-surface-3 bg-surface-1 px-4 py-3 text-xs text-text-400">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        Loading {props.regionCodes.join(" · ")} map…
      </div>
    );
  }

  if (fc.features.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-xs text-warning-700">
        <MapPinOff className="size-4 shrink-0" aria-hidden />
        No region geometry found for {props.regionCodes.join(", ")}.
      </div>
    );
  }

  return (
    <CountyChoropleth
      topology={fc}
      outlines={outlines ?? undefined}
      countyPresence={props.countyPresence}
      citeOnlyCounties={props.citeOnlyCounties}
      mode={props.mode}
      size={props.size}
      showLegend={props.showLegend}
      ariaLabel={props.ariaLabel}
      className={props.className}
    />
  );
}
