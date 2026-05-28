# Checklist Builder

Regional insect-species checklist builder for research entomologists, built for the [Insect Diversity & Diagnostics Lab](https://entomology.purdue.edu/) at Purdue. Aggregates GBIF + iNaturalist occurrence data into per-county presence grids and walks the user through verification, conflict resolution, and a publication-ready manuscript pack (DOCX, CSV, per-species county-distribution maps, Darwin Core Archive, JSON snapshot).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, React 19) + TypeScript |
| UI | Tailwind 4 + shadcn/ui |
| Auth | [Clerk](https://clerk.com) (Vercel Marketplace) |
| DB | [Neon](https://neon.tech) Postgres (Vercel Marketplace) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| Storage | Local fs (dev) — wire Vercel Blob for prod |
| External | GBIF Occurrence API · iNaturalist API v1 (no keys; polite UA) |
| Geometry | TIGER 2024 counties + StatsCan 2021 provinces, bundled as GeoJSON |

Deployed to Vercel; expects Neon + Clerk integrations to be added via the Vercel Marketplace so env vars are auto-injected.

## Local development

```bash
# 1. Install deps
pnpm install

# 2. Copy the env template and fill it in (see "Environment variables")
cp .env.example .env.local
$EDITOR .env.local

# 3. Apply migrations against the Neon database referenced by DATABASE_URL
pnpm db:migrate

# 4. Seed the reference Tenebrionidae of Indiana project
pnpm seed

# 5. Run the dev server
pnpm dev
```

Visit <http://localhost:3000>. Sign in with Clerk, then run **once** to grant your Clerk user Lead on the seed project:

```bash
pnpm seed:adopt <your-clerk-user-id>
```

(Your Clerk user id is visible at <https://dashboard.clerk.com> → Users, or in the JWT once you've signed in. Future sign-ups don't need this step.)

## Environment variables

See `.env.example`. The required keys:

| Key | Source | Notes |
|---|---|---|
| `DATABASE_URL` | Neon (Vercel Marketplace) | Pooled connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard | |
| `CLERK_SECRET_KEY` | Clerk dashboard | |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk webhook endpoint | Needed for user.created → users table mirror |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store | Persists export artifacts; falls back to local fs if unset |
| `CRON_SECRET` | (optional) | Bearer token guarding `/api/cron/ingest` in prod |
| `GBIF_USER_AGENT` | (optional) | Override the default polite UA string for GBIF |
| `INAT_USER_AGENT` | (optional) | Override the default polite UA string for iNat |

> **Marketplace-managed vars don't download.** Vercel keeps integration-managed
> production secrets (Neon `DATABASE_URL`, Clerk keys) encrypted — `vercel env pull`
> returns them empty. For one-off prod scripts, grab the pooled connection string
> from the Neon/Vercel dashboard and pass it inline:
> `DATABASE_URL='postgres://…' pnpm db:migrate`. The scripts read `.env.local` but
> won't override an already-set `DATABASE_URL`, so the inline value wins.
>
> **Dev and prod are separate Neon branches.** `vercel env pull` gives you the
> *development* branch URL. Migrations + seeds must be applied to each branch
> independently.

## Deployment

1. Push to GitHub.
2. In Vercel, **Import Project** → pick the repo.
3. From the project's **Storage** tab, add the Neon integration → it provisions a database and sets `DATABASE_URL` automatically.
4. From the project's **Settings → Integrations**, add the Clerk integration → it sets `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` automatically.
5. From the **Storage** tab, also add a **Blob** store → it sets `BLOB_READ_WRITE_TOKEN` so exports persist (without it, exports fall back to `/tmp`, which Vercel wipes between invocations).
6. In Clerk's dashboard, create a webhook endpoint at `https://<your-vercel-domain>/api/clerk/webhook` subscribing to `user.created`, `user.updated`, `user.deleted`. Copy the signing secret into Vercel as `CLERK_WEBHOOK_SIGNING_SECRET`.
7. Apply migrations + seed to the **production** Neon branch (see the inline-`DATABASE_URL` note above):
   ```bash
   DATABASE_URL='<prod-pooled-url>' pnpm db:migrate
   DATABASE_URL='<prod-pooled-url>' pnpm seed            # optional: preload the Indiana fixture
   DATABASE_URL='<prod-pooled-url>' pnpm seed:adopt <your-clerk-user-id> <email> "<Display Name>"
   ```

### Clerk instances (dev vs. production)

A Clerk app has two instances. The **Development** instance (`pk_test_…` keys)
works on any domain — `localhost`, `*.vercel.app` — with no DNS setup, and is
fine for a small lab tool. The **Production** instance (`pk_live_…` keys)
requires connecting a custom domain via CNAME records. If users don't appear in
the Clerk dashboard, check you're viewing the same instance the deployment uses
(toggle top-left in the Clerk dashboard).

### Ingest in production

Ingest advances one API page per tick. Two ways to drive it:
- **Manual** — the project's **Run ingest** button drains all pending pages
  (up to ~45 s per click; the per-source cursor persists, so click again to
  resume). Works on any plan, no setup.
- **Cron** — add a `vercel.json` with a `crons` entry hitting
  `/api/cron/ingest`. Frequency is plan-limited (Hobby = daily; Pro = down to
  per-minute). Set `CRON_SECRET` in the env to authenticate Vercel's calls.

## Super-users (admins)

An admin is treated as **Lead on every project** and sees all projects on their
dashboard (workspace top bar shows an **Admin** badge instead of a role when
access is via super-user rather than membership).

```bash
# grant — creates the user row if they signed up before the Clerk webhook existed
pnpm set-admin <clerk-user-id>
# revoke
pnpm set-admin <clerk-user-id> --off
```

Against production, prefix with the prod connection string:
`DATABASE_URL='<prod-pooled-url>' pnpm set-admin <clerk-user-id>`.

## Project structure

```
src/
  app/              Next.js App Router
    api/
      blob/         Export-artifact download proxy
      clerk/        Clerk webhook handler
    dashboard/      Logged-in project list
    projects/       Workspace (checklist, species, conflicts, exports, …)
    sign-in/        Clerk sign-in
    sign-up/        Clerk sign-up
  components/       Reusable UI (choropleth, picker, app shell, …)
  lib/
    actions/        Server actions (create-project, ingest, exports, …)
    auth/           Clerk auth helpers + ProjectAccess gate
    db/             Drizzle schema + Neon client
    exports/        DOCX / CSV / Maps / DwC-A builders
    geo/            Reverse-geocoding (US counties + CA provinces)
    insectid/       Region helpers, canonicalize, viridis, topojson
    jobs/           Ingest worker (advance one page per tick)
    sources/        GBIF + iNat API adapters + cross-source taxon resolver
    seed/           Tenebrionidae of Indiana reference dataset
public/
  topojson/         Bundled GeoJSON (us-counties, us-states, canada-provinces)
scripts/            db:migrate, seed, seed:adopt, set-admin, smoke tests
drizzle/            Generated migrations
docs/archive/       Original Claude Code design handoff (frozen reference)
```

## Common tasks

| Task | Command |
|---|---|
| Run dev server | `pnpm dev` |
| Type-check | `pnpm typecheck` |
| Generate a new migration after schema change | `pnpm db:generate` |
| Apply pending migrations | `pnpm db:migrate` |
| Reset + seed Indiana fixture | `pnpm seed` |
| Adopt seed projects as a Clerk user | `pnpm seed:adopt <user-id> [email] ["Name"]` |
| Grant / revoke super-user | `pnpm set-admin <user-id> [--off]` |
| CA reverse-geocode smoke test | `tsx scripts/smoke-ca-geocode.ts` |
| Taxon-resolver smoke test (live API) | `tsx scripts/smoke-taxon-resolver.ts` |

## Conventions

- **Drizzle schemas live in `src/lib/db/schema/*.ts`.** Generate migrations with `pnpm db:generate` after any change.
- **No silent automation.** Every system-inferred value (county-from-lat/lng, conflict detection, cross-source taxon-ID resolution) is badged in the UI and overridable.
- **No canonical taxonomy.** GBIF + iNat names coexist until the user resolves the conflict.
- **No tiled basemaps.** Static SVG county choropleths only; the same `RegionChoropleth` component renders on-screen and in exports.
- **Lock-for-export** creates an immutable `lockedSnapshotId`. Exports run against the snapshot; unlock invalidates only pending exports.
- **Lato** body + headings; categorical palette = Okabe-Ito; sequential palette = viridis.
- **Desktop-first** (≥1280px assumed for the workspace).

## License

MIT (intended). Reference dataset (Tenebrionidae of Indiana) curated for development only — not a primary biodiversity source.
