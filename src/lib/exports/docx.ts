/**
 * Manuscript-draft DOCX export. Built with the `docx` library (which Word
 * round-trips faithfully). Section structure mirrors EXPORTS.md §"DOCX".
 *
 * Maps + phenology charts are embedded as PNGs rasterized (via resvg with
 * bundled Lato fonts) from the same SVG builders used on screen.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
} from "docx";
import { buildSpeciesSvg, SPECIES_SVG_DIMENSIONS } from "./species-svg";
import {
  buildPhenologySvg,
  bucketByMonth,
  dateRangeOf,
  PHENOLOGY_SVG_DIMENSIONS,
} from "./phenology-svg";
import { regionGeometryFor, regionOutlinesFor } from "./region-geometry";
import { rasterizeAllInParallel } from "./rasterize";
import { regionDescriptor } from "@/lib/insectid/regions";
import type { ProjectSnapshot } from "./snapshot";
import type { TaxonRow } from "@/lib/db/schema";

const BLUE_800 = "0A3F95";
const TEXT_600 = "1F2222";
const TEXT_400 = "6D6F6E";
const TEXT_300 = "A5A5A5";

const MAP_PIXEL_WIDTH = 900;
const MAP_DOC_WIDTH = 480;
const MAP_DOC_HEIGHT = Math.round(
  (MAP_DOC_WIDTH * SPECIES_SVG_DIMENSIONS.h) / SPECIES_SVG_DIMENSIONS.w,
);
const PHENOLOGY_DOC_WIDTH = 480;
const PHENOLOGY_DOC_HEIGHT = Math.round(
  (PHENOLOGY_DOC_WIDTH * PHENOLOGY_SVG_DIMENSIONS.h) / PHENOLOGY_SVG_DIMENSIONS.w,
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function h1(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, color: BLUE_800, size: 40 }),
    ],
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  });
}

function h2(text: string, opts: { italic?: boolean } = {}): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        italics: opts.italic ?? false,
        color: BLUE_800,
        size: 28,
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text, bold: true, color: TEXT_600, size: 22 }),
    ],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
  });
}

function body(
  text: string,
  opts: { italic?: boolean; color?: string } = {},
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        italics: opts.italic ?? false,
        color: opts.color ?? TEXT_600,
        size: 22,
      }),
    ],
    spacing: { after: 120 },
  });
}

function placeholder(prompt: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: prompt,
        italics: true,
        color: TEXT_300,
        size: 20,
      }),
    ],
    spacing: { after: 360 },
  });
}

function caption(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 240 },
    children: [
      new TextRun({ text, italics: true, color: TEXT_400, size: 18 }),
    ],
  });
}

function smallCell(text: string, opts: { bold?: boolean } = {}): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts.bold ?? false,
            color: TEXT_600,
            size: 18,
          }),
        ],
      }),
    ],
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

function table(rows: ReadonlyArray<ReadonlyArray<string>>, opts: { header?: boolean } = {}): Table {
  const tableRows = rows.map((r, i) => {
    const cells = r.map((c) => smallCell(c, { bold: opts.header && i === 0 }));
    return new TableRow({ children: cells });
  });
  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "EEF1F2" },
      insideVertical:   { style: BorderStyle.SINGLE, size: 2, color: "EEF1F2" },
    },
  });
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function titlePage(snapshot: ProjectSnapshot, regionLabel: string): Paragraph[] {
  const p = snapshot.project;
  const taxonName = p.taxonQuery.name;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 240 },
      children: [
        new TextRun({
          text: p.name,
          bold: true,
          color: BLUE_800,
          size: 56,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: `${taxonName} · ${regionLabel} · ${p.ingestFilters.yearStart}–${p.ingestFilters.yearEnd}`,
          color: TEXT_400,
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: [...snapshot.members]
            .sort((a, b) => (a.role === "Lead" ? -1 : b.role === "Lead" ? 1 : 0))
            .map((m) => m.user.displayName)
            .join(" · "),
          color: TEXT_600,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 4800 },
      children: [
        new TextRun({
          text: `Snapshot ${snapshot.snapshotId} · Generated ${snapshot.generatedAt.toISOString().slice(0, 10)}`,
          color: TEXT_400,
          size: 18,
          italics: true,
        }),
      ],
    }),
  ];
}

function methodsSection(snapshot: ProjectSnapshot, regionLabel: string): Paragraph[] {
  const p = snapshot.project;
  const f = p.ingestFilters;
  const gbifCount = snapshot.records.filter(
    (r) => r.source === "gbif" && r.status !== "rejected",
  ).length;
  const inatCount = snapshot.records.filter(
    (r) => r.source === "inat" && r.status !== "rejected",
  ).length;
  const citeCount = snapshot.records.filter(
    (r) => r.source === "cite" && r.status !== "rejected",
  ).length;
  const resolvedConflicts = snapshot.taxonConflicts.filter(
    (c) => c.resolution !== null,
  );

  const out: Paragraph[] = [];
  out.push(h2("Methods"));

  out.push(h3("Data sources"));
  out.push(
    body(
      `Occurrence records were aggregated from the Global Biodiversity Information Facility (GBIF, https://gbif.org) and iNaturalist (https://inaturalist.org) for ${taxonScope(p.taxonQuery.name, p.taxonQuery.rank)}. The GBIF Backbone Taxonomy was used as the reference taxonomic authority; iNaturalist records were drawn from the Research and Needs-ID quality grades depending on project settings.`,
    ),
  );
  out.push(
    body(
      `GBIF returned ${gbifCount.toLocaleString()} ${plural(gbifCount, "record")} after filtering by region, year, and basis-of-record. iNaturalist contributed ${inatCount.toLocaleString()} ${plural(inatCount, "observation")}. ${citeCount} cite-only ${plural(citeCount, "record")} were added from primary literature (see Supplement S1).`,
    ),
  );

  out.push(h3("Region"));
  out.push(
    body(
      `Records were restricted to ${regionLabel} (${p.regionCodes.join(", ")}). Lat/lng coordinates were reverse-geocoded to county FIPS via point-in-polygon against the U.S. Census Bureau TIGER 2024 county boundaries.`,
    ),
  );

  out.push(h3("Ingest filters"));
  out.push(
    body(
      `Date range: ${f.yearStart}–${f.yearEnd}. GBIF basis-of-record: ${f.basisOfRecord.join(", ")}. iNaturalist quality grade: ${f.qualityGrade}. Captive / cultivated records were ${f.excludeCaptive ? "excluded" : "included"}. Coordinate precision threshold: ${f.coordinatePrecisionDp} decimal places (~${precisionMeters(f.coordinatePrecisionDp)} m).`,
    ),
  );

  out.push(h3("Reverse geocoding"));
  out.push(
    body(
      `Geographic assignment was performed locally via point-in-polygon tests against the TIGER 2024 county boundaries. Records whose coordinates did not resolve to a county within the project region were flagged for manual review.`,
    ),
  );

  out.push(h3("Taxonomic backbone"));
  if (resolvedConflicts.length === 0) {
    out.push(
      body(
        `No taxonomic conflicts were detected between GBIF and iNaturalist for the species included in this checklist.`,
      ),
    );
  } else {
    out.push(
      body(
        `${resolvedConflicts.length} taxonomic ${plural(resolvedConflicts.length, "conflict")} between GBIF and iNaturalist were resolved during curation. See Supplement S2 for details.`,
      ),
    );
  }

  out.push(h3("Inclusion criteria"));
  out.push(
    placeholder(
      "Replace this section with project-specific inclusion criteria — geographic scope, native-only treatment, voucher requirements, etc.",
    ),
  );

  return out;
}

/**
 * Render the full included-taxa checklist grouped by family (alphabetical),
 * each family heading followed by its taxa (also alphabetical, italicized
 * scientific name with non-italic authority).
 */
function checklistByFamily(taxa: ReadonlyArray<TaxonRow>): Paragraph[] {
  if (taxa.length === 0) {
    return [body("(No included taxa.)")];
  }
  const byFamily = new Map<string, TaxonRow[]>();
  for (const t of taxa) {
    const fam = t.family?.trim() || "Unplaced";
    const arr = byFamily.get(fam) ?? [];
    arr.push(t);
    byFamily.set(fam, arr);
  }
  const families = [...byFamily.keys()].sort((a, b) => a.localeCompare(b));

  const out: Paragraph[] = [];
  for (const family of families) {
    out.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: family,
            bold: true,
            color: BLUE_800,
            size: 24,
          }),
        ],
      }),
    );
    const taxaForFamily = (byFamily.get(family) ?? []).slice().sort((a, b) =>
      a.scientificName.localeCompare(b.scientificName),
    );
    for (const t of taxaForFamily) {
      out.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: t.scientificName, italics: true, color: TEXT_600, size: 22 }),
            new TextRun({
              text: t.authority ? ` ${t.authority}` : "",
              color: TEXT_400,
              size: 22,
            }),
          ],
        }),
      );
    }
  }
  return out;
}

function speciesAccount(
  taxon: TaxonRow,
  presence: Record<string, number>,
  png: Buffer,
  recordCounts: { total: number; gbif: number; inat: number; cite: number },
  figureIndex: number,
  phenologyPng: Buffer | null,
): Paragraph[] {
  const externalRefs: string[] = [];
  if (taxon.externalIds.gbifKey)
    externalRefs.push(`GBIF taxonKey ${taxon.externalIds.gbifKey}`);
  if (taxon.externalIds.inatId)
    externalRefs.push(`iNat taxon_id ${taxon.externalIds.inatId}`);

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: taxon.scientificName,
          italics: true,
          bold: true,
          color: BLUE_800,
          size: 28,
        }),
        new TextRun({
          text: ` ${taxon.authority ?? ""}`.trimEnd(),
          color: BLUE_800,
          size: 28,
        }),
      ],
    }),
    body(
      [
        `Family: ${taxon.family ?? "—"}`,
        taxon.subfamily ? `Subfamily: ${taxon.subfamily}` : null,
        externalRefs.join(" · "),
      ]
        .filter(Boolean)
        .join(" · "),
      { color: TEXT_400 },
    ),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: png as unknown as Uint8Array,
          transformation: { width: MAP_DOC_WIDTH, height: MAP_DOC_HEIGHT },
          type: "png",
        }),
      ],
      spacing: { before: 120 },
    }),
    caption(
      `Figure ${figureIndex}. Distribution of ${taxon.scientificName} in the project region. Cells indicate counties with at least one record; shade encodes record count (viridis).`,
    ),
    body(
      `Records: ${recordCounts.total.toLocaleString()} across ${Object.keys(presence).length} ${plural(Object.keys(presence).length, "county")}. Sources: GBIF (${recordCounts.gbif}), iNaturalist (${recordCounts.inat}), cite-only (${recordCounts.cite}).`,
    ),
    ...(phenologyPng
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: phenologyPng as unknown as Uint8Array,
                transformation: {
                  width: PHENOLOGY_DOC_WIDTH,
                  height: PHENOLOGY_DOC_HEIGHT,
                },
                type: "png",
              }),
            ],
            spacing: { before: 120 },
          }),
          caption(
            `Figure ${figureIndex + 1}. Phenology of ${taxon.scientificName} — record counts by month.`,
          ),
        ]
      : []),
    taxon.inclusionReasoning
      ? body(`Inclusion reasoning: ${taxon.inclusionReasoning}`)
      : placeholder("Inclusion reasoning has not been recorded for this species."),
  ];
}

function supplements(snapshot: ProjectSnapshot): Paragraph[] {
  const out: Paragraph[] = [];

  // S1 — Cite-only records.
  const citeRecords = snapshot.records.filter((r) => r.source === "cite");
  out.push(new Paragraph({ children: [new PageBreak()] }));
  out.push(h2("Supplement S1. Cite-only records"));
  if (citeRecords.length === 0) {
    out.push(body("No cite-only records in this project."));
  } else {
    const rows: string[][] = [["Species", "County FIPS", "Citation", "DOI"]];
    const taxaById = new Map(snapshot.taxa.map((t) => [t.id, t]));
    for (const r of citeRecords) {
      const taxon = taxaById.get(r.taxonId);
      rows.push([
        taxon?.scientificName ?? "—",
        r.countyFips ?? "—",
        r.citation ?? "—",
        r.doi ?? "—",
      ]);
    }
    out.push(
      new Paragraph({
        spacing: { before: 120, after: 120 },
        children: [new TextRun({ text: " " })],
      }),
    );
    // Tables aren't paragraphs in docx — they must be returned at the
    // section level. We surface them via a sentinel in the calling code.
  }

  // S2 — Taxonomic conflicts.
  out.push(h2("Supplement S2. Taxonomic conflicts"));
  if (snapshot.taxonConflicts.length === 0) {
    out.push(body("No taxonomic conflicts were detected."));
  }

  return out;
}

function citeOnlyTable(snapshot: ProjectSnapshot): Table | null {
  const citeRecords = snapshot.records.filter((r) => r.source === "cite");
  if (citeRecords.length === 0) return null;
  const taxaById = new Map(snapshot.taxa.map((t) => [t.id, t]));
  const rows: string[][] = [["Species", "County FIPS", "Citation", "DOI"]];
  for (const r of citeRecords) {
    const taxon = taxaById.get(r.taxonId);
    rows.push([
      taxon?.scientificName ?? "—",
      r.countyFips ?? "—",
      r.citation ?? "—",
      r.doi ?? "—",
    ]);
  }
  return table(rows, { header: true });
}

function conflictsTable(snapshot: ProjectSnapshot): Table | null {
  if (snapshot.taxonConflicts.length === 0) return null;
  const rows: string[][] = [
    ["GBIF name", "iNat name", "Resolution", "Custom name"],
  ];
  for (const c of snapshot.taxonConflicts) {
    rows.push([
      c.gbifName,
      c.inatName,
      c.resolution ?? "unresolved",
      c.customName ?? "—",
    ]);
  }
  return table(rows, { header: true });
}

// ---------------------------------------------------------------------------
// Top-level
// ---------------------------------------------------------------------------

export async function buildDocxExport(snapshot: ProjectSnapshot): Promise<Buffer> {
  // Exclude only the explicitly-excluded taxa; include + undecided both
  // appear in the manuscript draft so fresh projects produce useful output.
  const includedTaxa = snapshot.taxa
    .filter((t) => t.included !== "exclude")
    .sort((a, b) => a.scientificName.localeCompare(b.scientificName));

  // Region label — "Indiana" or "Indiana · Ohio" or "Ontario, Canada", etc.
  const regionLabel =
    snapshot.project.regionCodes
      .map((c) => regionDescriptor(c)?.name ?? c)
      .join(", ") || snapshot.project.regionCodes.join(", ");

  const presenceByTaxon = new Map<string, Record<string, number>>();
  const citeOnlyByTaxon = new Map<string, Set<string>>();
  for (const cp of snapshot.countyPresence) {
    const p = presenceByTaxon.get(cp.taxonId) ?? {};
    p[cp.countyFips] = cp.nRecords;
    presenceByTaxon.set(cp.taxonId, p);
    if (cp.hasCiteOnly) {
      const s = citeOnlyByTaxon.get(cp.taxonId) ?? new Set<string>();
      s.add(cp.countyFips);
      citeOnlyByTaxon.set(cp.taxonId, s);
    }
  }

  // Record counts per taxon for the account paragraph.
  const recordCountsByTaxon = new Map<
    string,
    { total: number; gbif: number; inat: number; cite: number }
  >();
  for (const r of snapshot.records) {
    if (r.status === "rejected") continue;
    const acc =
      recordCountsByTaxon.get(r.taxonId) ?? { total: 0, gbif: 0, inat: 0, cite: 0 };
    acc.total += 1;
    if (r.source === "gbif") acc.gbif += 1;
    else if (r.source === "inat") acc.inat += 1;
    else if (r.source === "cite") acc.cite += 1;
    recordCountsByTaxon.set(r.taxonId, acc);
  }

  const children: Array<Paragraph | Table> = [];

  // Title page
  children.push(...titlePage(snapshot, regionLabel));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Abstract + Introduction placeholders
  children.push(h2("Abstract"));
  children.push(placeholder("Replace this with the abstract."));
  children.push(h2("Introduction"));
  children.push(placeholder("Replace this with the introduction."));

  // Methods
  children.push(...methodsSection(snapshot, regionLabel));

  // Resolve project-scoped region geometry once; every species map renders
  // against the same extent (matches the website's RegionChoropleth).
  const topology = regionGeometryFor(snapshot.project.regionCodes);
  const outlines = regionOutlinesFor(snapshot.project.regionCodes);

  // Bucket dates per taxon for phenology figures.
  const datesByTaxon = new Map<string, Array<string | null>>();
  for (const r of snapshot.records) {
    if (r.status === "rejected") continue;
    const arr = datesByTaxon.get(r.taxonId) ?? [];
    arr.push(r.observedAt);
    datesByTaxon.set(r.taxonId, arr);
  }

  // Pre-rasterize all species PNGs (maps + phenology) in parallel. Phenology
  // jobs are tagged with a "phenology:" prefix to avoid colliding with map
  // jobs when both write into the same buffer cache.
  const mapJobs = includedTaxa.map((t) => ({
    id: t.id,
    svg: buildSpeciesSvg({
      taxon: t,
      presence: presenceByTaxon.get(t.id) ?? {},
      citeOnly: citeOnlyByTaxon.get(t.id) ?? new Set<string>(),
      topology,
      outlines,
    }),
  }));
  const phenologyJobs = includedTaxa
    .map((t) => {
      const dates = datesByTaxon.get(t.id) ?? [];
      const counts = bucketByMonth(dates);
      if (counts.every((c) => c === 0)) return null;
      return {
        id: `phenology:${t.id}`,
        svg: buildPhenologySvg({ taxon: t, counts, yearRange: dateRangeOf(dates) }),
      };
    })
    .filter((x): x is { id: string; svg: string } => x !== null);
  const pngByJobId = await rasterizeAllInParallel(
    [...mapJobs, ...phenologyJobs],
    MAP_PIXEL_WIDTH,
  );
  const pngByTaxonId = new Map<string, Buffer>();
  const phenologyPngByTaxonId = new Map<string, Buffer>();
  for (const [k, v] of pngByJobId) {
    if (k.startsWith("phenology:")) {
      phenologyPngByTaxonId.set(k.slice("phenology:".length), v);
    } else {
      pngByTaxonId.set(k, v);
    }
  }

  // Results — checklist (alphabetical within each family) then species accounts
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h2("Results"));
  children.push(h3("Checklist"));
  children.push(...checklistByFamily(includedTaxa));
  children.push(h3("Species accounts"));
  let figureIndex = 1;
  for (const taxon of includedTaxa) {
    const presence = presenceByTaxon.get(taxon.id) ?? {};
    const png = pngByTaxonId.get(taxon.id);
    if (!png) continue;
    const counts =
      recordCountsByTaxon.get(taxon.id) ?? { total: 0, gbif: 0, inat: 0, cite: 0 };
    const phenologyPng = phenologyPngByTaxonId.get(taxon.id) ?? null;
    children.push(
      ...speciesAccount(
        taxon,
        presence,
        png,
        counts,
        figureIndex,
        phenologyPng,
      ),
    );
    figureIndex += phenologyPng ? 2 : 1;
  }

  // Discussion placeholder
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h2("Discussion"));
  children.push(placeholder("Replace this with the discussion."));

  // References — cite-only entries
  children.push(h2("References"));
  const citeRecords = snapshot.records.filter((r) => r.source === "cite");
  if (citeRecords.length === 0) {
    children.push(body("(No cited literature in this checklist.)"));
  } else {
    for (const r of citeRecords) {
      const cite = [r.citation, r.doi ? `https://doi.org/${r.doi}` : null]
        .filter(Boolean)
        .join(" — ");
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: cite, color: TEXT_600, size: 22 })],
        }),
      );
    }
  }

  // S1 + S2
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h2("Supplement S1. Cite-only records"));
  const s1 = citeOnlyTable(snapshot);
  if (s1) children.push(s1);
  else children.push(body("No cite-only records in this project."));

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(h2("Supplement S2. Taxonomic conflicts"));
  const s2 = conflictsTable(snapshot);
  if (s2) children.push(s2);
  else children.push(body("No taxonomic conflicts were detected."));

  const doc = new Document({
    creator: snapshot.members.find((m) => m.role === "Lead")?.user.displayName ??
      "Checklist Builder",
    title: snapshot.project.name,
    description: `Manuscript draft generated from snapshot ${snapshot.snapshotId}`,
    styles: {
      default: {
        document: { run: { font: "Lato" } },
      },
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBuffer(doc);
  return Buffer.from(blob);
}

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function plural(n: number, singular: string): string {
  if (n === 1) return singular;
  if (singular === "county") return "counties";
  return `${singular}s`;
}

function precisionMeters(dp: number): number {
  // 1 decimal degree ≈ 111 km at the equator. Each dp = ÷10.
  return Math.round(111_000 / 10 ** dp);
}

function taxonScope(name: string, rank: string): string {
  const r = rank.toLowerCase();
  if (r === "family" || r === "subfamily" || r === "order" || r === "class")
    return `the ${r} ${name}`;
  return `${name}`;
}
