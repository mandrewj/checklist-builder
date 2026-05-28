# Open questions

Things I flagged but did not decide. The decisions either depend on info I don't have (real ingest data, client preference, scale we end up at) or are non-blocking polish that should be revisited after the first user round.

The five questions called out in the design brief sit at the top; additional questions follow.

---

## 1. Topojson — bundle everything or lazy-load per project region?

**Status:** punted to bundling for MVP. **Revisit when:** a project's region selects ≥3 states/provinces and the page-load weight becomes user-visible.

- **Bundled now:** `/public/topojson/us-counties.json` (480 KB, 110 KB gz) and `/public/topojson/ca-cdivs.json` (218 KB, 52 KB gz). Both load on the workspace layout. Total cold load adds ~160 KB compressed.
- **Lazy alternative:** split into per-state files (`us-il.json`, `us-ia.json`, …) and load only the ones a project's `region_codes` reference. Saves ~140 KB on single-state projects; adds a fetch waterfall on map first render.
- **Recommendation if reopened:** lazy. The work is mostly a build step that pre-splits the topojson; the runtime change is a `Promise.all(region_codes.map(load))`.

## 2. Long-running GBIF ingest UX — blocking, background, or live?

**Status:** **live progress in the wizard, then continues in background** if the user navigates away. Activity-log entry posted on completion. **No email** in MVP.

- **Considered:** blocking modal (user is stuck), background-with-email (overkill for projects that finish in <2 minutes), live progress only (what I shipped).
- **Open:** should we send an email via Clerk/Resend when an *unattended* ingest finishes? Useful when the user starts at end-of-day. Cheap to add behind a project-level toggle.

## 3. Records with only state-level locality — bucket, assignable, or hidden?

**Status:** **bucket, badged, surfaced**. They appear in a "no county" section in the Species detail records list with a `system-inferred: missing county` badge. The choropleth does not display them; the species' record count includes them; the records *can* be manually assigned a county via the record card.

- **What I want the entomologist to confirm:** is it acceptable that the species' total record count diverges from the sum of county counts? If not, we either move them to "rejected" by default or invert the model and count only county-resolvable records.

## 4. Citation parsing for cite-only records — free text or CSL-JSON?

**Status:** **free text in MVP**, with optional DOI field. Stored as a single column.

- **What's missing:** clean references list in the DOCX export. Today we emit the raw string; with CSL-JSON we could format consistently (APA, CSE, Zootaxa) and even auto-generate `references.bib`.
- **Recommendation:** ship a "Convert to structured" affordance later that uses the DOI to fetch CSL-JSON from `data.crossref.org`. Until then, the user copy-edits citations in the DOCX.

## 5. iNat image thumbnails — hot-link or cache to Vercel Blob?

**Status:** **hot-link** in MVP.

- **Risk:** iNat's CDN URLs are reasonably stable but not contractually permanent. A locked snapshot exported in 2026 may show broken thumbnails by 2030.
- **Cost of caching:** thumbnails are ~30 KB each; a typical project with 1 500 iNat records that have media → 45 MB of Blob, which is fine. The implementation is a one-time mirror on lock.
- **Recommendation:** cache on lock. Free until exports become the canonical preservation copy.

---

## Additional questions I want a second opinion on

### 6. Default DwC-A license

DwC norms tend toward CC0-1.0; some labs want CC-BY-NC. MVP hardcodes CC0; the right shape is a project setting with the default surfaced at lock time. Flagged for the first lock conversation with a real lab.

### 7. Reviewer "looks good" / "needs another look" semantics

The brief specifies Reviewers can mark records "looks good" or "needs another look". Today I lumped this into `flag` with a reason-text convention. The cleaner model is a separate `reviewer_marks` table (per record per reviewer). Pragmatically: do reviewers actually use this when they can already comment? Worth a usability call with the entomologist.

### 8. Conflict resolution affecting prior comments

When a conflict is resolved as *merged*, comments on the two former species need to migrate to the merged taxon. Today the action does that automatically. I'm uneasy about it without auditing the comment migration in the activity log. Right move: drop a `parentTaxonId` reference on each migrated comment for traceability.

### 9. Export against an *unlocked* preview snapshot

The brief is clear: exports run against locked snapshots only. But during heavy triage, a contributor might want a "preview" CSV to spot-check in Excel. Worth a quick "Preview CSV (not for citation)" affordance that emits an artifact with a `preview_` prefix and no `snapshot_id`.

### 10. Activity-log retention

Currently append-forever. A 10-year project could accumulate ~100 k rows. That's fine in Postgres but the UI's filter performance starts to wobble around 30 k. The right move is virtualization on the Activity table (we already use it on records); follow up if any project actually gets there.

### 11. Multi-region projects + composite maps

Composite small-multiples in the manuscript pack assume a single bounding box (Indiana fits 8.5×11). For a multi-state region (e.g., Eastern Great Lakes = IN/OH/MI), the composite layout needs a different grid (3×4 horizontal vs 4×3 vertical) chosen by aspect ratio. MVP renders multi-region as a single big map per species; flagged for the first multi-state project.id (3×4 horizontal vs 4×3 vertical) chosen by aspect ratio. MVP renders multi-region as a single big map per species; flagged for the first multi-state project.

### 12. Coordinate precision threshold

I use **4 decimal places** (~11 m) as the cutoff for "precise enough to assign a county." Some entomologists work from gazetteer data where precision is intentionally coarsened — they'd want 3 decimal places (~111 m). Worth exposing as a per-project setting under Settings → Ingest filters.

### 13. Federally listed species and obscured iNat coordinates

Several darkling beetles are species of conservation concern in the eastern US; iNat obscures coordinates for vulnerable taxa, which means our reverse-geocoding sometimes fails or assigns the wrong county. We should detect the `obscured` flag in iNat responses and treat such records as state-level only (see Q3). Flagged for the first project that includes T&E species.scured flag in iNat responses and treat them as state-level only (see Q3). Flagged for the first project that includes T&E species.

---

## Decisions I made unilaterally that the engineer should know about

These aren't open questions — I picked an approach — but they're worth surfacing so they're not surprises:

- **Tab vs sheet for record detail.** I went with **inline drawer** (`<Sheet/>`) opened from the triage list. Considered a separate route; the route loses the list context.
- **One project per Lead at minimum, multiple Leads allowed.** The spec said "always at least one Lead"; I allow 2+ Leads with no max.
- **Soft delete: none.** Project delete is irreversible. Activity log is the recovery story.
- **`?` opens keyboard help everywhere**, not just in triage. The spec said "show on `?`"; I generalized.
- **No "publish" state.** Spec is clear on this; mentioning it here so an over-eager future PM doesn't add one.
