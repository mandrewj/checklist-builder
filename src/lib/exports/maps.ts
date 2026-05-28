/**
 * Per-species map export — SVG + PNG + per-species PDF + composite PDF,
 * bundled into maps.zip alongside a manifest.
 *
 * Layout per EXPORTS.md §"Distribution maps":
 *   maps/<slug>.svg      — self-contained SVG (no external CSS, fonts inlined)
 *   maps/<slug>.png      — 300 dpi raster
 *   maps/<slug>.pdf      — single-page letter PDF with the PNG embedded
 *   composite.pdf        — 4×3 grid small-multiples (12 species/page)
 *   manifest.json        — file listing + counts
 *
 * Sharp is parallelized at 4 concurrent rasterizations.
 *
 * Inclusion filter: everything except explicitly-excluded taxa.
 */

import JSZip from "jszip";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildSpeciesSvg, slugify } from "./species-svg";
import { buildPhenologySvg, bucketByMonth, dateRangeOf } from "./phenology-svg";
import { regionGeometryFor, regionOutlinesFor } from "./region-geometry";
import type { ProjectSnapshot } from "./snapshot";
import type { TaxonRow } from "@/lib/db/schema";

const RASTER_WIDTH_PX = 2550; // 8.5" × 300 dpi
const RASTER_HEIGHT_PX = Math.round(
  (RASTER_WIDTH_PX * 700) / 900, // SPECIES_SVG_DIMENSIONS aspect ratio
);

const PAGE_W = 612; // letter, points
const PAGE_H = 792;
const PAGE_MARGIN = 36;

const RASTER_CONCURRENCY = 4;

interface SpeciesArtifact {
  taxon: Pick<TaxonRow, "id" | "scientificName" | "authority">;
  slug: string;
  svg: string;
  png: Buffer;
  phenologySvg: string | null;
  phenologyPng: Buffer | null;
}

async function rasterize(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize({ width: RASTER_WIDTH_PX })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

async function rasterizeAllInParallel(
  jobs: ReadonlyArray<{ id: string; svg: string }>,
): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const i = cursor++;
      const job = jobs[i];
      const png = await rasterize(job.svg);
      out.set(job.id, png);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(RASTER_CONCURRENCY, jobs.length) },
      worker,
    ),
  );
  return out;
}

/** Build a single-page letter PDF with the species PNG centered + a title. */
async function buildSingleSpeciesPdf(
  artifact: SpeciesArtifact,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const titleY = PAGE_H - PAGE_MARGIN - 18;
  page.drawText(artifact.taxon.scientificName, {
    x: PAGE_MARGIN,
    y: titleY,
    size: 18,
    font: italicFont,
    color: rgb(0.039, 0.247, 0.584), // blue-800
  });
  if (artifact.taxon.authority) {
    page.drawText(artifact.taxon.authority, {
      x: PAGE_MARGIN,
      y: titleY - 16,
      size: 10,
      font,
      color: rgb(0.373, 0.388, 0.376), // text-400
    });
  }

  const img = await pdf.embedPng(artifact.png);
  const availableW = PAGE_W - 2 * PAGE_MARGIN;
  const availableH = titleY - 16 - PAGE_MARGIN - 24;
  const scale = Math.min(availableW / img.width, availableH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  page.drawImage(img, {
    x: (PAGE_W - drawW) / 2,
    y: PAGE_MARGIN + 12,
    width: drawW,
    height: drawH,
  });

  page.drawText(
    `Cells indicate counties with >= 1 record. Shade = record count (viridis).`,
    {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN - 4,
      size: 8,
      font,
      color: rgb(0.373, 0.388, 0.376),
    },
  );

  return pdf.save();
}

/** Composite small-multiples PDF: 4 columns × 3 rows = 12 species per page. */
async function buildCompositePdf(
  artifacts: ReadonlyArray<SpeciesArtifact>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const italicFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const cols = 4;
  const rows = 3;
  const perPage = cols * rows;

  for (let pageIdx = 0; pageIdx < Math.ceil(artifacts.length / perPage); pageIdx++) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const cellW = (PAGE_W - 2 * PAGE_MARGIN) / cols;
    const cellH = (PAGE_H - 2 * PAGE_MARGIN) / rows;

    for (let i = 0; i < perPage; i++) {
      const idx = pageIdx * perPage + i;
      if (idx >= artifacts.length) break;
      const artifact = artifacts[idx];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = PAGE_MARGIN + col * cellW;
      const cellY = PAGE_H - PAGE_MARGIN - (row + 1) * cellH;

      const img = await pdf.embedPng(artifact.png);
      const labelH = 14;
      const imgAvailW = cellW - 6;
      const imgAvailH = cellH - labelH - 6;
      const scale = Math.min(imgAvailW / img.width, imgAvailH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      page.drawImage(img, {
        x: cellX + (cellW - drawW) / 2,
        y: cellY + labelH + 3,
        width: drawW,
        height: drawH,
      });

      const labelText = artifact.taxon.scientificName;
      page.drawText(labelText.length > 28 ? labelText.slice(0, 25) + "..." : labelText, {
        x: cellX + 3,
        y: cellY + 2,
        size: 8,
        font: italicFont,
        color: rgb(0.039, 0.247, 0.584),
      });
    }
  }

  return pdf.save();
}

export async function buildMapsExport(
  snapshot: ProjectSnapshot,
): Promise<Buffer> {
  const includedTaxa = snapshot.taxa
    .filter((t) => t.included !== "exclude")
    .sort((a, b) => a.scientificName.localeCompare(b.scientificName));

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

  // Resolve the project's region geometry once; every species' map renders
  // against the same extent (matches the website's RegionChoropleth).
  const topology = regionGeometryFor(snapshot.project.regionCodes);
  const outlines = regionOutlinesFor(snapshot.project.regionCodes);

  // Bucket records by taxon → month for phenology.
  const datesByTaxon = new Map<string, Array<string | null>>();
  for (const r of snapshot.records) {
    if (r.status === "rejected") continue;
    const arr = datesByTaxon.get(r.taxonId) ?? [];
    arr.push(r.observedAt);
    datesByTaxon.set(r.taxonId, arr);
  }

  const svgs = includedTaxa.map((t) => ({
    id: t.id,
    svg: buildSpeciesSvg({
      taxon: t,
      presence: presenceByTaxon.get(t.id) ?? {},
      citeOnly: citeOnlyByTaxon.get(t.id) ?? new Set<string>(),
      topology,
      outlines,
    }),
  }));
  const phenologySvgs = includedTaxa
    .map((t) => {
      const dates = datesByTaxon.get(t.id) ?? [];
      const counts = bucketByMonth(dates);
      if (counts.every((c) => c === 0)) return null;
      return {
        id: t.id,
        svg: buildPhenologySvg({
          taxon: t,
          counts,
          yearRange: dateRangeOf(dates),
        }),
      };
    })
    .filter((x): x is { id: string; svg: string } => x !== null);

  // Tag phenology jobs so they don't collide with species map ids.
  const allJobs: Array<{ id: string; svg: string }> = [
    ...svgs,
    ...phenologySvgs.map((p) => ({ id: `phenology:${p.id}`, svg: p.svg })),
  ];
  const pngByJobId = await rasterizeAllInParallel(allJobs);

  const artifacts: SpeciesArtifact[] = includedTaxa.map((t) => {
    const png = pngByJobId.get(t.id);
    if (!png) throw new Error(`missing PNG for taxon ${t.id}`);
    const phenoSvg = phenologySvgs.find((p) => p.id === t.id)?.svg ?? null;
    const phenoPng = pngByJobId.get(`phenology:${t.id}`) ?? null;
    return {
      taxon: { id: t.id, scientificName: t.scientificName, authority: t.authority },
      slug: slugify(t.scientificName),
      svg: svgs.find((s) => s.id === t.id)!.svg,
      png,
      phenologySvg: phenoSvg,
      phenologyPng: phenoPng,
    };
  });

  const perSpeciesPdfs = await Promise.all(
    artifacts.map(async (a) => ({
      slug: a.slug,
      pdf: await buildSingleSpeciesPdf(a),
    })),
  );
  const compositePdf =
    artifacts.length > 0 ? await buildCompositePdf(artifacts) : null;

  const zip = new JSZip();
  for (const a of artifacts) {
    zip.file(`maps/${a.slug}.svg`, a.svg);
    zip.file(`maps/${a.slug}.png`, a.png);
    if (a.phenologySvg && a.phenologyPng) {
      zip.file(`phenology/${a.slug}.svg`, a.phenologySvg);
      zip.file(`phenology/${a.slug}.png`, a.phenologyPng);
    }
  }
  for (const p of perSpeciesPdfs) {
    zip.file(`maps/${p.slug}.pdf`, p.pdf);
  }
  if (compositePdf) {
    zip.file("composite.pdf", compositePdf);
  }

  const manifestFiles: string[] = [];
  for (const t of includedTaxa) {
    const slug = slugify(t.scientificName);
    manifestFiles.push(`maps/${slug}.svg`, `maps/${slug}.png`, `maps/${slug}.pdf`);
    const a = artifacts.find((x) => x.taxon.id === t.id);
    if (a?.phenologySvg) {
      manifestFiles.push(`phenology/${slug}.svg`, `phenology/${slug}.png`);
    }
  }
  if (compositePdf) manifestFiles.push("composite.pdf");

  const manifest = {
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt.toISOString(),
    counts: {
      taxa: includedTaxa.length,
      withPhenology: artifacts.filter((a) => a.phenologySvg).length,
    },
    formats: {
      svg: true,
      png: true,
      pdf: true,
      compositePdf: artifacts.length > 0,
      phenology: true,
    },
    raster: { width: RASTER_WIDTH_PX, height: RASTER_HEIGHT_PX, dpi: 300 },
    composite: { layout: "4x3", perPage: 12 },
    files: manifestFiles,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: "nodebuffer" });
}
