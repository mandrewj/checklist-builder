/**
 * Tenebrionidae of Indiana (2018–2024) — reference dataset.
 *
 * Faithful TypeScript port of the prototype's `src/data.jsx`. Generation is
 * deterministic (same LCG seed) so output is stable across runs and matches
 * the prototype HTML cell-for-cell where it can.
 *
 * Affiliation: Insect Diversity & Diagnostics Lab, Department of Entomology,
 * Purdue University.
 */

// ---------------------------------------------------------------------------
// Static reference data
// ---------------------------------------------------------------------------

/** All 92 Indiana counties — [FIPS, name]. */
export const INDIANA_COUNTIES: ReadonlyArray<readonly [string, string]> = [
  ["18001", "Adams"], ["18003", "Allen"], ["18005", "Bartholomew"],
  ["18007", "Benton"], ["18009", "Blackford"], ["18011", "Boone"],
  ["18013", "Brown"], ["18015", "Carroll"], ["18017", "Cass"],
  ["18019", "Clark"], ["18021", "Clay"], ["18023", "Clinton"],
  ["18025", "Crawford"], ["18027", "Daviess"], ["18029", "Dearborn"],
  ["18031", "Decatur"], ["18033", "DeKalb"], ["18035", "Delaware"],
  ["18037", "Dubois"], ["18039", "Elkhart"], ["18041", "Fayette"],
  ["18043", "Floyd"], ["18045", "Fountain"], ["18047", "Franklin"],
  ["18049", "Fulton"], ["18051", "Gibson"], ["18053", "Grant"],
  ["18055", "Greene"], ["18057", "Hamilton"], ["18059", "Hancock"],
  ["18061", "Harrison"], ["18063", "Hendricks"], ["18065", "Henry"],
  ["18067", "Howard"], ["18069", "Huntington"], ["18071", "Jackson"],
  ["18073", "Jasper"], ["18075", "Jay"], ["18077", "Jefferson"],
  ["18079", "Jennings"], ["18081", "Johnson"], ["18083", "Knox"],
  ["18085", "Kosciusko"], ["18087", "LaGrange"], ["18089", "Lake"],
  ["18091", "LaPorte"], ["18093", "Lawrence"], ["18095", "Madison"],
  ["18097", "Marion"], ["18099", "Marshall"], ["18101", "Martin"],
  ["18103", "Miami"], ["18105", "Monroe"], ["18107", "Montgomery"],
  ["18109", "Morgan"], ["18111", "Newton"], ["18113", "Noble"],
  ["18115", "Ohio"], ["18117", "Orange"], ["18119", "Owen"],
  ["18121", "Parke"], ["18123", "Perry"], ["18125", "Pike"],
  ["18127", "Porter"], ["18129", "Posey"], ["18131", "Pulaski"],
  ["18133", "Putnam"], ["18135", "Randolph"], ["18137", "Ripley"],
  ["18139", "Rush"], ["18141", "St. Joseph"], ["18143", "Scott"],
  ["18145", "Shelby"], ["18147", "Spencer"], ["18149", "Starke"],
  ["18151", "Steuben"], ["18153", "Sullivan"], ["18155", "Switzerland"],
  ["18157", "Tippecanoe"], ["18159", "Tipton"], ["18161", "Union"],
  ["18163", "Vanderburgh"], ["18165", "Vermillion"], ["18167", "Vigo"],
  ["18169", "Wabash"], ["18171", "Warren"], ["18173", "Warrick"],
  ["18175", "Washington"], ["18177", "Wayne"], ["18179", "Wells"],
  ["18181", "White"], ["18183", "Whitley"],
];

const COUNTY_BY_FIPS = new Map(INDIANA_COUNTIES);

export const FAMILY = {
  TENEBRIONIDAE: "Tenebrionidae",
  CARABIDAE: "Carabidae",
  CERAMBYCIDAE: "Cerambycidae",
  ZOPHERIDAE: "Zopheridae",
  TETRATOMIDAE: "Tetratomidae",
} as const;

export const SUBFAMILY = {
  TENEBRIONINAE: "Tenebrioninae",
  DIAPERINAE: "Diaperinae",
  ALLECULINAE: "Alleculinae",
  STENOCHIINAE: "Stenochiinae",
  PIMELIINAE: "Pimeliinae",
} as const;

// ---------------------------------------------------------------------------
// Deterministic PRNG — same LCG as src/data.jsx so generated rows match.
// ---------------------------------------------------------------------------

function makeRng(seed = 4477): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ---------------------------------------------------------------------------
// Taxa seed — 23 darkling-beetle species across all 92 Indiana counties.
// ---------------------------------------------------------------------------

type Inclusion = "include" | "exclude" | "undecided";
type Source = "gbif" | "inat" | "manual" | "cite";

interface TaxonSeed {
  id: string;
  scientificName: string;
  authority: string;
  family: string;
  subfamily: string;
  rank: "species";
  inclusion: Inclusion;
  nRecords: number;
  nCounties: number;
  hasConflict: boolean;
  sources: Array<"gbif" | "inat">;
  countyPresence: Record<string, number>;
  inclusionReasoning: string;
  gbifKey?: number;
  inatId?: number;
}

const TAXA_RAW: Array<
  [string, string, string, string, Inclusion, number, number, boolean, Array<"gbif" | "inat">]
> = [
  ["Alobates pennsylvanicus",   "(DeGeer, 1775)",              FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "include",   612, 78, true,  ["gbif", "inat"]],
  ["Alobates barbata",          "(Knoch, 1801)",               FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "include",   238, 54, false, ["gbif", "inat"]],
  ["Bolitotherus cornutus",     "(Panzer, 1794)",              FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",   404, 71, false, ["gbif", "inat"]],
  ["Centronopus calcaratus",    "(Fabricius, 1798)",           FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "include",   181, 42, false, ["gbif", "inat"]],
  ["Diaperis maculata",         "Olivier, 1791",               FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",    97, 31, true,  ["gbif", "inat"]],
  ["Diaperis hydni",            "(Fabricius, 1781)",           FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",    72, 26, false, ["gbif", "inat"]],
  ["Eleates depressus",         "(Randall, 1838)",             FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",    44, 19, false, ["gbif", "inat"]],
  ["Hymenorus pilosus",         "(Melsheimer, 1846)",          FAMILY.TENEBRIONIDAE, SUBFAMILY.ALLECULINAE,   "undecided",  61, 24, true,  ["gbif", "inat"]],
  ["Hymenorus densus",          "(Melsheimer, 1846)",          FAMILY.TENEBRIONIDAE, SUBFAMILY.ALLECULINAE,   "undecided",  29, 14, false, ["gbif", "inat"]],
  ["Mycetochara fraterna",      "(Say, 1827)",                 FAMILY.TENEBRIONIDAE, SUBFAMILY.ALLECULINAE,   "undecided",  16,  9, false, ["gbif"]],
  ["Neatus tenebrioides",       "(Palisot de Beauvois, 1817)", FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "include",    88, 28, false, ["gbif", "inat"]],
  ["Platydema americanum",      "Laporte & Brullé, 1831",      FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",    52, 21, false, ["gbif", "inat"]],
  ["Platydema ellipticum",      "(Fabricius, 1801)",           FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",    34, 16, false, ["gbif", "inat"]],
  ["Platydema ruficorne",       "(Sturm, 1826)",               FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "include",    27, 13, false, ["gbif", "inat"]],
  ["Platydema subcostatum",     "Laporte & Brullé, 1831",      FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    "undecided",  11,  8, false, ["gbif"]],
  ["Polypleurus perforatus",    "(Germar, 1824)",              FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "include",    19, 11, false, ["gbif", "inat"]],
  ["Strongylium tenuicolle",    "(Say, 1824)",                 FAMILY.TENEBRIONIDAE, SUBFAMILY.STENOCHIINAE,  "include",    24, 12, false, ["gbif", "inat"]],
  ["Tarpela micans",            "(Fabricius, 1798)",           FAMILY.TENEBRIONIDAE, SUBFAMILY.STENOCHIINAE,  "include",    41, 18, false, ["gbif", "inat"]],
  ["Uloma impressa",            "Melsheimer, 1846",            FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "undecided",  17, 10, false, ["gbif", "inat"]],
  ["Uloma punctulata",          "LeConte, 1862",               FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "undecided",   8,  6, false, ["gbif"]],
  ["Tenebrio molitor",          "Linnaeus, 1758",              FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "exclude",  1842, 92, false, ["gbif", "inat"]],
  ["Tenebrio obscurus",         "Fabricius, 1792",             FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "exclude",   287, 64, false, ["gbif", "inat"]],
  ["Helops aereus",             "Germar, 1824",                FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, "exclude",    12,  7, false, ["inat"]],
];

// Stable external taxon ids — only filled where the prototype names them or
// where the headline species needs them for cross-source linking.
const TAXON_EXTERNAL_IDS: Partial<Record<string, { gbifKey?: number; inatId?: number }>> = {
  "Alobates pennsylvanicus": { gbifKey: 4734451, inatId: 127344 },
};

function inclusionReasoningFor(name: string, inclusion: Inclusion): string {
  if (inclusion !== "exclude") return "";
  if (name === "Tenebrio molitor" || name === "Tenebrio obscurus") {
    return "Synanthropic / introduced cosmopolitan mealworm; excluded per project scope (native fauna only).";
  }
  if (name === "Helops aereus") {
    return "European import; iNat records likely misidentifications of native Helopini.";
  }
  return "Out of region or insufficient documentation.";
}

function buildCountyPresence(
  rng: () => number,
  nCounties: number,
  totalRecords: number,
): Record<string, number> {
  const fipsList = INDIANA_COUNTIES.map((c) => c[0]);
  const chosen = new Set<string>();
  while (chosen.size < nCounties) {
    chosen.add(fipsList[Math.floor(rng() * fipsList.length)]);
  }
  const arr = Array.from(chosen);
  const out: Record<string, number> = {};
  let remaining = totalRecords;
  arr.forEach((fips, i) => {
    const isLast = i === arr.length - 1;
    const v = isLast
      ? remaining
      : Math.max(
          1,
          Math.floor(rng() * Math.min(remaining / 2, totalRecords * 0.15)),
        );
    out[fips] = Math.min(v, remaining);
    remaining -= out[fips];
  });
  if (remaining > 0) {
    const top = arr.sort((a, b) => out[b] - out[a])[0];
    out[top] += remaining;
  }
  return out;
}

const taxaRng = makeRng();

export const TAXA: ReadonlyArray<TaxonSeed> = TAXA_RAW.map((row, i) => {
  const [
    scientificName,
    authority,
    family,
    subfamily,
    inclusion,
    nRecords,
    nCounties,
    hasConflict,
    sources,
  ] = row;
  const ext = TAXON_EXTERNAL_IDS[scientificName];
  return {
    id: `t${i + 1}`,
    scientificName,
    authority,
    family,
    subfamily,
    rank: "species" as const,
    inclusion,
    nRecords,
    nCounties,
    hasConflict,
    sources,
    countyPresence: buildCountyPresence(taxaRng, nCounties, nRecords),
    inclusionReasoning: inclusionReasoningFor(scientificName, inclusion),
    gbifKey: ext?.gbifKey,
    inatId: ext?.inatId,
  };
});

// ---------------------------------------------------------------------------
// Records — only generated for the 4 taxa the prototype demos in detail,
// plus 4 hand-written entries for t11 (Neatus tenebrioides). The other taxa
// have presence aggregated into `countyPresence` only.
// ---------------------------------------------------------------------------

type RecordStatus = "pending" | "accepted" | "rejected" | "flagged";

export interface RecordSeed {
  id: string;
  taxonId: string;
  source: Source;
  externalId: string;
  state: string;
  county: string;
  countyFips: string;
  lat: number;
  lng: number;
  observedAt: string; // YYYY-MM-DD
  collector: string;
  inatQuality: "research" | "needs_id" | null;
  imageUrl: string | null;
  status: RecordStatus;
  flagReason?: string;
  isLikelyOutOfRange: boolean;
  citation?: string;
  doi?: string;
  notes?: string;
  addedBy?: string;
  addedAt?: string;
}

function buildRecords(
  rng: () => number,
  taxonId: string,
  count: number,
  opts: { someOutOfRange?: boolean } = {},
): RecordSeed[] {
  const baseDate = new Date("2018-06-15").getTime();
  const fipsList = INDIANA_COUNTIES.map((c) => c[0]);
  const collectors = [
    "M. Patel", "D. Chen", "R. Okafor", "A. Ramirez",
    "J. Liu", "C. Knapp", "—",
  ];
  const out: RecordSeed[] = [];

  for (let i = 0; i < count; i++) {
    const r = rng();
    const fips = fipsList[Math.floor(rng() * fipsList.length)];
    const county = COUNTY_BY_FIPS.get(fips) ?? "Unknown";
    const source: Source = r < 0.5 ? "gbif" : r < 0.93 ? "inat" : "manual";
    const status: RecordStatus =
      i < 4 ? (i === 0 ? "flagged" : "pending") : "accepted";
    const isOutOfRange = !!opts.someOutOfRange && i % 11 === 3;
    const externalId =
      source === "gbif"
        ? `GBIF:${3_000_000_000 + Math.floor(rng() * 9_000_000)}`
        : source === "inat"
          ? `iNat:${90_000_000 + Math.floor(rng() * 9_000_000)}`
          : `manual-${taxonId}-${i}`;
    out.push({
      id: `${taxonId}-r${i + 1}`,
      taxonId,
      source,
      externalId,
      state: "Indiana",
      county,
      countyFips: fips,
      lat: 37.8 + rng() * 3.6,
      lng: -88 + rng() * 3,
      observedAt: new Date(baseDate + Math.floor(rng() * 250) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      collector: collectors[Math.floor(rng() * collectors.length)],
      inatQuality:
        source === "inat" ? (rng() < 0.7 ? "research" : "needs_id") : null,
      imageUrl: source === "inat" && rng() < 0.6 ? "thumb" : null,
      status,
      flagReason:
        status === "flagged"
          ? "Locality precision >10 km — needs follow-up."
          : undefined,
      isLikelyOutOfRange: isOutOfRange,
    });
  }
  if (opts.someOutOfRange) {
    [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25].forEach((i) => {
      if (out[i]) out[i].isLikelyOutOfRange = true;
    });
  }
  return out;
}

const t11HandWritten: RecordSeed[] = [
  {
    id: "t11-r1", taxonId: "t11", source: "gbif", externalId: "GBIF:3038201044",
    state: "Indiana", county: "Tippecanoe", countyFips: "18157",
    lat: 40.43, lng: -86.91, observedAt: "2019-07-14",
    collector: "C. Knapp", inatQuality: null, imageUrl: null,
    status: "accepted", isLikelyOutOfRange: false,
  },
  {
    id: "t11-r2", taxonId: "t11", source: "inat", externalId: "iNat:96100211",
    state: "Indiana", county: "Marion", countyFips: "18097",
    lat: 39.78, lng: -86.16, observedAt: "2021-08-02",
    collector: "D. Chen", inatQuality: "research", imageUrl: "thumb",
    status: "accepted", isLikelyOutOfRange: false,
  },
  {
    id: "t11-r3", taxonId: "t11", source: "gbif", externalId: "GBIF:3041102773",
    state: "Indiana", county: "Monroe", countyFips: "18105",
    lat: 39.17, lng: -86.52, observedAt: "2020-06-21",
    collector: "R. Okafor", inatQuality: null, imageUrl: null,
    status: "flagged", flagReason: "Date precision: only month known.",
    isLikelyOutOfRange: false,
  },
  {
    id: "t11-r4", taxonId: "t11", source: "inat", externalId: "iNat:104550819",
    state: "Indiana", county: "St. Joseph", countyFips: "18141",
    lat: 41.68, lng: -86.25, observedAt: "2022-08-30",
    collector: "A. Ramirez", inatQuality: "research", imageUrl: "thumb",
    status: "accepted", isLikelyOutOfRange: false,
  },
];

// Single RNG shared across all generated record sets — mirrors the prototype's
// single global RNG. This ensures externalIds are unique across taxa.
const recordsRng = makeRng();

export const RECORDS_BY_TAXON: Readonly<Record<string, RecordSeed[]>> = {
  t1: buildRecords(recordsRng, "t1", 47, { someOutOfRange: true }),
  t2: buildRecords(recordsRng, "t2", 32),
  t3: buildRecords(recordsRng, "t3", 28),
  t4: buildRecords(recordsRng, "t4", 22),
  t11: t11HandWritten,
};

// ---------------------------------------------------------------------------
// Taxonomic conflicts — three seeded GBIF↔iNat disagreements. No resolution.
// ---------------------------------------------------------------------------

export interface ConflictSeed {
  id: string;
  taxonId: string;
  gbifName: string;
  gbifAuthority: string;
  inatName: string;
  inatAuthority: string;
  gbifRecords: number;
  inatRecords: number;
  note: string;
}

export const CONFLICTS: ReadonlyArray<ConflictSeed> = [
  {
    id: "c1",
    taxonId: "t1",
    gbifName: "Alobates pennsylvanicus",
    gbifAuthority: "(DeGeer, 1775)",
    inatName: "Alobates pensylvanicus",
    inatAuthority: "(DeGeer, 1775)",
    gbifRecords: 472,
    inatRecords: 140,
    note: "iNaturalist uses the historical (one-n) spelling; GBIF backbone adopted the two-n correction after Bouchard et al. (2021). Same concept, different orthography.",
  },
  {
    id: "c2",
    taxonId: "t5",
    gbifName: "Diaperis maculata",
    gbifAuthority: "Olivier, 1791",
    inatName: "Diaperis maculata maculata",
    inatAuthority: "Olivier, 1791",
    gbifRecords: 71,
    inatRecords: 26,
    note: "iNat treats the nominate subspecies separately; GBIF holds species rank only. Doyen (1989) considered intraspecific variation non-trivial but unresolved.",
  },
  {
    id: "c3",
    taxonId: "t8",
    gbifName: "Hymenorus pilosus",
    gbifAuthority: "(Melsheimer, 1846)",
    inatName: "Hymenorus niger",
    inatAuthority: "(Melsheimer, 1846)",
    gbifRecords: 38,
    inatRecords: 23,
    note: "Campbell (1966) treated H. niger as senior synonym of H. pilosus; GBIF backbone retains H. pilosus pending review by Steiner & Triplehorn.",
  },
];

// ---------------------------------------------------------------------------
// Cite-only / manual entries — two seeded literature records.
// ---------------------------------------------------------------------------

export interface ManualEntrySeed {
  id: string;
  taxonId: string;
  taxonName: string;
  county: string;
  countyFips: string;
  citation: string;
  doi: string;
  notes: string;
  addedBy: string;
  addedAt: string;
}

export const MANUAL_ENTRIES: ReadonlyArray<ManualEntrySeed> = [
  {
    id: "m1",
    taxonId: "t11",
    taxonName: "Neatus tenebrioides",
    county: "Tippecanoe",
    countyFips: "18157",
    citation:
      "Blatchley, W.S. (1910). An Illustrated Descriptive Catalogue of the Coleoptera or Beetles (Exclusive of the Rhynchophora) Known to Occur in Indiana. Indianapolis: The Nature Publishing Company.",
    doi: "",
    notes:
      "Foundational Blatchley catalogue — Lafayette voucher cited at p. 1244. Not in GBIF.",
    addedBy: "u1",
    addedAt: "2026-04-22T16:11:00Z",
  },
  {
    id: "m2",
    taxonId: "t4",
    taxonName: "Centronopus calcaratus",
    county: "Monroe",
    countyFips: "18105",
    citation:
      "Steiner, W.E. & Triplehorn, C.A. (2010). The genera of darkling beetles (Coleoptera: Tenebrionidae) of eastern North America. Insecta Mundi 0146: 1–66.",
    doi: "10.5281/zenodo.4456789",
    notes:
      "County listed in distribution table for Steiner & Triplehorn revision; specimens at PERC.",
    addedBy: "u2",
    addedAt: "2026-04-25T09:48:00Z",
  },
];

// ---------------------------------------------------------------------------
// Members & projects
// ---------------------------------------------------------------------------

export interface MemberSeed {
  id: string;
  initials: string;
  name: string;
  email: string;
  role: "Lead" | "Contributor" | "Reviewer";
  joined: string;
  affiliation: string;
}

export const MEMBERS: ReadonlyArray<MemberSeed> = [
  { id: "u1", initials: "MP", name: "Maya Patel",   email: "mpatel@purdue.edu",       role: "Lead",        joined: "2026-03-02", affiliation: "Insect Diversity & Diagnostics Lab · Purdue" },
  { id: "u2", initials: "JL", name: "Jordan Liu",   email: "jliu@purdue.edu",         role: "Contributor", joined: "2026-03-04", affiliation: "Insect Diversity & Diagnostics Lab · Purdue" },
  { id: "u3", initials: "AR", name: "Ana Ramírez",  email: "aramirez@purdue.edu",     role: "Contributor", joined: "2026-03-09", affiliation: "Purdue Entomological Research Collection" },
  { id: "u4", initials: "DC", name: "Dimitri Chen", email: "dchen@purdue.edu",        role: "Reviewer",    joined: "2026-04-01", affiliation: "Plant & Pest Diagnostic Lab · Purdue" },
  { id: "u5", initials: "RO", name: "Rita Okafor",  email: "rokafor@fieldmuseum.org", role: "Contributor", joined: "2026-04-12", affiliation: "Field Museum of Natural History" },
];

export interface ProjectSeed {
  id: string;
  name: string;
  taxonQuery: string;
  region: string;
  regionCodes: string[];
  ownerUserId: string;
  nSpecies: number;
  nRecords: number;
  nCounties: number;
  nConflicts: number;
  lastActivity: string;
  locked: boolean;
  description: string;
}

export const PROJECTS: ReadonlyArray<ProjectSeed> = [
  {
    id: "p1",
    name: "Tenebrionidae of Indiana (2018–2024)",
    taxonQuery: "Tenebrionidae",
    region: "Indiana",
    regionCodes: ["US-IN"],
    ownerUserId: "u1",
    nSpecies: 23,
    nRecords: 4221,
    nCounties: 92,
    nConflicts: 3,
    lastActivity: "2026-05-22T14:22:00Z",
    locked: false,
    description:
      "Comprehensive checklist of darkling beetles of Indiana with county-level distribution. Output is the supplementary checklist for Patel et al. (in prep.) and the curated voucher set for the Purdue Entomological Research Collection.",
  },
  {
    id: "p2",
    name: "Cerambycidae of the Eastern Great Lakes",
    taxonQuery: "Cerambycidae",
    region: "IN · OH · MI",
    regionCodes: ["US-IN", "US-OH", "US-MI"],
    ownerUserId: "u1",
    nSpecies: 58,
    nRecords: 7902,
    nCounties: 248,
    nConflicts: 0,
    lastActivity: "2026-05-19T19:01:00Z",
    locked: true,
    description:
      "Longhorned beetles of IN/OH/MI. Locked snapshot for the Mosquin et al. supplementary tables; ROM bulletin reviewer copy.",
  },
  {
    id: "p3",
    name: "Sphecidae of Indiana",
    taxonQuery: "Sphecidae",
    region: "Indiana",
    regionCodes: ["US-IN"],
    ownerUserId: "u3",
    nSpecies: 36,
    nRecords: 1147,
    nCounties: 71,
    nConflicts: 1,
    lastActivity: "2026-05-15T11:48:00Z",
    locked: false,
    description:
      "Thread-waisted wasps of Indiana — review of the Knapp & Ramírez project, prepping for the next Insect Diversity Lab faunal bulletin.",
  },
  {
    id: "p4",
    name: "Curculionidae of the Wabash Valley",
    taxonQuery: "Curculionidae (selected genera)",
    region: "IN · IL",
    regionCodes: ["US-IN", "US-IL"],
    ownerUserId: "u2",
    nSpecies: 9,
    nRecords: 134,
    nCounties: 22,
    nConflicts: 0,
    lastActivity: "2026-05-09T08:30:00Z",
    locked: false,
    description:
      "Early-stage scoping for weevils along the Wabash drainage — pollination ecology side project.",
  },
];

// ---------------------------------------------------------------------------
// Comments & activity log
// ---------------------------------------------------------------------------

export interface CommentSeed {
  id: string;
  taxonId: string;
  authorUserId: string;
  ts: string;
  text: string;
}

export const COMMENTS: ReadonlyArray<CommentSeed> = [
  { id: "cm1", taxonId: "t1", authorUserId: "u2", ts: "2026-05-20T11:09:00Z", text: 'Dropped 12 records from southern IN with locality precision >25 km. Bulk-rejected with "out of stated range" reason.' },
  { id: "cm2", taxonId: "t1", authorUserId: "u1", ts: "2026-05-22T14:21:00Z", text: "Looks good to include. Cross-checked against Steiner & Triplehorn (2010) and 2024 PERC accessions." },
  { id: "cm3", taxonId: "t8", authorUserId: "u3", ts: "2026-04-22T15:01:00Z", text: "Holding H. pilosus inclusion — Campbell (1966) synonymized this under H. niger but the synonymy is contested. See Conflicts panel." },
];

export interface ActivitySeed {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  ts: string;
  detail: string;
}

export const ACTIVITY: ReadonlyArray<ActivitySeed> = [
  { id: "a1", actorUserId: "u1", action: "include",       targetType: "taxon",    targetId: "t1", ts: "2026-05-22T14:22:00Z", detail: "Marked species as INCLUDED" },
  { id: "a2", actorUserId: "u2", action: "comment",       targetType: "taxon",    targetId: "t8", ts: "2026-05-22T11:09:00Z", detail: '"Holding inclusion until Campbell synonymy is settled in the conflicts panel."' },
  { id: "a3", actorUserId: "u3", action: "reject",        targetType: "taxon",    targetId: "t1", ts: "2026-05-21T16:44:00Z", detail: "Bulk rejected — locality precision >25 km" },
  { id: "a4", actorUserId: "u1", action: "add_manual",    targetType: "record",   targetId: "m1", ts: "2026-04-22T16:11:00Z", detail: "Cite-only record (Blatchley 1910)" },
  { id: "a5", actorUserId: "u2", action: "conflict_open", targetType: "conflict", targetId: "c1", ts: "2026-04-19T10:02:00Z", detail: "GBIF/iNat orthography conflict flagged for review" },
  { id: "a6", actorUserId: "u3", action: "flag",          targetType: "record",   targetId: "t1-r1", ts: "2026-04-18T15:31:00Z", detail: "Flagged for review: locality precision >10 km" },
  { id: "a7", actorUserId: "u1", action: "ingest",        targetType: "project",  targetId: "p1", ts: "2026-03-02T09:14:00Z", detail: "Initial GBIF + iNat pull — 4,221 records across 28 candidate taxa" },
  { id: "a8", actorUserId: "u1", action: "create",        targetType: "project",  targetId: "p1", ts: "2026-03-02T09:11:00Z", detail: 'Created project "Tenebrionidae of Indiana (2018–2024)"' },
];
