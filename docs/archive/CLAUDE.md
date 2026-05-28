# Start here — InsectID Checklist (handoff for Claude Code CLI)

> **Paste this file as the opening message of a Claude Code session.** It tells the agent everything it needs to scaffold the app and build against the reference dataset. The deeper-dive files (`ARCHITECTURE.md`, `SCHEMA.md`, etc.) are referenced inline and should be available in the same folder.

---

## 0. What you are building

A web tool used by a **research entomologist** to compress weeks of manual GBIF + iNaturalist scraping + map-drawing into a guided workflow that ends with a **publication-ready manuscript pack** (DOCX draft, CSV, county-distribution maps as SVG/PNG/PDF, Darwin Core Archive, JSON snapshot).

Affiliation: built for the **Insect Diversity & Diagnostics Lab**, Department of Entomology, Purdue University. **Do not** mention or imply the Illinois Natural History Survey or any other institution.

Two audiences:
- **End users** — research entomologists. Inspect every automated decision; reverse anything; trust only what's source-attributed.
- **You (Claude Code)** — implement from the specs in this folder without re-deriving design decisions.

## 1. Reference dataset — _Tenebrionidae of Indiana (2018–2024)_

Use this as the seed data for every step. It's also the dataset reviewers will spot-check against the prototype.

- **Taxon**: family `Tenebrionidae` (darkling beetles). GBIF taxonKey `7919` · iNat taxon_id `52719`.
- **Region**: Indiana (US-IN). 92 counties.
- **Date range**: 2018-01-01 → 2024-12-31.
- **Filters**: research-grade iNat + research/needs-id; basis-of-record ∈ {`HUMAN_OBSERVATION`, `PRESERVED_SPECIMEN`, `MATERIAL_SAMPLE`}; coords required; exclude cultivated/captive.
- **Expected ingest yield** (after filters): ~4,200 records across ~28 candidate species.
- **Headline species** (use in screenshots / smoke-test maps): _Alobates pennsylvanicus_ (DeGeer, 1775). GBIF `4734451` · iNat `127344`. ~612 records, 78 of 92 counties.
- **Built-in test conflicts** (these MUST surface in the Conflicts panel with no default resolution selected):
  1. GBIF `Alobates pennsylvanicus` ↔ iNat `Alobates pensylvanicus` (orthography; same concept, different spelling).
  2. GBIF `Diaperis maculata` ↔ iNat `Diaperis maculata maculata` (nominate subspecies treatment).
  3. GBIF `Hymenorus pilosus` ↔ iNat `Hymenorus niger` (Campbell 1966 synonymy, contested).
- **Built-in exclusion cases** (must export *out* of the locked checklist):
  - _Tenebrio molitor_, _Tenebrio obscurus_ — cosmopolitan synanthropic mealworms, not native fauna.
  - _Helops aereus_ — European import; iNat records are likely misidentifications.
- **Built-in cite-only records** (literature-only, no API source):
  - _Neatus tenebrioides_, Tippecanoe Co. — Blatchley (1910).
  - _Centronopus calcaratus_, Monroe Co. — Steiner & Triplehorn (2010). DOI `10.5281/zenodo.4456789`.

A fixture set with this dataset lives at `lib/seed/tenebrionidae-indiana.ts` (you'll create it; the prototype's `src/data.jsx` is a faithful JS version of what that file should produce).

## 2. The non-negotiables

These came from the design brief and are binding. Don't relax them without flagging in `OPEN_QUESTIONS.md`.

| # | Rule |
|---|---|
| 1 | **No tiled basemaps.** Static SVG county choropleth only. Same component used on-screen *and* in exports. |
| 2 | **Categorical = Okabe-Ito. Sequential = viridis.** Don't substitute. |
| 3 | **No canonical taxonomy.** GBIF and iNat names coexist until the user resolves the conflict. No default resolution is pre-selected. |
| 4 | **No silent automation.** Every system-inferred value (county from lat/lng, conflict detection, dedup) is badged and overridable. |
| 5 | **Lock-for-export creates an immutable snapshot.** Exports run against `projects.locked_snapshot_id`. Unlock invalidates pending exports only. |
| 6 | **Append-only activity log.** Undo emits a *new* entry referencing the original (`parent_id`). |
| 7 | **Lato** body + headings. Headings in `blue-800` (`#0A3F95`). Primary actions in `blue-600` (`#116dff`). Body text `text-600` (`#1F2222`) — never pure black. Backgrounds white or near-white — no warm tints. Visible focus ring on every interactive element. |
| 8 | **Desktop-first** (≥1280px assumed for the workspace). Dashboard + overview can degrade gracefully narrower. |
| 9 | **No backend service** the lab has to admin. Next.js + Server Actions + Drizzle + Neon + Vercel Blob, deployed on Vercel. |
| 10 | **Polite ingest.** ≤4 req/s GBIF, ≤2 req/s iNat. Persist cursor in `ingest_jobs`. Honor `Retry-After`. |

## 3. Stack & infra

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, latest stable), TypeScript strict |
| UI | Tailwind CSS + shadcn/ui (registry CLI) |
| Auth | Clerk (Vercel Marketplace) |
| DB | Neon Postgres (Vercel Marketplace, scale-to-zero) |
| ORM | Drizzle |
| Storage | Vercel Blob |
| Async ingest | `ingest_jobs` table polled by Vercel Cron, advanced one page per tick |
| External | GBIF Occurrence API + iNat API v1 (no keys; UA header required) |
| Topojson | Bundled at `/public/topojson/{us-counties,ca-cdivs}.json` — TIGER 2024 + StatsCan 2021 |

Detailed configuration in `ARCHITECTURE.md` (rendering strategy, transactions, performance budget, failure modes).

## 4. Build order (recommended for the Code session)

Each step ends in a working, demoable state.

1. **Scaffold.** `npx create-next-app@latest insectid-checklist --typescript --tailwind --app --src-dir`. Add shadcn (`pnpm dlx shadcn@canary init`). Pin React 18.3.1. Drop in the Tailwind tokens from `COMPONENTS.md`.
2. **Schema + seed.** `lib/db/schema/*` from `SCHEMA.md`. Generate Drizzle migrations. Implement `lib/seed/tenebrionidae-indiana.ts` and a `pnpm seed` script that empties + reseeds the dev DB.
3. **Auth + dashboard.** Wire Clerk; render the project list against the seed data.
4. **Workspace shell.** Sidebar + top bar + locked-state badge (read-only when locked).
5. **Choropleth component.** `<CountyChoropleth/>` reading from `county_presence`. Verify it renders Indiana cleanly with the headline species data.
6. **Checklist + Species detail + Triage island.** Keyboard nav, source attribution, inclusion decision. Verify Flow B (reject 12 likely-out-of-range records) works.
7. **Conflicts.** Render the 3 seeded conflicts. No default resolution. Verify Flow C.
8. **Manual entries.** Seeded with 2 cite-only records. Add-cite-only sheet. Verify Flow D.
9. **Activity log + Members.**
10. **Lock + Exports.** Generate the five formats from the snapshot. Verify Flow E.
11. **Polish + accessibility pass.** WCAG AA contrast, ARIA on the choropleth, keyboard help overlay on `?`.

## 5. Five end-to-end flows you must demo

| Flow | Path | What "done" looks like |
|---|---|---|
| A — Setup to first checklist | Wizard → ingest progress → Checklist | 23 species loaded, 3 conflict banner, headline _A. pennsylvanicus_ on top |
| B — Triage a contested species | Checklist → _A. pennsylvanicus_ → Triage | Reject 12 likely-out-of-range records via J/K + R; activity log entry posts |
| C — Resolve a taxonomic conflict | Conflicts → pick "Use GBIF name" | iNat records re-map under the GBIF taxon; conflict count drops |
| D — Add a cite-only record | Manual → "+ Add cite-only" | New record appears in Species detail with `Cite` badge + citation tooltip |
| E — Lock and export | Top bar → Lock | Snapshot summary modal → Exports panel lights up → download DOCX |

## 6. Where to find more

- `ARCHITECTURE.md` — system diagram, rendering strategy, transactions, ingest pipeline.
- `SCHEMA.md` — Drizzle schema for every table (full TypeScript definitions, indexes, FKs).
- `ROUTES.md` — App Router tree, per-route data dependencies, role guards.
- `COMPONENTS.md` — component inventory + prop signatures + Tailwind tokens.
- `INTEGRATIONS.md` — GBIF / iNat endpoint specs (with the Tenebrionidae ingest query), Clerk webhook, Vercel Blob layout.
- `EXPORTS.md` — DOCX section structure, CSV columns, map pipeline, DwC-A contents.
- `OPEN_QUESTIONS.md` — things I (the designer) flagged but didn't decide. Re-decide where you must; surface deviations.

## 7. Prototype reference

A working clickable prototype lives at `Checklist Dashboard.html` (single-file React + Babel + Tailwind CDN). It is the visual + interaction source of truth: when the spec is ambiguous, match the prototype. Notable files:

- `src/data.jsx` — exact seed dataset (23 taxa, 3 conflicts, 2 cite-only, 5 members, 8 activity entries). Port this to `lib/seed/tenebrionidae-indiana.ts`.
- `src/map.jsx` — the choropleth as a self-contained component. Replace the inline polygon grid with TIGER topojson in production but keep the same prop shape (`countyPresence: Record<fips, number>`, `mode: 'count'|'binary'`, `citeOnlyCounties: Set<fips>`, `size`, `onCountyClick`, `onCountyHover`).
- `src/screens/*` — one file per screen in `ROUTES.md`. Each is a faithful UI mock; use them as your component layout reference.
