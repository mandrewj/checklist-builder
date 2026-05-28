# Database schema

Drizzle ORM against Neon Postgres. All tables live under `lib/db/schema/`. Each file exports one table; `lib/db/schema/index.ts` re-exports.

## Conventions

- IDs are `text` Cuid2s (`createId()` from `@paralleldrive/cuid2`). Cheap, sortable, opaque.
- Timestamps are `timestamp({ withTimezone: true })`. We always store UTC.
- Soft-delete: **none** in MVP. Project delete is irreversible; the activity log preserves history for everything else.
- Indexes are declared via `index()` after `pgTable()`. Listed below each table.
- Enums use Postgres native `pgEnum` so they show up in `\dT+`.

## Enums

```ts
export const roleEnum            = pgEnum('role', ['Lead', 'Contributor', 'Reviewer']);
export const inclusionEnum       = pgEnum('inclusion', ['include', 'exclude', 'undecided']);
export const taxonSourceEnum     = pgEnum('taxon_source', ['gbif', 'inat', 'manual', 'merged']);
export const recordSourceEnum    = pgEnum('record_source', ['gbif', 'inat', 'manual', 'cite']);
export const recordStatusEnum    = pgEnum('record_status', ['pending', 'accepted', 'rejected', 'flagged']);
export const conflictResEnum     = pgEnum('conflict_resolution', ['gbif', 'inat', 'separate', 'merged']);
export const exportFormatEnum    = pgEnum('export_format', ['docx', 'csv', 'maps', 'dwc', 'json']);
export const ingestStatusEnum    = pgEnum('ingest_status', ['pending', 'running', 'done', 'failed']);
```

## Tables

### `users`

Bridge between Clerk and our domain. Single row per Clerk user we've seen.

```ts
users = pgTable('users', {
  id:           text('id').primaryKey(),                  // == clerk userId
  email:        text('email').notNull(),
  displayName:  text('display_name').notNull(),
  initials:     text('initials').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});
// indexes: unique(email)
```

### `projects`

```ts
projects = pgTable('projects', {
  id:                 text('id').primaryKey().$defaultFn(createId),
  name:               text('name').notNull(),
  description:        text('description').notNull().default(''),
  taxonQuery:         jsonb('taxon_query').$type<TaxonQuery>().notNull(),  // {name,rank,gbifKey,inatId}
  regionCodes:        text('region_codes').array().notNull(),              // ['US-IL','US-IN']
  ingestFilters:      jsonb('ingest_filters').$type<IngestFilters>().notNull(),
  lockedAt:           timestamp('locked_at'),                              // null = unlocked
  lockedSnapshotId:   text('locked_snapshot_id'),                          // null if never locked
  createdBy:          text('created_by').references(() => users.id).notNull(),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
});
// indexes:
//   idx_projects_created_by (created_by)
//   idx_projects_locked (locked_at) WHERE locked_at IS NOT NULL
```

### `memberships`

```ts
memberships = pgTable('memberships', {
  projectId:  text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  userId:     text('user_id').references(() => users.id).notNull(),
  role:       roleEnum('role').notNull(),
  joinedAt:   timestamp('joined_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.userId] }),
  idxUserProj: index('idx_memberships_user').on(t.userId),
}));
```

### `taxa`

Every name we know about for a project, kept side-by-side until resolution.

```ts
taxa = pgTable('taxa', {
  id:                  text('id').primaryKey().$defaultFn(createId),
  projectId:           text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  scientificName:      text('scientific_name').notNull(),
  authority:           text('authority'),
  rank:                text('rank').notNull(),                           // 'species'|'genus'|'family'...
  parentId:            text('parent_id'),                                // self-FK for genus→family etc
  source:              taxonSourceEnum('source').notNull(),              // 'gbif'|'inat'|'manual'|'merged'
  externalIds:         jsonb('external_ids').$type<{gbifKey?:number; inatId?:number}>().notNull(),
  included:            inclusionEnum('included').notNull().default('undecided'),
  inclusionReasoning:  text('inclusion_reasoning').default(''),
  inclusionUpdatedAt:  timestamp('inclusion_updated_at'),
  inclusionUpdatedBy:  text('inclusion_updated_by').references(() => users.id),
}, (t) => ({
  idxProject:    index('idx_taxa_project').on(t.projectId),
  idxName:       index('idx_taxa_name').on(t.projectId, t.scientificName),
  idxIncluded:   index('idx_taxa_included').on(t.projectId, t.included),
}));
```

### `records`

Both occurrence records (GBIF/iNat/manual) and cite-only records (`source='cite'`) live here. The `citation` column is nullable except when `source='cite'`.

```ts
records = pgTable('records', {
  id:           text('id').primaryKey().$defaultFn(createId),
  projectId:    text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  taxonId:      text('taxon_id').references(() => taxa.id, { onDelete: 'cascade' }).notNull(),
  source:       recordSourceEnum('source').notNull(),
  externalId:   text('external_id'),                                     // 'GBIF:...' or 'iNat:...' or null
  lat:          doublePrecision('lat'),
  lng:          doublePrecision('lng'),
  stateCode:    text('state_code'),                                      // 'US-IL' etc; nullable for cite-only
  countyFips:   text('county_fips'),                                     // '17031' etc
  observedAt:   date('observed_at'),                                     // nullable for cite-only
  collector:    text('collector'),
  imageUrl:     text('image_url'),
  raw:          jsonb('raw'),                                            // original API response
  status:       recordStatusEnum('status').notNull().default('pending'),
  flagReason:   text('flag_reason'),
  citation:     text('citation'),                                        // required when source='cite'
  doi:          text('doi'),
  notes:        text('notes'),
  addedBy:      text('added_by').references(() => users.id),
  addedAt:      timestamp('added_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  idxProjectTaxon:  index('idx_records_project_taxon').on(t.projectId, t.taxonId),
  idxCounty:        index('idx_records_county').on(t.projectId, t.countyFips),
  idxStatus:        index('idx_records_status').on(t.projectId, t.status),
  idxSource:        index('idx_records_source').on(t.projectId, t.source),
  uqExternal:       uniqueIndex('uq_records_external').on(t.projectId, t.source, t.externalId),
  ckCiteHasCitation: check('ck_cite_citation', sql`source <> 'cite' OR citation IS NOT NULL`),
}));
```

`uq_records_external` is the dedup key at ingest time: `(project_id, source, externalId)`.

### `county_presence`

A **materialized view** updated after every record-status change. Rebuilt on lock so exports use a consistent snapshot.

```ts
countyPresence = pgTable('county_presence', {
  projectId:     text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  taxonId:       text('taxon_id').references(() => taxa.id, { onDelete: 'cascade' }).notNull(),
  countyFips:    text('county_fips').notNull(),
  nRecords:      integer('n_records').notNull(),                          // accepted only
  hasCiteOnly:   boolean('has_cite_only').notNull().default(false),
}, (t) => ({
  pk:        primaryKey({ columns: [t.projectId, t.taxonId, t.countyFips] }),
  idxLookup: index('idx_cp_taxon_county').on(t.taxonId, t.countyFips),
}));
```

In Postgres terms this is actually a regular table maintained by triggers (Postgres `MATERIALIZED VIEW` cannot be refreshed concurrently per-project at our scale). Trigger functions are in `lib/db/migrations/0003_county_presence_triggers.sql`.

### `taxon_conflicts`

GBIF↔iNat name disagreements. **No default resolution**; the column is null until the user resolves.

```ts
taxonConflicts = pgTable('taxon_conflicts', {
  id:              text('id').primaryKey().$defaultFn(createId),
  projectId:       text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  taxonId:         text('taxon_id').references(() => taxa.id),
  gbifName:        text('gbif_name').notNull(),
  gbifAuthority:   text('gbif_authority'),
  inatName:        text('inat_name').notNull(),
  inatAuthority:   text('inat_authority'),
  gbifRecords:     integer('gbif_records').notNull().default(0),
  inatRecords:     integer('inat_records').notNull().default(0),
  note:            text('note').default(''),
  resolution:      conflictResEnum('resolution'),
  resolvedBy:      text('resolved_by').references(() => users.id),
  resolvedAt:      timestamp('resolved_at'),
  customName:      text('custom_name'),                                   // when resolution='merged'
}, (t) => ({
  idxProject:   index('idx_conflicts_project').on(t.projectId),
  idxOpen:      index('idx_conflicts_open').on(t.projectId).where(sql`resolution IS NULL`),
}));
```

### `comments`

Polymorphic by `targetType` ∈ {`taxon`, `record`}.

```ts
comments = pgTable('comments', {
  id:           text('id').primaryKey().$defaultFn(createId),
  projectId:    text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  targetType:   text('target_type').notNull(),                            // 'taxon' | 'record'
  targetId:     text('target_id').notNull(),
  authorId:     text('author_id').references(() => users.id).notNull(),
  body:         text('body').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  idxTarget: index('idx_comments_target').on(t.projectId, t.targetType, t.targetId),
}));
```

### `activity_log`

Append-only audit trail. Inserted in the same transaction as the mutating action.

```ts
activityLog = pgTable('activity_log', {
  id:           text('id').primaryKey().$defaultFn(createId),
  projectId:    text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  actorId:      text('actor_id').references(() => users.id).notNull(),
  action:       text('action').notNull(),                                 // 'include' | 'reject' | 'comment' | ...
  targetType:   text('target_type').notNull(),                            // 'taxon' | 'record' | 'project' | 'conflict' | 'export'
  targetId:     text('target_id').notNull(),
  before:       jsonb('before'),
  after:        jsonb('after'),
  parentId:     text('parent_id'),                                        // points at the original entry for 'undo' rows
  ts:           timestamp('ts').defaultNow().notNull(),
}, (t) => ({
  idxProjectTs: index('idx_activity_project_ts').on(t.projectId, t.ts.desc()),
  idxActor:     index('idx_activity_actor').on(t.projectId, t.actorId),
  idxAction:    index('idx_activity_action').on(t.projectId, t.action),
}));
```

### `export_artifacts`

```ts
exportArtifacts = pgTable('export_artifacts', {
  id:           text('id').primaryKey().$defaultFn(createId),
  projectId:    text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  snapshotId:   text('snapshot_id').notNull(),                            // matches projects.locked_snapshot_id at the time
  format:       exportFormatEnum('format').notNull(),
  blobUrl:      text('blob_url').notNull(),                               // vercel-blob://...
  bytes:        integer('bytes'),
  generatedBy:  text('generated_by').references(() => users.id).notNull(),
  generatedAt:  timestamp('generated_at').defaultNow().notNull(),
}, (t) => ({
  idxProjectSnap: index('idx_exports_proj_snap').on(t.projectId, t.snapshotId),
}));
```

### `ingest_jobs`

```ts
ingestJobs = pgTable('ingest_jobs', {
  id:           text('id').primaryKey().$defaultFn(createId),
  projectId:    text('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  source:       text('source').notNull(),                                  // 'gbif' | 'inat'
  status:       ingestStatusEnum('status').notNull().default('pending'),
  cursor:       text('cursor'),                                            // last GBIF offset / iNat id_above
  pageSize:     integer('page_size').notNull().default(300),
  fetched:      integer('fetched').notNull().default(0),
  startedAt:    timestamp('started_at'),
  finishedAt:   timestamp('finished_at'),
  error:        text('error'),
}, (t) => ({
  idxProjectStatus: index('idx_ingest_proj_status').on(t.projectId, t.status),
  idxRunning:       index('idx_ingest_running').on(t.status).where(sql`status = 'running'`),
}));
```

## Foreign-key map (high-level)

```
users ←──── memberships ────→ projects
users ←──── taxa.inclusion_updated_by
projects ←── taxa ←── records ←── comments
projects ←── taxon_conflicts
projects ←── county_presence
projects ←── activity_log
projects ←── export_artifacts
projects ←── ingest_jobs
```

`ON DELETE CASCADE` only for the project subtree. User-FKs are `ON DELETE SET NULL` to preserve audit history if a user account is removed from Clerk.

## Common query plans

| Question | Path |
|---|---|
| Per-project record count | `SELECT COUNT(*) FROM records WHERE project_id=$1` — `idx_records_project_taxon` |
| Per-county taxon list | `SELECT taxon_id, n_records FROM county_presence WHERE project_id=$1 AND county_fips=$2` — pk |
| Per-taxon record list, paginated | `SELECT * FROM records WHERE project_id=$1 AND taxon_id=$2 ORDER BY observed_at DESC` — `idx_records_project_taxon` |
| Unresolved conflicts | `SELECT * FROM taxon_conflicts WHERE project_id=$1 AND resolution IS NULL` — `idx_conflicts_open` |
| Recent activity | `SELECT * FROM activity_log WHERE project_id=$1 ORDER BY ts DESC LIMIT 50` — `idx_activity_project_ts` |
