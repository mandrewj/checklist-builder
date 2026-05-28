/**
 * Loads the bundled Indiana county GeoJSON. Imported as a typed JSON asset
 * so both server (RSC, exports) and client (CountyChoropleth island) can
 * use the same source.
 */

import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
} from "geojson";

import data from "../../../public/topojson/indiana-counties.json";

export type CountyProperties = GeoJsonProperties & { name?: string };
export type CountyFeature = Feature<Geometry, CountyProperties>;
export type CountyFeatureCollection = FeatureCollection<
  Geometry,
  CountyProperties
>;

export const indianaCounties = data as unknown as CountyFeatureCollection;
