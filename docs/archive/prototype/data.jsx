/* global window */
// =========================================================================
// Mock data — Tenebrionidae of Indiana project + a few siblings.
// Affiliated with the Insect Diversity and Diagnostics Lab, Department of
// Entomology, Purdue University.
// All data is inline; no network. Keep keys stable across screens so
// state mutations (include/exclude, resolve conflict, etc.) work end-to-end.
// =========================================================================

const INDIANA_COUNTIES = [
  // 92 Indiana counties (alphabetical). FIPS codes prefixed with 18.
  ["18001","Adams"],["18003","Allen"],["18005","Bartholomew"],["18007","Benton"],["18009","Blackford"],
  ["18011","Boone"],["18013","Brown"],["18015","Carroll"],["18017","Cass"],["18019","Clark"],
  ["18021","Clay"],["18023","Clinton"],["18025","Crawford"],["18027","Daviess"],["18029","Dearborn"],
  ["18031","Decatur"],["18033","DeKalb"],["18035","Delaware"],["18037","Dubois"],["18039","Elkhart"],
  ["18041","Fayette"],["18043","Floyd"],["18045","Fountain"],["18047","Franklin"],["18049","Fulton"],
  ["18051","Gibson"],["18053","Grant"],["18055","Greene"],["18057","Hamilton"],["18059","Hancock"],
  ["18061","Harrison"],["18063","Hendricks"],["18065","Henry"],["18067","Howard"],["18069","Huntington"],
  ["18071","Jackson"],["18073","Jasper"],["18075","Jay"],["18077","Jefferson"],["18079","Jennings"],
  ["18081","Johnson"],["18083","Knox"],["18085","Kosciusko"],["18087","LaGrange"],["18089","Lake"],
  ["18091","LaPorte"],["18093","Lawrence"],["18095","Madison"],["18097","Marion"],["18099","Marshall"],
  ["18101","Martin"],["18103","Miami"],["18105","Monroe"],["18107","Montgomery"],["18109","Morgan"],
  ["18111","Newton"],["18113","Noble"],["18115","Ohio"],["18117","Orange"],["18119","Owen"],
  ["18121","Parke"],["18123","Perry"],["18125","Pike"],["18127","Porter"],["18129","Posey"],
  ["18131","Pulaski"],["18133","Putnam"],["18135","Randolph"],["18137","Ripley"],["18139","Rush"],
  ["18141","St. Joseph"],["18143","Scott"],["18145","Shelby"],["18147","Spencer"],["18149","Starke"],
  ["18151","Steuben"],["18153","Sullivan"],["18155","Switzerland"],["18157","Tippecanoe"],["18159","Tipton"],
  ["18161","Union"],["18163","Vanderburgh"],["18165","Vermillion"],["18167","Vigo"],["18169","Wabash"],
  ["18171","Warren"],["18173","Warrick"],["18175","Washington"],["18177","Wayne"],["18179","Wells"],
  ["18181","White"],["18183","Whitley"]
];

const FAMILY = {
  TENEBRIONIDAE: 'Tenebrionidae',
  CARABIDAE: 'Carabidae',
  CERAMBYCIDAE: 'Cerambycidae',
  ZOPHERIDAE: 'Zopheridae',           // sister family that historically intermixed
  TETRATOMIDAE: 'Tetratomidae',       // formerly tenebrionid genera
};

// Subfamily tag carried alongside family for stratified filtering.
const SUBFAMILY = {
  TENEBRIONINAE: 'Tenebrioninae',
  DIAPERINAE: 'Diaperinae',
  ALLECULINAE: 'Alleculinae',
  STENOCHIINAE: 'Stenochiinae',
  PIMELIINAE: 'Pimeliinae',
};

// Tenebrionidae of Indiana — realistic but curated species list.
// Inclusion: 'include' | 'exclude' | 'undecided'
// Columns: [scientificName, authority, family, subfamily, inclusion, nRecords, nCounties, hasConflict, sources]
const TAXA_SEED = [
  ['Alobates pennsylvanicus',   '(DeGeer, 1775)',          FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'include',   612, 78, true,  ['gbif','inat']],
  ['Alobates barbata',          '(Knoch, 1801)',           FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'include',   238, 54, false, ['gbif','inat']],
  ['Bolitotherus cornutus',     '(Panzer, 1794)',          FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',   404, 71, false, ['gbif','inat']],
  ['Centronopus calcaratus',    '(Fabricius, 1798)',       FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'include',   181, 42, false, ['gbif','inat']],
  ['Diaperis maculata',         'Olivier, 1791',           FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',    97, 31, true,  ['gbif','inat']],
  ['Diaperis hydni',            '(Fabricius, 1781)',       FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',    72, 26, false, ['gbif','inat']],
  ['Eleates depressus',         '(Randall, 1838)',         FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',    44, 19, false, ['gbif','inat']],
  ['Hymenorus pilosus',         '(Melsheimer, 1846)',      FAMILY.TENEBRIONIDAE, SUBFAMILY.ALLECULINAE,   'undecided',  61, 24, true,  ['gbif','inat']],
  ['Hymenorus densus',          '(Melsheimer, 1846)',      FAMILY.TENEBRIONIDAE, SUBFAMILY.ALLECULINAE,   'undecided',  29, 14, false, ['gbif','inat']],
  ['Mycetochara fraterna',      '(Say, 1827)',             FAMILY.TENEBRIONIDAE, SUBFAMILY.ALLECULINAE,   'undecided',  16,  9, false, ['gbif']],
  ['Neatus tenebrioides',       '(Palisot de Beauvois, 1817)', FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'include', 88, 28, false, ['gbif','inat']],
  ['Platydema americanum',      'Laporte & Brullé, 1831',  FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',    52, 21, false, ['gbif','inat']],
  ['Platydema ellipticum',      '(Fabricius, 1801)',       FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',    34, 16, false, ['gbif','inat']],
  ['Platydema ruficorne',       '(Sturm, 1826)',           FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'include',    27, 13, false, ['gbif','inat']],
  ['Platydema subcostatum',     'Laporte & Brullé, 1831',  FAMILY.TENEBRIONIDAE, SUBFAMILY.DIAPERINAE,    'undecided',  11,  8, false, ['gbif']],
  ['Polypleurus perforatus',    '(Germar, 1824)',          FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'include',    19, 11, false, ['gbif','inat']],
  ['Strongylium tenuicolle',    '(Say, 1824)',             FAMILY.TENEBRIONIDAE, SUBFAMILY.STENOCHIINAE,  'include',    24, 12, false, ['gbif','inat']],
  ['Tarpela micans',            '(Fabricius, 1798)',       FAMILY.TENEBRIONIDAE, SUBFAMILY.STENOCHIINAE,  'include',    41, 18, false, ['gbif','inat']],
  ['Uloma impressa',            'Melsheimer, 1846',        FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'undecided',  17, 10, false, ['gbif','inat']],
  ['Uloma punctulata',          'LeConte, 1862',           FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'undecided',   8,  6, false, ['gbif']],
  ['Tenebrio molitor',          'Linnaeus, 1758',          FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'exclude',   1842, 92, false, ['gbif','inat']],
  ['Tenebrio obscurus',         'Fabricius, 1792',         FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'exclude',    287, 64, false, ['gbif','inat']],
  ['Helops aereus',             'Germar, 1824',            FAMILY.TENEBRIONIDAE, SUBFAMILY.TENEBRIONINAE, 'exclude',     12,  7, false, ['inat']],
];

const RNG = (() => {
  // tiny deterministic PRNG so mock data is stable across reloads
  let s = 4477;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
})();

function buildCountyPresence(nCounties, totalRecords) {
  // distribute records among a subset of counties, weighted toward fewer
  const chosen = new Set();
  const fipsList = INDIANA_COUNTIES.map(c => c[0]);
  while (chosen.size < nCounties) {
    chosen.add(fipsList[Math.floor(RNG() * fipsList.length)]);
  }
  const arr = Array.from(chosen);
  const out = {};
  let remaining = totalRecords;
  arr.forEach((f, i) => {
    const isLast = i === arr.length - 1;
    const v = isLast ? remaining : Math.max(1, Math.floor(RNG() * Math.min(remaining / 2, totalRecords * 0.15)));
    out[f] = Math.min(v, remaining);
    remaining -= out[f];
  });
  if (remaining > 0) {
    const top = arr.sort((a,b)=>out[b]-out[a])[0];
    out[top] += remaining;
  }
  return out;
}

const TAXA = TAXA_SEED.map((t, i) => {
  const [scientificName, authority, family, subfamily, inclusion, nRecords, nCounties, hasConflict, sources] = t;
  return {
    id: 't' + (i + 1),
    scientificName,
    authority,
    family,
    subfamily,
    rank: 'species',
    inclusion,
    nRecords,
    nCounties,
    hasConflict,
    sources,
    countyPresence: buildCountyPresence(nCounties, nRecords),
    inclusionReasoning: inclusion === 'exclude'
      ? (scientificName === 'Tenebrio molitor' || scientificName === 'Tenebrio obscurus'
          ? 'Synanthropic / introduced cosmopolitan mealworm; excluded per project scope (native fauna only).'
          : scientificName === 'Helops aereus'
          ? 'European import; iNat records likely misidentifications of native Helopini.'
          : 'Out of region or insufficient documentation.')
      : '',
    lastCommenter: ['MP','JL','AR','DC'][i % 4],
    lastTouchedAt: '2026-05-' + String(((i*3) % 25) + 1).padStart(2,'0') + 'T14:22:00Z',
  };
});

function buildRecords(taxonId, count, opts = {}) {
  const baseDate = new Date('2018-06-15').getTime();
  const out = [];
  const fipsList = INDIANA_COUNTIES.map(c => c[0]);
  for (let i = 0; i < count; i++) {
    const r = RNG();
    const fips = fipsList[Math.floor(RNG() * fipsList.length)];
    const county = INDIANA_COUNTIES.find(c => c[0] === fips)[1];
    const source = r < 0.50 ? 'gbif' : (r < 0.93 ? 'inat' : 'manual');
    const status = i < 4 ? (i === 0 ? 'flagged' : 'pending') : 'accepted';
    const isOutOfRange = opts.someOutOfRange && i % 11 === 3;
    out.push({
      id: taxonId + '-r' + (i + 1),
      taxonId,
      source,
      externalId: source === 'gbif' ? ('GBIF:' + (3000000000 + Math.floor(RNG()*9000000))) :
                  source === 'inat' ? ('iNat:' + (90000000 + Math.floor(RNG()*9000000))) :
                  'manual-' + i,
      state: 'Indiana',
      county,
      countyFips: fips,
      lat: 37.8 + RNG() * 3.6,
      lng: -88 + RNG() * 3,
      observedAt: new Date(baseDate + Math.floor(RNG() * 250) * 86400000).toISOString().slice(0,10),
      collector: ['M. Patel','D. Chen','R. Okafor','A. Ramirez','J. Liu','C. Knapp','—'][Math.floor(RNG()*7)],
      inatQuality: source === 'inat' ? (RNG() < 0.7 ? 'research' : 'needs_id') : null,
      imageUrl: source === 'inat' && RNG() < 0.6 ? 'thumb' : null,
      status,
      flagReason: status === 'flagged' ? 'Locality precision >10 km — needs follow-up.' : null,
      isLikelyOutOfRange: isOutOfRange,
    });
  }
  if (opts.someOutOfRange) {
    [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25].forEach(i => { if (out[i]) out[i].isLikelyOutOfRange = true; });
  }
  return out;
}

// Records for t1 (Alobates pennsylvanicus) — headline, used by triage flow
const RECORDS_BY_TAXON = {
  t1: buildRecords('t1', 47, { someOutOfRange: true }),
  t2: buildRecords('t2', 32),
  t3: buildRecords('t3', 28),
  t4: buildRecords('t4', 22),
  t11: [
    // Neatus tenebrioides — moderately documented
    { id:'t11-r1', taxonId:'t11', source:'gbif', externalId:'GBIF:3038201044', state:'Indiana', county:'Tippecanoe', countyFips:'18157', lat:40.43, lng:-86.91, observedAt:'2019-07-14', collector:'C. Knapp', inatQuality:null, imageUrl:null, status:'accepted', isLikelyOutOfRange:false },
    { id:'t11-r2', taxonId:'t11', source:'inat', externalId:'iNat:96100211',  state:'Indiana', county:'Marion',     countyFips:'18097', lat:39.78, lng:-86.16, observedAt:'2021-08-02', collector:'D. Chen',  inatQuality:'research', imageUrl:'thumb', status:'accepted', isLikelyOutOfRange:false },
    { id:'t11-r3', taxonId:'t11', source:'gbif', externalId:'GBIF:3041102773', state:'Indiana', county:'Monroe',     countyFips:'18105', lat:39.17, lng:-86.52, observedAt:'2020-06-21', collector:'R. Okafor', inatQuality:null, imageUrl:null, status:'flagged', flagReason:'Date precision: only month known.', isLikelyOutOfRange:false },
    { id:'t11-r4', taxonId:'t11', source:'inat', externalId:'iNat:104550819', state:'Indiana', county:'St. Joseph', countyFips:'18141', lat:41.68, lng:-86.25, observedAt:'2022-08-30', collector:'A. Ramirez', inatQuality:'research', imageUrl:'thumb', status:'accepted', isLikelyOutOfRange:false },
  ],
};

// Taxonomic conflicts (GBIF vs iNat naming)
const CONFLICTS = [
  {
    id: 'c1',
    taxonId: 't1',
    gbifName: 'Alobates pennsylvanicus',
    gbifAuthority: '(DeGeer, 1775)',
    inatName: 'Alobates pensylvanicus',
    inatAuthority: '(DeGeer, 1775)',
    gbifRecords: 472,
    inatRecords: 140,
    note: 'iNaturalist uses the historical (one-n) spelling; GBIF backbone adopted the two-n correction after Bouchard et al. (2021). Same concept, different orthography.',
    resolution: null,
  },
  {
    id: 'c2',
    taxonId: 't5',
    gbifName: 'Diaperis maculata',
    gbifAuthority: 'Olivier, 1791',
    inatName: 'Diaperis maculata maculata',
    inatAuthority: 'Olivier, 1791',
    gbifRecords: 71,
    inatRecords: 26,
    note: 'iNat treats the nominate subspecies separately; GBIF holds species rank only. Doyen (1989) considered intraspecific variation non-trivial but unresolved.',
    resolution: null,
  },
  {
    id: 'c3',
    taxonId: 't8',
    gbifName: 'Hymenorus pilosus',
    gbifAuthority: '(Melsheimer, 1846)',
    inatName: 'Hymenorus niger',
    inatAuthority: '(Melsheimer, 1846)',
    gbifRecords: 38,
    inatRecords: 23,
    note: 'Campbell (1966) treated H. niger as senior synonym of H. pilosus; GBIF backbone retains H. pilosus pending review by Steiner & Triplehorn.',
    resolution: null,
  },
];

// Cite-only / manual entries
const MANUAL_ENTRIES = [
  {
    id: 'm1',
    taxonId: 't11',
    taxonName: 'Neatus tenebrioides',
    county: 'Tippecanoe',
    countyFips: '18157',
    citation: 'Blatchley, W.S. (1910). An Illustrated Descriptive Catalogue of the Coleoptera or Beetles (Exclusive of the Rhynchophora) Known to Occur in Indiana. Indianapolis: The Nature Publishing Company.',
    doi: '',
    notes: 'Foundational Blatchley catalogue — Lafayette voucher cited at p. 1244. Not in GBIF.',
    addedBy: 'M. Patel',
    addedAt: '2026-04-22T16:11:00Z',
  },
  {
    id: 'm2',
    taxonId: 't4',
    taxonName: 'Centronopus calcaratus',
    county: 'Monroe',
    countyFips: '18105',
    citation: 'Steiner, W.E. & Triplehorn, C.A. (2010). The genera of darkling beetles (Coleoptera: Tenebrionidae) of eastern North America. Insecta Mundi 0146: 1–66.',
    doi: '10.5281/zenodo.4456789',
    notes: 'County listed in distribution table for Steiner & Triplehorn revision; specimens at PERC.',
    addedBy: 'J. Liu',
    addedAt: '2026-04-25T09:48:00Z',
  },
];

// Members — Insect Diversity and Diagnostics Lab, Purdue Entomology
const MEMBERS = [
  { id:'u1', initials:'MP', name:'Maya Patel',     email:'mpatel@purdue.edu',      role:'Lead',        joined:'2026-03-02', affiliation:'Insect Diversity & Diagnostics Lab · Purdue' },
  { id:'u2', initials:'JL', name:'Jordan Liu',     email:'jliu@purdue.edu',        role:'Contributor', joined:'2026-03-04', affiliation:'Insect Diversity & Diagnostics Lab · Purdue' },
  { id:'u3', initials:'AR', name:'Ana Ramírez',    email:'aramirez@purdue.edu',    role:'Contributor', joined:'2026-03-09', affiliation:'Purdue Entomological Research Collection' },
  { id:'u4', initials:'DC', name:'Dimitri Chen',   email:'dchen@purdue.edu',       role:'Reviewer',    joined:'2026-04-01', affiliation:'Plant & Pest Diagnostic Lab · Purdue' },
  { id:'u5', initials:'RO', name:'Rita Okafor',    email:'rokafor@fieldmuseum.org',role:'Contributor', joined:'2026-04-12', affiliation:'Field Museum of Natural History' },
];

// Activity log
const ACTIVITY = [
  { id:'a1', actor:'MP', action:'include',       target:'Alobates pennsylvanicus', ts:'2026-05-22T14:22:00Z', detail:'Marked species as INCLUDED' },
  { id:'a2', actor:'JL', action:'comment',       target:'Hymenorus pilosus',       ts:'2026-05-22T11:09:00Z', detail:'"Holding inclusion until Campbell synonymy is settled in the conflicts panel."' },
  { id:'a3', actor:'AR', action:'reject',        target:'A. pennsylvanicus · 12 records', ts:'2026-05-21T16:44:00Z', detail:'Bulk rejected — locality precision >25 km' },
  { id:'a4', actor:'MP', action:'add_manual',    target:'Neatus tenebrioides · Tippecanoe Co.', ts:'2026-04-22T16:11:00Z', detail:'Cite-only record (Blatchley 1910)' },
  { id:'a5', actor:'JL', action:'conflict_open', target:'A. pennsylvanicus ↔ A. pensylvanicus', ts:'2026-04-19T10:02:00Z', detail:'GBIF/iNat orthography conflict flagged for review' },
  { id:'a6', actor:'AR', action:'flag',          target:'A. pennsylvanicus · GBIF:3041102773', ts:'2026-04-18T15:31:00Z', detail:'Flagged for review: locality precision >10 km' },
  { id:'a7', actor:'MP', action:'ingest',       target:'Project ingest', ts:'2026-03-02T09:14:00Z', detail:'Initial GBIF + iNat pull — 4,221 records across 28 candidate taxa' },
  { id:'a8', actor:'MP', action:'create',       target:'Project',         ts:'2026-03-02T09:11:00Z', detail:'Created project "Tenebrionidae of Indiana (2018–2024)"' },
];

// Other projects on the dashboard
const PROJECTS = [
  {
    id: 'p1',
    name: 'Tenebrionidae of Indiana (2018–2024)',
    taxonQuery: 'Tenebrionidae',
    region: 'Indiana',
    regionCodes: ['US-IN'],
    role: 'Lead',
    nSpecies: 23,
    nRecords: 4221,
    nCounties: 92,
    nConflicts: 3,
    lastActivity: '2026-05-22T14:22:00Z',
    locked: false,
    description: 'Comprehensive checklist of darkling beetles of Indiana with county-level distribution. Output is the supplementary checklist for Patel et al. (in prep.) and the curated voucher set for the Purdue Entomological Research Collection.',
  },
  {
    id: 'p2',
    name: 'Cerambycidae of the Eastern Great Lakes',
    taxonQuery: 'Cerambycidae',
    region: 'IN · OH · MI',
    regionCodes: ['US-IN','US-OH','US-MI'],
    role: 'Contributor',
    nSpecies: 58,
    nRecords: 7902,
    nCounties: 248,
    nConflicts: 0,
    lastActivity: '2026-05-19T19:01:00Z',
    locked: true,
    description: 'Longhorned beetles of IN/OH/MI. Locked snapshot for the Mosquin et al. supplementary tables; ROM bulletin reviewer copy.',
  },
  {
    id: 'p3',
    name: 'Sphecidae of Indiana',
    taxonQuery: 'Sphecidae',
    region: 'Indiana',
    regionCodes: ['US-IN'],
    role: 'Reviewer',
    nSpecies: 36,
    nRecords: 1147,
    nCounties: 71,
    nConflicts: 1,
    lastActivity: '2026-05-15T11:48:00Z',
    locked: false,
    description: 'Thread-waisted wasps of Indiana — review of the Knapp & Ramírez project, prepping for the next Insect Diversity Lab faunal bulletin.',
  },
  {
    id: 'p4',
    name: 'Curculionidae of the Wabash Valley',
    taxonQuery: 'Curculionidae (selected genera)',
    region: 'IN · IL',
    regionCodes: ['US-IN','US-IL'],
    role: 'Contributor',
    nSpecies: 9,
    nRecords: 134,
    nCounties: 22,
    nConflicts: 0,
    lastActivity: '2026-05-09T08:30:00Z',
    locked: false,
    description: 'Early-stage scoping for weevils along the Wabash drainage — pollination ecology side project.',
  },
];

// Comments on a couple of taxa
const COMMENTS = {
  t1: [
    { id:'cm1', author:'JL', ts:'2026-05-20T11:09:00Z', text:'Dropped 12 records from southern IN with locality precision >25 km. Bulk-rejected with "out of stated range" reason.' },
    { id:'cm2', author:'MP', ts:'2026-05-22T14:21:00Z', text:'Looks good to include. Cross-checked against Steiner & Triplehorn (2010) and 2024 PERC accessions.' },
  ],
  t8: [
    { id:'cm3', author:'AR', ts:'2026-04-22T15:01:00Z', text:'Holding H. pilosus inclusion — Campbell (1966) synonymized this under H. niger but the synonymy is contested. See Conflicts panel.' },
  ],
};

// Toplines
const TOPLINE = {
  p1: {
    nSpecies: 23, nIncluded: 14, nExcluded: 3, nUndecided: 6,
    nRecords: 4221, nAccepted: 4070, nRejected: 96, nFlagged: 17, nPending: 38,
    nCountiesWithPresence: 89, nUnresolvedConflicts: 3,
    nextSteps: [
      { kind:'conflict', label:'3 taxonomic conflicts unresolved', target:'conflicts' },
      { kind:'undecided', label:'6 species still marked undecided', target:'checklist?filter=undecided' },
      { kind:'flagged', label:'17 records flagged for follow-up', target:'records?filter=flagged' },
    ],
  },
};

window.MOCK = {
  INDIANA_COUNTIES, TAXA, RECORDS_BY_TAXON, CONFLICTS,
  MANUAL_ENTRIES, MEMBERS, ACTIVITY, PROJECTS, COMMENTS, TOPLINE, FAMILY, SUBFAMILY,
  // Back-compat alias so existing references keep working until renamed.
  ILLINOIS_COUNTIES: INDIANA_COUNTIES,
};
