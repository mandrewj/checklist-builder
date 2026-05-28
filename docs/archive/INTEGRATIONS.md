# Integrations

Specs for talking to GBIF, iNaturalist, Clerk, Neon, and Vercel Blob. Every external touchpoint terminates in a typed adapter in `lib/sources/` (data) or `lib/external/` (auth/storage); application code never sees raw URLs or response shapes.

## Environment variables

Auto-provisioned by Vercel Marketplace, except `CRON_SECRET` and the `GBIF_*`/`INAT_*` user-agent vars which you set manually.

```
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard

DATABASE_URL=postgres://neondb_owner:...@.../neondb
DATABASE_URL_UNPOOLED=postgres://...

BLOB_READ_WRITE_TOKEN=

CRON_SECRET=                              # generate; used to authenticate /api/cron/ingest
GBIF_USER_AGENT=insectid-checklist (mailto:ops@your-lab.edu)
INAT_USER_AGENT=insectid-checklist (mailto:ops@your-lab.edu)
```

---

## GBIF Occurrence API

Base: `https://api.gbif.org/v1`. No key required for read.

### Endpoints used

| Verb | Path | Purpose |
|---|---|---|
| `GET` | `/species/search?q={q}&limit=10&rank=GENUS,SPECIES,FAMILY,SUBFAMILY` | Taxon autocomplete in wizard. |
| `GET` | `/species/{key}` | Resolve a taxonKey to full record (when user picks). |
| `GET` | `/occurrence/search` | Ingest. See params below. |

### Ingest query (per page)

```
GET /occurrence/search?
    taxonKey=7919
    &country=US
    &stateProvince=Indiana
    &basisOfRecord=HUMAN_OBSERVATION,PRESERVED_SPECIMEN,MATERIAL_SAMPLE
    &year=2018,2024
    &hasCoordinate=true
    &establishmentMeans=NATIVE
    &offset={cursor}
    &limit=300
```

`limit=300` is the GBIF max. We persist `offset` in `ingest_jobs.cursor`. We pass each region code as a separate `gadm.gid=` filter when we have a county-level GADM map; we fall back to `stateProvince=` matching for MVP.

### Response shape we depend on

```ts
type GbifOccurrence = {
  key: number;
  scientificName: string;
  acceptedScientificName?: string;
  taxonKey: number;
  acceptedTaxonKey?: number;
  decimalLatitude?: number;
  decimalLongitude?: number;
  countryCode?: string;
  stateProvince?: string;
  county?: string;                  // sometimes present; we re-geocode anyway
  eventDate?: string;               // ISO
  recordedBy?: string;
  basisOfRecord: string;
  occurrenceID?: string;
  media?: Array<{ identifier: string; type: string }>;
};
```

We upsert into `records` with `external_id = 'GBIF:' + key` and stash the full body in `records.raw`.

### Rate limits

Officially "polite use, no hard limit". We self-throttle to **≤ 4 req/s/source**. Backoff on 5xx: `min(60s, 2 ** attempt + jitter)`.

User-Agent header is required; we use `GBIF_USER_AGENT`.

---

## iNaturalist API v1

Base: `https://api.inaturalist.org/v1`. No key required for read. **Strict request limit**: 60 req/min per IP. We self-throttle to **≤ 2 req/s/source**.

### Endpoints used

| Verb | Path | Purpose |
|---|---|---|
| `GET` | `/taxa/autocomplete?q={q}&per_page=10` | Taxon autocomplete in wizard. |
| `GET` | `/observations` | Ingest. See params below. |
| `GET` | `/observations/{id}/photos` | Image enrichment (lazy, when user opens a record). |

### Ingest query (per page)

```
GET /observations?
    taxon_id=52719
    &place_id=33                       # Indiana (resolved at setup)
    &quality_grade=research            # or 'any' if user picks needs-id
    &geo=true
    &d1=2018-01-01
    &d2=2024-12-31
    &captive=false
    &per_page=200
    &order_by=id
    &order=asc
    &id_above={cursor}
```

We **paginate via `id_above`**, not `page` — iNat caps `page` at 30 but `id_above` is unbounded. The cursor is the last seen observation id.

### Response shape we depend on

```ts
type InatObservation = {
  id: number;
  taxon: { id: number; name: string; rank: string; preferred_common_name?: string };
  observed_on?: string;
  user: { login: string; name?: string };
  quality_grade: 'research' | 'needs_id' | 'casual';
  geojson: { coordinates: [number, number] };  // [lng, lat]
  place_guess?: string;
  uri: string;
  photos?: Array<{ id: number; url: string; attribution: string }>;
};
```

Upsert into `records` with `external_id = 'iNat:' + id`. `imageUrl` is the first photo's URL transformed `/square.jpg` → `/medium.jpg`.

### Place IDs

iNat exposes places (US states, Canadian provinces) as numeric ids. We bundle a static map `lib/data/inat-places.json` covering all US states + Canadian provinces. Looked up at ingest setup; not fetched at runtime.

---

## Reverse geocoding (lat/lng → county FIPS)

Done **in-process** at ingest time, not via an external service. We perform a point-in-polygon test against the bundled US-counties + Canada-cdivs topojson using `d3-polygon`'s `polygonContains`. About **6 ms per record** on Vercel's standard Node runtime; for a 5 000-record project that's ~30 s amortised across the cron ticks.

A record with no usable lat/lng — fewer than 4 decimal places after rounding — is **never** auto-assigned a county; it's flagged with `flag_reason='Missing precise coordinates'` and surfaced to the user. See `OPEN_QUESTIONS.md` for the state-level-only buckets question.

---

## Clerk

Standard `@clerk/nextjs` setup.

```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublic = createRouteMatcher([
  '/', '/sign-in(.*)', '/sign-up(.*)', '/api/cron(.*)'
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});
```

**Webhook**: `POST /api/clerk/webhook` listens for `user.created` and inserts a row in `users` so foreign keys to userId work the first time a user signs in.

**Invitations**: `clerk.invitations.createInvitation({ emailAddress, publicMetadata: { projectId, role } })`. The webhook reads `publicMetadata` on `user.created` and adds the membership row.

---

## Neon

Connection string from the Vercel Neon integration. We use the **pooled** connection (`DATABASE_URL`) for request-scoped queries and the **unpooled** one (`DATABASE_URL_UNPOOLED`) for migrations and ingest jobs (which open transactions longer than the pooler likes).

Drizzle config in `drizzle.config.ts`. Migrations are committed in `lib/db/migrations/` and applied automatically on Vercel deploy via:

```bash
pnpm exec drizzle-kit push   # in the postinstall step
```

Cold-start latency from a scaled-to-zero Neon project is ~600 ms; for a research tool used in long sessions this is acceptable. We ping the DB on the dashboard layout to warm it.

---

## Vercel Blob

Token: `BLOB_READ_WRITE_TOKEN`. Buckets are implicit per project; we prefix every key with the project's cuid:

```
/p1/snapshots/ss_p1_240525/manuscript-draft.docx
/p1/snapshots/ss_p1_240525/checklist.csv
/p1/snapshots/ss_p1_240525/maps/alobates-pennsylvanicus.svg
...
```

The export pipeline `put()`s each artifact and stores the returned URL in `export_artifacts.blob_url`. Downloads go through our `/api/blob/:id` redirector so we can scope-check role before serving.

---

## Caching / ETL strategy (small-scale)

Because projects are small (<5 000 records) and Neon is fast, we **do not cache** records anywhere outside Postgres. Specifically:

- No Redis. No KV. No Edge cache for record data.
- GBIF/iNat responses are persisted once at ingest and not re-fetched. A "Re-run ingest" is destructive and goes through the full pipeline.
- Taxon-suggest endpoint is cached at the edge for 24 h via `Cache-Control: public, s-maxage=86400, stale-while-revalidate=86400`.

When a project grows past these scale targets the right move is to introduce a per-project read replica (Neon supports branching) rather than adding a Redis layer.
