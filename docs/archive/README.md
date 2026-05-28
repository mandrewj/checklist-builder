# InsectID Checklist — README

> One-page product summary. Pair with `ARCHITECTURE.md` for system design.

**Affiliation**: built for the [Insect Diversity & Diagnostics Lab](https://entomology.purdue.edu/), Department of Entomology, Purdue University.

**Reference dataset for development** (the seed data the prototype ships with): _Tenebrionidae of Indiana (2018–2024)_ — 23 candidate darkling-beetle species across all 92 Indiana counties, with 3 unresolved GBIF↔iNat conflicts and 2 cite-only literature records. Build against this dataset when standing the app up locally.

## What it is

A web tool for building **regional species checklists** of a chosen insect group, by aggregating GBIF + iNaturalist occurrence data into a per-species, per-county presence grid and guiding the user through verification, conflict resolution, and export of a **publication-ready manuscript pack**.

The output is files the user downloads and uses in a paper — there is no "publish" state, no public-facing index, no observation-sharing surface.

## Primary user

A working **research entomologist** in a biodiversity lab, building a regional checklist for journal publication. Familiar with their taxa and frustrated by tools that hide automation. The product is desktop-only (≥1280px assumed) and used in long focused sessions of triage.

## MVP scope (this codebase)

1. **Auth** via Clerk; per-project membership with 3 roles (Lead / Contributor / Reviewer).
2. **Project setup wizard**: name → taxon (GBIF + iNat autocomplete, no canonical) → region (US states + Canadian provinces) → ingest filters → run ingest.
3. **Ingest** of GBIF + iNat occurrence data, with persisted per-source cursor, polite rate limits, dedup, and reverse-geocoding to county FIPS.
4. **Checklist** — species-level data table with inclusion state, conflict flag, county-presence sparkline, bulk actions.
5. **Species detail** — large county choropleth (viridis or binary), record list, taxonomy panel (GBIF/iNat side-by-side), comment thread, include/exclude decision with reasoning.
6. **Record triage** — keyboard-driven per-record view (J/K nav, A/R/F/C actions) with image, locality, source, status.
7. **Conflicts** — GBIF↔iNat name disagreements. Four resolution choices; **no default pre-selected**.
8. **Manual / cite-only records** — augment the dataset with literature records. Taxon autocomplete extends the project's taxa.
9. **Activity log** — append-only audit of every state-changing action.
10. **Members** — invite, role, remove. Lead-only.
11. **Lock for export** — creates an immutable snapshot. Generates DOCX, CSV, SVG/PNG/PDF maps, Darwin Core Archive, JSON.
12. **Settings** — name, description, region, ingest filters, re-run ingest (destructive, with diff), delete.

## Out of scope (for MVP)

- Mobile / narrow-viewport triage (dashboard + overview only need to be graceful narrow).
- Public-facing checklist URLs.
- Real-time multi-cursor co-editing (we ship optimistic mutations + activity log conflicts on lock).
- Structured CSL-JSON citation parsing (free text for now; flagged in `OPEN_QUESTIONS.md`).
- Custom basemaps; we ship one static county/cd cartogram from bundled topojson.
- Image upload to project (we hot-link iNat thumbnails in MVP; flagged for revisit).

## Scale targets

| Dimension | Typical | Hard target |
|---|---|---|
| Species per project | 5–30 | ≤50 |
| Occurrence records per project | ~3,000 | ≤5,000 |
| Counties in active region | <100 | ≤200 |
| Collaborators per project | 2–8 | 8 |

A project's full dataset fits in browser memory. Tables render without virtualization up to ~500 rows; above that, shadcn `DataTable` + TanStack virtualization.

## How to run

```bash
pnpm install
pnpm exec drizzle-kit push
pnpm dev          # http://localhost:3000
```

Required env vars are auto-provisioned by Vercel Marketplace for Clerk and Neon. See `INTEGRATIONS.md` for the manual set.

## File map

- `app/` — Next.js App Router routes (see `ROUTES.md`).
- `components/` — UI components, mostly shadcn-derived (`COMPONENTS.md`).
- `lib/db/` — Drizzle schema (`SCHEMA.md`).
- `lib/sources/gbif.ts`, `lib/sources/inat.ts` — external API adapters (`INTEGRATIONS.md`).
- `lib/exports/` — DOCX, CSV, SVG, DwC-A pipelines (`EXPORTS.md`).
- `lib/jobs/` — ingest jobs (Vercel Cron-driven).
- `public/topojson/` — bundled US counties + Canada census divisions.

## Quality bar

- Lato everywhere, headings in `blue-800`, primary actions in `blue-600`, visible focus rings on every interactive element.
- Every record visibly attributed to a source; every name visibly attributed to a backbone.
- Every state change in the activity log; activity log is append-only.
- Keyboard-driven triage; help overlay on `?`.
- Maps are publication-ready: viridis ramp, counties outside region clearly de-emphasized, exportable as SVG/PNG/PDF.
- WCAG AA contrast; ARIA on choropleth (sr-only county-presence summary).

## Non-negotiables

- No tiled basemaps. Static SVG choropleth only.
- No silent automation. Every system-inferred decision is badged and overridable.
- No canonical taxonomy. GBIF and iNat names coexist until the user resolves them.
- Categorical = Okabe-Ito. Sequential = viridis. No substitutions.
- Body text is `text-600` (`#1F2222`), never pure black. Backgrounds are white or near-white; no warm tints.
