# Routes

Next.js App Router tree. Every `/projects/*` route is wrapped in Clerk middleware (`middleware.ts`) and `requireRole` is called in each page's RSC fetch.

## Public

| Route | Component | Purpose | Auth |
|---|---|---|---|
| `/` | `app/(marketing)/page.tsx` | Marketing landing. Static. | none |
| `/sign-in/[[...sign-in]]` | Clerk `<SignIn/>` | Sign in. | none |
| `/sign-up/[[...sign-up]]` | Clerk `<SignUp/>` | Sign up. | none |

## Authenticated dashboard

| Route | Component | Data fetched | Roles |
|---|---|---|---|
| `/dashboard` | `app/dashboard/page.tsx` (RSC) | `SELECT projects.*, memberships.role FROM projects JOIN memberships USING (project_id) WHERE memberships.user_id = $1` | any signed-in user |
| `/projects/new` | `app/projects/new/page.tsx` (`'use client'`) | none (wizard owns local state until step 5) | any signed-in user |

## Inside a project: `/projects/[id]/*`

Layout: `app/projects/[id]/layout.tsx` (RSC). Loads:
- `projects` by id
- caller's `memberships.role`
- `members` for the avatar stack in the top bar
- conflicts count (badge), flagged-records count (badge), manual-entries count

If membership is missing → `notFound()`. If project doesn't exist → `notFound()`.

| Route | Purpose | Data | Roles |
|---|---|---|---|
| `/projects/[id]` | **Overview**. Stats, next steps, recent activity, headline species map. | toplines (`COUNT(*)…` per status), top 6 activity rows, members | Reviewer+ |
| `/projects/[id]/checklist` | **Species checklist** (default landing for triage). Filterable table. | `taxa` ordered by `n_records DESC`, filtered server-side from search params | Reviewer+ |
| `/projects/[id]/records` | **Records** cross-taxon table; for record-level batch triage. | `records` joined with `taxa`, filtered + paginated | Reviewer+ |
| `/projects/[id]/species/[taxonId]` | **Species detail** + per-record triage island. | one `taxa` row, all `records` for it, presence map, comments, related conflict | Reviewer+; mutate = Contributor+ |
| `/projects/[id]/conflicts` | **Conflicts** list. | `taxon_conflicts WHERE project_id=$1 ORDER BY resolved_at NULLS FIRST` | Reviewer+; resolve = Contributor+ |
| `/projects/[id]/manual` | **Manual entries / cite-only records**. | `records WHERE source='cite'` joined with `taxa` | Reviewer+; add = Contributor+ |
| `/projects/[id]/activity` | **Activity log** with member/action/date filters. | `activity_log` cursor-paginated | Reviewer+ |
| `/projects/[id]/members` | **Members**. Invite/role/remove (Lead-only edits). | `memberships JOIN users` | Reviewer+ read; mutate = Lead |
| `/projects/[id]/exports` | **Exports** panel. Generate or download artifacts. | `export_artifacts` for the current snapshot | Contributor+ generate, Reviewer+ read |
| `/projects/[id]/settings` | **Settings**. Rename, region, filters, re-ingest, danger zone. | `projects` row + active `ingest_jobs` | Lead |

## Server actions (mutations)

These live in `lib/actions/*.ts`. Each is a `'use server'` function that:
1. Calls `auth()` to get `userId`.
2. Calls `requireRole(projectId, userId, min)`.
3. Calls `requireUnlocked(projectId)` (unless the action is `lockProject`/`unlockProject`).
4. Runs the mutation + activity log insert in one transaction.
5. Returns a normalized result `{ ok: true } | { ok: false, error }`.
6. Calls `revalidatePath()` for affected pages.

### Project
| Action | Min role | Notes |
|---|---|---|
| `createProject(input)` | any | inserts project + membership(Lead); starts ingest job |
| `updateProjectSettings(id, patch)` | Lead | rename, description |
| `changeRegion(id, codes)` | Lead | destructive; surfaces diff modal client-side |
| `lockProject(id)` | Lead | sets `locked_at`, creates `locked_snapshot_id` |
| `unlockProject(id)` | Lead | nulls `locked_at`, retains historical exports |
| `deleteProject(id)` | Lead | cascade |

### Members
| Action | Min role |
|---|---|
| `inviteMember(projectId, email, role)` | Lead |
| `changeRole(projectId, userId, role)` | Lead |
| `removeMember(projectId, userId)` | Lead |

### Taxa
| Action | Min role |
|---|---|
| `setTaxonInclusion(taxonId, value, reasoning)` | Contributor |
| `bulkSetTaxonInclusion(ids, value)` | Contributor |

### Records
| Action | Min role |
|---|---|
| `setRecordStatus(recordId, status, flagReason?)` | Contributor |
| `bulkSetRecordStatus(ids, status, reason?)` | Contributor |
| `addManualRecord(projectId, input)` | Contributor |
| `editRecord(recordId, patch)` | Contributor |

### Conflicts
| Action | Min role |
|---|---|
| `resolveConflict(conflictId, resolution, customName?)` | Contributor |

### Comments
| Action | Min role |
|---|---|
| `addComment(targetType, targetId, body)` | Reviewer (yes — reviewers can comment) |
| `deleteComment(commentId)` | author or Lead |

### Ingest
| Action | Min role |
|---|---|
| `restartIngest(projectId, filters?)` | Lead |

### Exports
| Action | Min role |
|---|---|
| `generateExport(projectId, format)` | Contributor — requires project locked |

## Route handlers (non-action APIs)

Only a few; everything else is a server action.

| Path | Purpose |
|---|---|
| `GET /api/blob/:id` | Signed redirect to a Vercel Blob URL for an `export_artifacts` row (so we don't leak the raw blob URL). |
| `POST /api/cron/ingest` | Vercel Cron entry-point. Picks up `ingest_jobs` in `running` and advances them one page each. Header: `Authorization: Bearer ${CRON_SECRET}`. |
| `GET /api/taxon-suggest?q=...&source=gbif|inat` | Proxy to GBIF/iNat for taxon autocomplete in the wizard. Cached `s-maxage=86400`. |

## Search params (filter state in URLs)

Routes whose state we want to share via URL:

- `/projects/[id]/checklist?inclusion=undecided&conflict=1&q=Alobates&family=Tenebrionidae`
- `/projects/[id]/records?status=flagged&source=inat`
- `/projects/[id]/activity?member=u1&action=conflict_resolve`
- `/projects/[id]/conflicts?status=open|resolved|all`

Filter chips in the UI write to the URL via `useSearchParams + router.push(scroll:false)`.

## Not-found and unauthorized

- `notFound()` → `app/not-found.tsx`. Branded blue-800 sad-face.
- `unauthorized` thrown from `requireRole` is caught in `app/projects/[id]/error.tsx` and renders a "you don't have access" panel with a sign-in-as-different-user shortcut.

## Static assets

| Path | Notes |
|---|---|
| `/topojson/us-counties.json` | 480 KB, gzipped 110 KB |
| `/topojson/ca-cdivs.json` | 218 KB, gzipped 52 KB |
| `/fonts/*` | Hosted by `next/font/google` — Lato 300/400/700/900 |
