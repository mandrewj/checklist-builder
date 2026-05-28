# Exports

Five formats. All are generated **against an immutable snapshot** identified by `projects.locked_snapshot_id`; nothing exports against a live project. The pipeline is a single server function (`lib/exports/generate.ts`) dispatched on `format`.

## Snapshot model

When the Lead clicks **Lock for export**:

1. `lockProject(id)` sets `projects.locked_at` and generates `projects.locked_snapshot_id` (cuid prefixed `ss_`).
2. We do **not** copy rows. The snapshot id is just a label; all writes are blocked by `requireUnlocked` while `locked_at IS NOT NULL`. Reading is a normal query.
3. Unlock invalidates **pending** export jobs only; existing `export_artifacts` rows keep their `snapshot_id` so anyone who downloaded a file before unlock still has consistent provenance.

## DOCX — manuscript draft

File: `lib/exports/docx.ts`. Built with **`docx`** (microsoft/docx) — same library Microsoft Word uses in `.docx` round-trips.

### Section structure

```
1. Title page
   - Project name (h1, blue-800)
   - Subtitle: taxon · region · date range
   - Authors (placeholder: pulled from project members; Lead first)
   - Snapshot id and generation timestamp (footer)

2. Abstract (placeholder)
   <empty 12-pt text frame>

3. Introduction (placeholder)
   <empty 12-pt text frame, helper italic prompt above:
    "Replace this with your introduction. The next section is auto-generated.">

4. Methods
   4.1 Data sources
        - GBIF Occurrence API (last sync date, n records retrieved)
        - iNaturalist API v1 (last sync, quality grade, n)
        - Manual cite-only records (n, citations listed in §S1)
   4.2 Region
        - States/provinces, n counties total
   4.3 Ingest filters
        - Date range, basis of record, coordinate precision, etc.
   4.4 Reverse geocoding (boilerplate)
   4.5 Taxonomic backbone (sentence per resolved conflict)
   4.6 Inclusion criteria (boilerplate; user-edited)

5. Results
   5.1 Species accounts (one per included species; see below)
   5.2 Composite map (small-multiples 4×3 per page)

6. Discussion (placeholder)

7. References
   - All cite-only entries
   - Plus a standing reference to GBIF.org (with DOI from the download)

S1. Cite-only records (table: species | county | citation | DOI)
S2. Taxonomic conflicts (table: GBIF name | iNat name | resolution | resolver | timestamp)
```

### Species account block

For each species where `taxa.included = 'include'`:

```
[H2, italic, blue-800] Alobates pennsylvanicus (DeGeer, 1775)
[regular] Family: Tenebrionidae · GBIF taxonKey 4734451 · iNat taxon_id 127344

[image, inline] – the species' county distribution map (SVG embedded as PNG at 300 dpi)
[caption, 10 pt] Figure N. Distribution of Alobates pennsylvanicus in Indiana. Cells indicate counties with at least one record; shade encodes record count (viridis).

[regular] Records: 612 across 78 counties. Sources: GBIF (470), iNat (140), manual/cite (2). Inclusion reasoning: <as entered by user>.
```

The text is built via `docx`'s `Paragraph`/`TextRun` API. Maps are embedded as PNGs (see below), not SVG, because Word's SVG support is uneven.

### Font

Lato everywhere. The `.docx` ships with the font referenced; users on machines without Lato see Calibri (Word fallback). We considered embedding Lato in the file but it bloats from ~2 MB → ~9 MB. Out of scope for MVP.

---

## CSV — species checklist

File: `lib/exports/csv.ts`. UTF-8, RFC 4180 quoting, LF line endings.

### Columns (in order)

| # | Column | Notes |
|---|---|---|
| 1 | `scientific_name` | from `taxa.scientific_name` (resolved name if a conflict was merged) |
| 2 | `authority` | |
| 3 | `family` | derived from GBIF backbone or `manual` if user-added |
| 4 | `rank` | usually `species` |
| 5 | `sources` | semicolon-separated: `gbif;inat` |
| 6 | `gbif_taxon_key` | nullable |
| 7 | `inat_taxon_id` | nullable |
| 8 | `n_records_accepted` | accepted records only |
| 9 | `n_records_rejected` | |
| 10 | `n_counties_present` | from county_presence |
| 11 | `county_fips_list` | semicolon-separated FIPS codes |
| 12 | `inclusion` | always `include` (we never export `exclude` rows; configurable in future) |
| 13 | `inclusion_reasoning` | user-entered |
| 14 | `has_cite_only` | bool |
| 15 | `taxonomic_notes` | if a conflict was resolved, the chosen resolution is appended here |
| 16 | `last_updated` | iso timestamp |

Excluded and undecided species are **not** included by default. A future "full state" export will live as a separate format.

---

## Distribution maps — SVG + PNG + PDF

File: `lib/exports/maps.ts`.

For each species where `taxa.included='include'`:

1. **SVG**: render `<CountyChoropleth size="print"/>` server-side via `react-dom/server`'s `renderToStaticMarkup` into a self-contained SVG file (no external CSS — fonts and colors inlined as attributes). Output: `maps/{slug}.svg`.
2. **PNG @ 300 dpi**: use `sharp` to rasterize the SVG at `8.5 × 11 in × 300 dpi = 2550 × 3300 px`. Output: `maps/{slug}.png`.
3. **PDF**: use `pdf-lib` to embed the PNG into a single-page letter-sized PDF. Output: `maps/{slug}.pdf`.

**Composite small-multiples**:

- Lay 12 species maps per page in a 4×3 grid using `pdf-lib`.
- Each panel has the species name above and the same projection / county outlines.
- Output: `composite.pdf`.

All four artifacts (per-species SVG, PNG, PDF + composite) are bundled into `maps.zip` and uploaded as a single blob.

### Single source of truth

`<CountyChoropleth/>` is the **same** React component the on-screen view uses. The export path imports it from `components/insectid/county-choropleth` and renders it on the server. No second implementation.

---

## Darwin Core Archive (DwC-A)

File: `lib/exports/dwc.ts`. A standards-compliant zip suitable for republishing to a GBIF data publisher (in practice, the user would deposit via their institution's IPT instance — we just produce the archive).

### Contents

```
occurrence.txt           ← tab-separated; one row per accepted occurrence record
verbatim.txt             ← original GBIF/iNat fields (from records.raw)
meta.xml                 ← DwC mapping
eml.xml                  ← project metadata (name, description, region, contact)
```

`occurrence.txt` columns (Darwin Core terms): `occurrenceID, basisOfRecord, scientificName, scientificNameAuthorship, taxonRank, decimalLatitude, decimalLongitude, country, stateProvince, county, eventDate, recordedBy, identifiedBy, references`.

Cite-only records are emitted with `basisOfRecord=LITERATURE` and the citation in `references`.

`eml.xml` is generated from a template with project fields interpolated. Resource license defaults to **CC0-1.0** (DwC norm) — exposed as a settings toggle in a future iteration; flagged in `OPEN_QUESTIONS.md`.

---

## JSON snapshot

File: `lib/exports/json.ts`. A full snapshot of the project state suitable for replay or programmatic analysis.

```json
{
  "snapshot": { "id": "ss_p1_240525", "generatedAt": "...", "generatedBy": "u1" },
  "project": { ... projects row ... },
  "members": [ ... ],
  "taxa": [ ... ],
  "records": [ ... ],
  "county_presence": [ ... ],
  "taxon_conflicts": [ ... ],
  "manual_entries": [ ... ],
  "comments": [ ... ],
  "activity_log": [ ... ]    // append-only, oldest first
}
```

Streamed via `Response` with `Content-Type: application/json`; written to Blob.

---

## Generation pipeline

```ts
// lib/exports/generate.ts
export async function generateExport(projectId: string, format: ExportFormat, userId: string) {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project?.lockedSnapshotId) throw new Error("Project not locked");

  const snapshot = await loadSnapshot(projectId);  // single big read transaction

  const blob = await ({
    docx: buildDocx,
    csv:  buildCsv,
    maps: buildMaps,
    dwc:  buildDwc,
    json: buildJson,
  }[format])(snapshot);

  const { url, pathname } = await put(
    `${projectId}/snapshots/${project.lockedSnapshotId}/${format}.${extOf(format)}`,
    blob, { access: 'public' }
  );

  await db.insert(exportArtifacts).values({
    projectId, snapshotId: project.lockedSnapshotId, format,
    blobUrl: url, bytes: blob.size, generatedBy: userId,
  });

  return { ok: true, url };
}
```

All five formats finish under Vercel's 60 s function limit for the scale targets (50 species, 5 000 records). The `maps` format is the heaviest at ~8 s end-to-end; we run species rasterization in parallel with `Promise.all` capped at 4 concurrent `sharp` invocations.

If a format ever exceeds the limit (larger projects), the right move is **Vercel Workflow DevKit** with one step per artifact. Punted; called out in `OPEN_QUESTIONS.md`.
