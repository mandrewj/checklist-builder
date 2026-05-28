/**
 * Darwin Core Archive (DwC-A) export.
 *
 * Produces a zip containing:
 *   - occurrence.txt — TSV, one row per accepted record, DwC terms
 *   - meta.xml       — DwC mapping descriptor
 *   - eml.xml        — project metadata (name, description, region, license)
 *
 * Suitable for deposit at a GBIF data publisher's IPT. Cite-only records
 * use basisOfRecord=LITERATURE with the citation in `references`.
 */

import JSZip from "jszip";
import { canonicalize } from "@/lib/insectid/canonicalize";
import { countyName, regionDescriptor } from "@/lib/insectid/regions";
import type { ProjectSnapshot } from "./snapshot";
import type { RecordRow, TaxonRow } from "@/lib/db/schema";

// Field order documented in EXPORTS.md §"Darwin Core Archive".
const FIELDS = [
  "occurrenceID",
  "basisOfRecord",
  "scientificName",
  "scientificNameAuthorship",
  "taxonRank",
  "family",
  "decimalLatitude",
  "decimalLongitude",
  "country",
  "stateProvince",
  "county",
  "eventDate",
  "recordedBy",
  "identifiedBy",
  "references",
] as const;

type DwcRow = Record<(typeof FIELDS)[number], string>;

const DEFAULT_LICENSE = "CC0-1.0";

function escapeTsv(v: string): string {
  // Per RFC 4180-ish for TSV: replace literal tabs/newlines/CR with spaces.
  return v.replace(/[\t\r\n]+/g, " ");
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    })[c]!,
  );
}

function dwcBasisOfRecord(r: RecordRow): string {
  if (r.source === "cite") return "LITERATURE";
  // GBIF basisOfRecord travels in records.raw which is no longer persisted,
  // so we map source → most-common DwC term. The actual original basis lives
  // on gbif.org per externalId for any record that needs it.
  if (r.source === "gbif") return "OCCURRENCE";
  if (r.source === "inat") return "HUMAN_OBSERVATION";
  return "OCCURRENCE";
}

function externalUrl(r: RecordRow): string {
  if (!r.externalId) return r.doi ? `https://doi.org/${r.doi}` : "";
  if (r.source === "gbif") {
    const key = r.externalId.replace(/^GBIF:/, "");
    return `https://www.gbif.org/occurrence/${key}`;
  }
  if (r.source === "inat") {
    const id = r.externalId.replace(/^iNat:/, "");
    return `https://www.inaturalist.org/observations/${id}`;
  }
  if (r.source === "cite" && r.doi) return `https://doi.org/${r.doi}`;
  return "";
}

function buildOccurrenceTsv(
  snapshot: ProjectSnapshot,
  countryByCode: Map<string, string>,
): string {
  const taxaById = new Map<string, TaxonRow>(
    snapshot.taxa.map((t) => [t.id, t]),
  );

  // Header row.
  const lines: string[] = [FIELDS.join("\t")];

  for (const r of snapshot.records) {
    if (r.status === "rejected") continue;
    const taxon = taxaById.get(r.taxonId);
    if (!taxon) continue;

    // Authorship: prefer the stored column; fall back to the parsed split of
    // the canonical name if the stored value is missing.
    const { authority: parsedAuthority } = canonicalize(
      `${taxon.scientificName} ${taxon.authority ?? ""}`,
    );
    const authority = taxon.authority ?? parsedAuthority ?? "";

    const stateCode = r.stateCode ?? "";
    const country = countryByCode.get(stateCode.slice(0, 2)) ?? "";
    const stateProvince =
      regionDescriptor(stateCode)?.name ?? stateCode.slice(3) ?? "";

    const row: DwcRow = {
      occurrenceID: r.externalId ?? r.id,
      basisOfRecord: dwcBasisOfRecord(r),
      scientificName: taxon.scientificName,
      scientificNameAuthorship: authority,
      taxonRank: taxon.rank,
      family: taxon.family ?? "",
      decimalLatitude: r.lat?.toString() ?? "",
      decimalLongitude: r.lng?.toString() ?? "",
      country,
      stateProvince,
      county: countyName(r.countyFips) ?? "",
      eventDate: r.observedAt ?? "",
      recordedBy: r.collector ?? "",
      identifiedBy: "",
      references: r.source === "cite"
        ? (r.citation ?? externalUrl(r))
        : externalUrl(r),
    };

    lines.push(FIELDS.map((f) => escapeTsv(row[f] ?? "")).join("\t"));
  }

  return lines.join("\n") + "\n";
}

function buildMetaXml(): string {
  const fieldDefs = FIELDS.map((f, i) => {
    // Map a few non-DwC names to the right xmlns + term.
    let term: string;
    switch (f) {
      case "occurrenceID":
      case "basisOfRecord":
      case "scientificName":
      case "scientificNameAuthorship":
      case "taxonRank":
      case "family":
      case "decimalLatitude":
      case "decimalLongitude":
      case "country":
      case "stateProvince":
      case "county":
      case "eventDate":
      case "recordedBy":
      case "identifiedBy":
        term = `http://rs.tdwg.org/dwc/terms/${f}`;
        break;
      case "references":
        term = `http://purl.org/dc/terms/references`;
        break;
    }
    return `    <field index="${i}" term="${term}"/>`;
  }).join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<archive xmlns="http://rs.tdwg.org/dwc/text/" metadata="eml.xml">`,
    `  <core rowType="http://rs.tdwg.org/dwc/terms/Occurrence" encoding="UTF-8" linesTerminatedBy="\\n" fieldsTerminatedBy="\\t" fieldsEnclosedBy="" ignoreHeaderLines="1">`,
    `    <files><location>occurrence.txt</location></files>`,
    `    <id index="0"/>`,
    fieldDefs,
    `  </core>`,
    `</archive>`,
  ].join("\n");
}

function buildEmlXml(snapshot: ProjectSnapshot, regionLabel: string): string {
  const p = snapshot.project;
  const lead = snapshot.members.find((m) => m.role === "Lead")?.user;
  const generatedAt = snapshot.generatedAt.toISOString();
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<eml:eml xmlns:eml="https://eml.ecoinformatics.org/eml-2.2.0"`,
    `         xmlns:dc="http://purl.org/dc/terms/"`,
    `         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
    `         packageId="${escapeXml(snapshot.snapshotId)}"`,
    `         system="checklist-builder"`,
    `         scope="system"`,
    `         xml:lang="en">`,
    `  <dataset>`,
    `    <title xml:lang="en">${escapeXml(p.name)}</title>`,
    lead
      ? `    <creator>
      <individualName><givenName>${escapeXml(lead.displayName)}</givenName></individualName>
      <electronicMailAddress>${escapeXml(lead.email)}</electronicMailAddress>
    </creator>`
      : `    <creator><individualName><givenName>Checklist Builder</givenName></individualName></creator>`,
    `    <pubDate>${generatedAt.slice(0, 10)}</pubDate>`,
    `    <language>en</language>`,
    `    <abstract><para>${escapeXml(p.description || "Regional species checklist.")}</para></abstract>`,
    `    <intellectualRights><para>This work is licensed under ${DEFAULT_LICENSE}.</para></intellectualRights>`,
    `    <coverage>`,
    `      <geographicCoverage>`,
    `        <geographicDescription>${escapeXml(regionLabel)}</geographicDescription>`,
    `        <boundingCoordinates>`,
    `          <westBoundingCoordinate>-180</westBoundingCoordinate>`,
    `          <eastBoundingCoordinate>180</eastBoundingCoordinate>`,
    `          <northBoundingCoordinate>90</northBoundingCoordinate>`,
    `          <southBoundingCoordinate>-90</southBoundingCoordinate>`,
    `        </boundingCoordinates>`,
    `      </geographicCoverage>`,
    `      <temporalCoverage>`,
    `        <rangeOfDates>`,
    `          <beginDate><calendarDate>${p.ingestFilters.yearStart}-01-01</calendarDate></beginDate>`,
    `          <endDate><calendarDate>${p.ingestFilters.yearEnd}-12-31</calendarDate></endDate>`,
    `        </rangeOfDates>`,
    `      </temporalCoverage>`,
    `      <taxonomicCoverage>`,
    `        <taxonomicClassification>`,
    `          <taxonRankName>${escapeXml(p.taxonQuery.rank)}</taxonRankName>`,
    `          <taxonRankValue>${escapeXml(p.taxonQuery.name)}</taxonRankValue>`,
    `        </taxonomicClassification>`,
    `      </taxonomicCoverage>`,
    `    </coverage>`,
    `  </dataset>`,
    `  <additionalMetadata><metadata>`,
    `    <generated>${generatedAt}</generated>`,
    `    <snapshotId>${escapeXml(snapshot.snapshotId)}</snapshotId>`,
    `  </metadata></additionalMetadata>`,
    `</eml:eml>`,
  ].join("\n");
}

export async function buildDwcExport(
  snapshot: ProjectSnapshot,
): Promise<Buffer> {
  // FIPS state-prefix → ISO 3166-1 alpha-2. Currently only US and CA in scope.
  const countryByCode = new Map<string, string>([
    ["US", "US"],
    ["CA", "CA"],
  ]);

  const regionLabel =
    snapshot.project.regionCodes
      .map((c) => regionDescriptor(c)?.name ?? c)
      .join(", ") || snapshot.project.regionCodes.join(", ");

  const zip = new JSZip();
  zip.file("occurrence.txt", buildOccurrenceTsv(snapshot, countryByCode));
  zip.file("meta.xml", buildMetaXml());
  zip.file("eml.xml", buildEmlXml(snapshot, regionLabel));

  // Tiny README aimed at humans, not the IPT importer.
  zip.file(
    "README.txt",
    [
      `Darwin Core Archive for "${snapshot.project.name}"`,
      `Snapshot ${snapshot.snapshotId}`,
      `Generated ${snapshot.generatedAt.toISOString()}`,
      ``,
      `Contents:`,
      `  occurrence.txt — accepted occurrence records (DwC terms, tab-separated)`,
      `  meta.xml       — DwC mapping descriptor`,
      `  eml.xml        — project metadata`,
      ``,
      `License: ${DEFAULT_LICENSE} (default; configurable in a future iteration)`,
      ``,
      `For IPT deposit, upload the whole archive to your institution's IPT`,
      `instance. For programmatic use, the field order in occurrence.txt`,
      `matches the <field index="N"/> declarations in meta.xml.`,
    ].join("\n"),
  );

  return zip.generateAsync({ type: "nodebuffer" });
}
