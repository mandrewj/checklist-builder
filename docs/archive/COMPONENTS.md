# Components

Reusable UI components. Most are shadcn-derived; a few are custom to this product (the choropleth, the presence strip, source attribution chip). Components live in `components/` with subfolders per domain.

## Conventions

- All components are server-compatible by default. Anything that uses state, refs, or browser APIs is in a file with `'use client'` at the top and lives under `components/client/`.
- Style via Tailwind classes; no CSS Modules.
- Props match shadcn's pattern: `className` always allowed; spreads `...rest` onto the root element.
- Variants via [`class-variance-authority`](https://cva.style/) on Button, Badge, etc.

## Layout

### `<AppShell />` (server)
File: `components/layout/app-shell.tsx`
The signed-in shell: sidebar + top bar + main slot. Wraps the dashboard and every `/projects/[id]/*` page.

```tsx
<AppShell sidebar={<ProjectSidebar/>} topBar={<ProjectTopBar/>}>
  {children}
</AppShell>
```

### `<ProjectSidebar project role />` (client)
File: `components/layout/project-sidebar.tsx`
Persistent left nav for a project. Collapsible to 64 px. Items: Overview, Checklist, Records, Conflicts (badge), Manual entries, Activity, Members, Exports, Settings. Active item gets `bg-blue-50 text-blue-800 border-r-2 border-blue-600`.

### `<ProjectTopBar project members role />` (server)
File: `components/layout/project-top-bar.tsx`
Project name, lock badge, member avatars, lock/unlock button. The lock button opens `<LockConfirmDialog/>`.

### `<KeyboardHelp open onClose />` (client)
File: `components/layout/keyboard-help.tsx`
Modal triggered by `?`. Groups: Triage / Navigation / Selection / Help.

## Primitives (shadcn-derived)

| Component | File | Notes |
|---|---|---|
| `<Button variant size icon>` | `components/ui/button.tsx` | variants: `primary` (blue-600), `secondary` (white + surface-3), `ghost`, `danger`, `link`. Sizes: `sm` `md` `lg`. |
| `<Card accent>` | `components/ui/card.tsx` | white + surface-3 border + shadow-card. `accent` adds 2 px blue-600 top stripe. |
| `<Badge tone size icon>` | `components/ui/badge.tsx` | tones: `neutral` `blue` `cyan` `success` `warning` `danger` `outline` `dark`. |
| `<Input/>` `<Textarea/>` | `components/ui/input.tsx` | focus ring is the global one. |
| `<Checkbox/>` `<Radio/>` `<Switch/>` | `components/ui/checkbox.tsx` | blue-600 fill on `checked`. |
| `<Tabs/>` | `components/ui/tabs.tsx` | rarely used; we prefer `<Segmented/>` for view toggles. |
| `<Segmented value onChange options>` | `components/ui/segmented.tsx` | pill-shaped toggle with surface-2 background. |
| `<DropdownMenu/>` | `components/ui/dropdown-menu.tsx` | Radix-based via shadcn. |
| `<Sheet open onClose title subtitle footer width>` | `components/ui/sheet.tsx` | drawer; defaults to right side, 520 px. |
| `<Dialog/>` | `components/ui/dialog.tsx` | shadcn `Dialog`. We wrap as `<ConfirmModal/>` for destructive cases. |
| `<Sonner/>` | `components/ui/sonner.tsx` | shadcn `sonner` setup. Always-on at `<AppShell/>`. |
| `<Avatar initials size title ring />` | `components/ui/avatar.tsx` | deterministic background by initials. |
| `<AvatarStack list max size />` | `components/ui/avatar-stack.tsx` | overlapping pile with `+N` overflow. |

### Sonner toast usage

```ts
import { toast } from "sonner";
toast.success("12 records rejected", {
  description: "Reason: out of stated range",
  action: { label: "Undo", onClick: () => undoLast() },
});
```

## Domain components

### `<SourceChip source size />`
File: `components/insectid/source-chip.tsx`
Source attribution: GBIF (blue), iNat (success), Manual (neutral), Cite (cyan), Merged (outline). Always show this next to any record or taxon name that crosses into UI from a backbone.

### `<InclusionBadge state />`
File: `components/insectid/inclusion-badge.tsx`
`include` → green ✓, `exclude` → neutral ✕, `undecided` → warning. Single source of truth.

### `<CountyChoropleth />`
File: `components/insectid/county-choropleth.tsx` *(`'use client'` — it needs hover state)*

The single-source-of-truth map. Used in Overview, Species detail, Exports panel, and the DOCX export pipeline (via puppeteer-less SSR pass — see `EXPORTS.md`).

```ts
type CountyChoroplethProps = {
  topology:           Topology;                              // pre-loaded topojson
  regionStateCodes:   string[];                              // ['US-IL']
  countyPresence:     Record<string, number>;                // { '17031': 92, ... }
  citeOnlyCounties?:  Set<string>;
  mode?:              'count' | 'binary';                    // viridis vs blue-600 single fill
  size?:              'sm' | 'md' | 'lg' | 'print';
  showLabels?:        boolean;
  showLegend?:        boolean;
  highlightFips?:     string | null;
  onCountyClick?:     (e: { fips: string; name: string; n: number }) => void;
  onCountyHover?:     (e: { fips: string; name: string; n: number } | null) => void;
  ariaLabel?:         string;
};
```

`size='print'` enforces 22 px-equivalent cells and the legend; it's what the export pipeline calls with.

The legend is built from the same `viridis` ramp and is part of the SVG — exports include it.

### `<MiniChoropleth countyPresence mode />`
File: `components/insectid/mini-choropleth.tsx`
Inline-table-sized version for the Checklist row (`112×28` px). Used purely visually; no hover.

### `<PresenceStrip countyPresence n />`
File: `components/insectid/presence-strip.tsx`
Sparkline-style strip of `n` cells encoding the per-county record-count distribution. Sorted descending. Used in compact tables and the Overview "headline species" card.

### `<TaxonAutocomplete value onPick taxa />`
File: `components/insectid/taxon-autocomplete.tsx`
Used in the wizard (queries `/api/taxon-suggest` against both GBIF and iNat) and in `<ManualEntrySheet/>` (queries the current project's taxa with an "+ add new taxon" footer when there's no exact match).

### `<CountyDropdown stateCodes value onChange />`
File: `components/insectid/county-dropdown.tsx`
Cascading dropdown of state → county for cite-only entry. Reads from the same topojson.

### `<RecordCard record taxon onAction />`
File: `components/insectid/record-card.tsx`
The big card in the triage view. Shows image (or stripes-placeholder), locality, date, source attribution, system-inferred badges, action buttons with kbd hints.

### `<ConflictResolver conflict onResolve />`
File: `components/insectid/conflict-resolver.tsx`
The per-row panel under each conflict in `/conflicts`. Four radios. **No default selection**. Disabled "Apply" until something is picked. Custom-name input only shown when `merged` is chosen.

### `<TriageController />` (client)
File: `components/insectid/triage-controller.tsx`
The keyboard-handler island in the species detail page. Owns: current index, J/K/A/R/F/C bindings, the comment composer state. Receives records via props; calls server actions on action.

### `<NextStepRow tone icon title body cta />`
File: `components/insectid/next-step-row.tsx`
Used on the Overview "Next steps" card.

### `<ActivityItem entry actor />`
File: `components/insectid/activity-item.tsx`
Used in the Overview recent-activity sidebar and in the full activity log.

## Data table

We standardize on **one** wrapper used by Checklist, Records, Manual entries, Conflicts, Activity, Members, Exports.

### `<DataTable columns rows getRowId density selection onSelectionChange onRowClick />`

File: `components/insectid/data-table.tsx`. Built on TanStack Table (no headless RT changes).

```ts
type Column<T> = {
  key:        string;
  header:     React.ReactNode;
  align?:     'left' | 'center' | 'right';
  cellClass?: string;
  headerClass?: string;
  sortable?:  boolean;
  render?:    (row: T) => React.ReactNode;
};
```

Built-ins:
- Header row uses `bg-surface-1 border-b border-surface-3` and `[11.5px] uppercase tracking-[0.08em] text-gray-500`.
- Rows alternate not by zebra but by hover. Selected rows: `bg-blue-50/50`.
- `density='compact'` = 8 px y-padding; `'comfortable'` = 10 px.
- Virtualizes (via TanStack Virtual) automatically when `rows.length > 500`.

### `<BulkActionBar count onClear>`

File: `components/insectid/bulk-action-bar.tsx`. Appears above the table when `selection.size > 0`. `bg-blue-800 text-white`.

### `<FilterChip active count onClick>`

File: `components/insectid/filter-chip.tsx`. The chip strip above every list view.

## Forms

We use a thin wrapper around React Hook Form + Zod. Each domain has one `Form*Schema` file co-located with its action. The wizard is one big multi-step form persisted to `sessionStorage` so refresh doesn't lose progress.

## Type exports

`components/insectid/index.ts` re-exports all domain components and types so application code imports from a single path:

```ts
import { CountyChoropleth, SourceChip, InclusionBadge, DataTable } from "@/components/insectid";
```
