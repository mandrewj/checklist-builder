# CLAUDE.md — checklist-builder

Working notes for Claude Code. The original design brief is archived at
`docs/archive/` (frozen; the shipped code is the source of truth when they conflict).

## What this is

Regional insect-species checklist builder for Purdue's Insect Diversity &
Diagnostics Lab. Aggregates GBIF + iNaturalist occurrences into per-county
presence grids; users verify, resolve GBIF↔iNat conflicts, and export a
manuscript pack (DOCX, CSV, per-species maps + phenology, Darwin Core Archive,
JSON). Deployed on Vercel at `checklist-builder.vercel.app`.

## Stack

Next.js 16 (App Router, React 19, Turbopack) · TypeScript · Tailwind 4 +
shadcn/ui · Drizzle ORM on **Neon Postgres** · **Clerk** auth · **Vercel Blob**
for export artifacts. GBIF + iNat APIs (no keys; polite UA + rate limits).

## Commands

- `pnpm dev` · `pnpm typecheck` · `pnpm build`
- `pnpm db:generate` (after schema edits) → `pnpm db:migrate`
- `pnpm seed` (resets DB to the Tenebrionidae of Indiana fixture)
- `pnpm seed:adopt <clerk-id> [email] ["Name"]` (grant Lead on seed projects)
- `pnpm set-admin <clerk-id> [--off]` (super-user)

## Gotchas (read before deploying / running scripts)

- **Neon dev vs prod are separate branches.** `vercel env pull` gives the
  *development* `DATABASE_URL`. Apply migrations/seeds to each branch.
- **Marketplace-managed prod secrets don't download.** Neon `DATABASE_URL` +
  Clerk keys pull empty via `vercel env pull` (encrypted, injected at runtime).
  For prod scripts pass it inline: `DATABASE_URL='postgres://…' pnpm db:migrate`.
  Scripts load `.env.local` but won't override an already-set var, so inline wins.
- **Clerk has two instances.** Dev (`pk_test_…`) works on any domain, no DNS.
  Prod (`pk_live_…`) needs a custom domain via CNAME. If users seem missing,
  confirm the dashboard instance matches the deployed keys.
- **Migrations are explicit** (`pnpm db:migrate`); nothing auto-migrates on boot.
- The Clerk webhook (`/api/clerk/webhook`) mirrors users into our `users` table
  on `user.created`. The seed's `system` user owns fixtures until `seed:adopt`
  re-points ownership.

## Conventions

- Drizzle schema in `src/lib/db/schema/*.ts`; generate migrations, don't hand-edit.
- Auth: `src/lib/auth/dev-auth.ts` wraps Clerk's `auth()`. `getProjectAccess`
  is the read gate (member / public / null); `requireRole` gates mutations.
  Admins get a synthetic Lead membership everywhere (`viaAdmin` flag distinguishes
  it for the UI badge).
- No silent automation: system-inferred values (county-from-coords, conflict
  detection, cross-source taxon-ID resolution) are badged + overridable.
- No canonical taxonomy: GBIF + iNat names coexist until a user resolves the conflict.
- Static SVG choropleths only (same `RegionChoropleth` on-screen and in exports);
  categorical = Okabe-Ito, sequential = viridis; Lato; desktop-first (≥1280px).
- Exports run against an immutable `lockedSnapshotId`.

## Structure

`src/app` routes · `src/lib/{actions,auth,db,exports,geo,insectid,jobs,sources,seed}`
· `public/topojson` bundled geometry · `scripts/` ops · `drizzle/` migrations.
