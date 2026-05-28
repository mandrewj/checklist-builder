import { CountyChoropleth } from "./county-choropleth";
import { RegionChoropleth } from "./region-choropleth";
import { indianaCounties } from "@/lib/insectid/topojson";

export interface MiniChoroplethProps {
  countyPresence: Record<string, number>;
  /** Region codes used to load the right topology. Omit for the Indiana fast-path. */
  regionCodes?: ReadonlyArray<string>;
  mode?: "count" | "binary";
}

/**
 * Inline-table-sized choropleth. ~112×84 px. No legend, no hover, no labels —
 * a pure visual indicator of distribution for the checklist row.
 *
 * Uses the bundled Indiana file directly when regionCodes is omitted or
 * exactly ['US-IN']; otherwise lazy-loads via RegionChoropleth.
 */
export function MiniChoropleth({
  countyPresence,
  regionCodes,
  mode = "count",
}: MiniChoroplethProps) {
  const isIndianaOnly =
    !regionCodes ||
    (regionCodes.length === 1 && regionCodes[0] === "US-IN");
  if (isIndianaOnly) {
    return (
      <CountyChoropleth
        topology={indianaCounties}
        countyPresence={countyPresence}
        mode={mode}
        size="sm"
        showLegend={false}
      />
    );
  }
  return (
    <RegionChoropleth
      regionCodes={regionCodes}
      countyPresence={countyPresence}
      mode={mode}
      size="sm"
      showLegend={false}
    />
  );
}
