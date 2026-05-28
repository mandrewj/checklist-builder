// Shared JSON-column types referenced by multiple schema files.

export type TaxonQuery = {
  name: string;
  rank: "species" | "genus" | "family" | "subfamily" | string;
  gbifKey?: number;
  inatId?: number;
};

export type IngestFilters = {
  yearStart: number;
  yearEnd: number;
  basisOfRecord: string[];
  // Casual is *never* an option — iNat ingest always excludes casual via
  // verifiable=true at the API layer. "research" = research-grade only.
  // "research_or_needs_id" = research + needs_id (verifiable).
  qualityGrade: "research" | "research_or_needs_id";
  requireCoordinates: boolean;
  excludeCaptive: boolean;
  coordinatePrecisionDp: number;
};

export type TaxonExternalIds = {
  gbifKey?: number;
  inatId?: number;
};
