# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router, latest stable), TypeScript strict** | RSC + Server Actions removes the need for a separate API service; the client owns no business logic. |
| UI | **Tailwind CSS + shadcn/ui (registry CLI)** | Style tokens map 1:1 to the InsectID guide (see `tailwind.config.ts`). |
| Auth | **Clerk** (Vercel Marketplace) | Single-tenant per institution. JWT in cookie; we read userId in server actions. |
| DB | **Neon Postgres** (Vercel Marketplace, serverless, scales to zero) | No admin surface. Drizzle migrations land in git. |
| ORM | **Drizzle** | Strong types from `SCHEMA.md`; predictable SQL. |
| File storage | **Vercel Blob** | Export artifacts and (optionally) iNat image cache. |
| Async / long-running ingest | **`ingest_jobs` table polled by Vercel Cron (`* * * * *`) + a server function** | Resumable, idempotent, no extra infra. Could move to Vercel Workflow DevKit when jobs exceed cron granularity. |
| External | GBIF Occurrence API; iNaturalist API v1 | See `INTEGRATIONS.md`. |
| Topojson | **Bundled** at `/public/topojson/{us-counties,ca-cdivs}.json` | Loaded once on the workspace shell; ~700 KB combined gzipped. See `OPEN_QUESTIONS.md` on lazy-loading. |

Nothing the client (the lab) maintains. Code → GitHub → Vercel.

## Rendering strategy

```
app/
├── (marketing)/page.tsx            ← marketing landing (RSC; static)
├── sign-in/[[...sign-in]]/page.tsx ← Clerk
├── dashboard/page.tsx              ← RSC; queries projects user belongs to
├── projects/new/page.tsx           ← Client; multi-step wizard, lives in URL hash
└── projects/[id]/
    ├── layout.tsx                  ← RSC shell with sidebar; queries project meta + role
    ├── page.tsx                    ← Overview RSC
    ├── checklist/page.tsx          ← RSC for first paint of taxa; client hydrates for filter/sort
    ├── records/page.tsx            ← Same pattern
    ├── species/[taxonId]/page.tsx  ← RSC + client triage island
    ├── conflicts/page.tsx          ← RSC list; client per-row resolution panel
    ├── manual/page.tsx
    ├── activity/page.tsx           ← RSC; cursor-paginated
    ├── members/page.tsx
    ├── exports/page.tsx
    └── settings/page.tsx
```

**Rule of thumb**: every page renders its first paint on the server (taxa, conflicts, members, etc.) and hydrates client islands only for the interactive bits (filter chips, sort, triage, comment composer). The big choropleth is a `'use client'` island because it needs hover state, but its props (county presence) are computed server-side.

## Data flow

Client → Server Actions → Drizzle → Postgres. We do not stand up a JSON API.

```
[client component]
   └── form action: triageRecordAction(recordId, status)
         └── lib/actions/records.ts (server)
              ├── auth: require Contributor+ on this project
              ├── drizzle.update(records).set({status})
              ├── drizzle.insert(activityLog).values({...})
              └── revalidatePath(`/projects/${id}/species/${taxonId}`)
```

For bulk operations (e.g. reject N records), the action takes an array and runs them in one transaction.

## Authn/Authz

- **Authn**: Clerk middleware on every `/projects/*` route. Server actions read `auth().userId`.
- **Authz**: each server action calls `requireRole(projectId, userId, minRole)`. The function reads `memberships` and throws `unauthorized` if absent or below role. Role enum: `Lead` > `Contributor` > `Reviewer`.
- **Lock**: when `projects.locked_at` is non-null, any write action throws `projectLocked` unless the action is `lockProject` or `unlockProject`. Reads remain open.

```
function requireRole(projectId: string, userId: string, min: Role): Promise<Membership>
function requireUnlocked(projectId: string): Promise<void>
```

Both wrap every mutating action.

## Caching strategy (ingest workload, small-scale)

- `taxa`, `records`, `county_presence` are **always read fresh** from Postgres on a route visit. The dataset is small (<5 k records) and Neon under cold start is fast enough that we don't need a read cache.
- GBIF + iNat responses are **persisted to `records.raw` (jsonb)** at ingest time. No second API call.
- iNat image thumbnails: MVP **hot-links** to iNat's CDN URL. See `OPEN_QUESTIONS.md` on caching to Vercel Blob.
- Topojson is bundled in the JS chunk; fetched once.

## Ingest pipeline

```
ingest_jobs (project_id, source, status, cursor, started_at, finished_at, error)

cron tick:
  1. SELECT * FROM ingest_jobs WHERE status = 'running' LIMIT 5
  2. For each job:
       - fetch one page from GBIF or iNat using cursor
       - upsert records into `records` (dedup key per source)
       - increment cursor
       - if API returns 0 records, mark job 'done'
       - if 5xx or rate-limit, exponential backoff (jitter) and persist
  3. When all per-source jobs done, run consolidate():
       - reverse-geocode every record without county_fips via spatial join
       - merge cross-source duplicates (haversine ≤ 50m + same observer + same date)
       - rebuild county_presence
       - detect conflicts: same GBIF taxonKey but different scientific names across sources → insert taxon_conflicts
```

This is **resumable**: the job table persists progress between cron ticks. Workflow DevKit is overkill at this scale; we chose the simpler cron path.

## State changes & audit log

Every server action that mutates state also inserts an `activity_log` row in the same transaction. The before→after JSON is small (record id, old/new value) so storing it inline is fine. Undo in the UI is a UI-side reversal that emits a *new* action labelled "undo (parent_id=…)" — the log stays append-only.

## Performance budget

- First paint of Checklist (50 species, 5 000 records): **< 400 ms TTFB** under typical Neon warm latency (queries are 1–3 ms; the budget is mostly Next render).
- Choropleth render (Indiana, 92 counties): **< 16 ms** — pure SVG, no virtualisation needed.
- DOCX export (24 species, 24 maps): **< 8 s** end-to-end, single server function invocation (within Vercel's 60 s function limit). See `EXPORTS.md`.

## Failure modes & recovery

| Failure | Mitigation |
|---|---|
| GBIF returns 5xx | exponential backoff in the cron worker; job stays in `running` with last error stored |
| iNat returns 429 | respect `Retry-After`; persist cursor |
| User refreshes during ingest | the wizard shows live progress polled from `ingest_jobs` |
| Export function times out | each export writes to Blob as it builds; on timeout, partial artifact stays and user retries (idempotent on snapshot_id) |
| Two users edit the same record | last-write-wins on `records.status`; both are visible in activity log |

## What we chose against

- **A separate API service** — RSC + server actions removes the need; the client never sees raw SQL.
- **GraphQL** — schema is too small.
- **Edge runtime for server actions** — we keep them on Node so Drizzle's pg driver works and we can spawn longer tasks.
- **A taxonomic backbone in the DB** — we never canonicalize. GBIF + iNat names coexist until resolution.
