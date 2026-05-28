/* global window, React */
// =========================================================================
// New project wizard (5 steps + ingest progress).
// =========================================================================
const { useState: useState_wiz, useEffect: useEffect_wiz, useRef: useRef_wiz } = React;

function WizardScreen({ onCancel, onComplete }) {
  const { Button, Card, TextField, TextArea, Checkbox, Radio, Eyebrow, Badge, FilterChip, H2, H3 } = window.UI;
  const { Icons } = window;
  const [step, setStep] = useState_wiz(0);

  const [name, setName] = useState_wiz('Tenebrionidae of Indiana (2018–2024)');
  const [description, setDescription] = useState_wiz('Darkling beetles (Tenebrionidae) of Indiana at county resolution. Output is the supplementary checklist for Patel et al. (in prep.) and the curated voucher set for the Purdue Entomological Research Collection.');
  const [taxon, setTaxon] = useState_wiz({ name:'Tenebrionidae', authority:'Latreille, 1802', rank:'family', gbifKey:7919, inatId:52719, sources:['gbif','inat'] });
  const [region, setRegion] = useState_wiz(new Set(['US-IN']));
  const [filters, setFilters] = useState_wiz({
    inatQuality: 'research',
    dateStart: '2018-01-01',
    dateEnd: '2024-12-31',
    basis: { humanObservation: true, preservedSpecimen: true, materialSample: false, occurrence: false },
    hasCoords: true,
    excludeCultivated: true,
  });
  const [ingestProgress, setIngestProgress] = useState_wiz({ gbif: 0, inat: 0, dedup: 0, finalize: 0, currentMsg: '' });

  const steps = [
    { key: 'name',    label: 'Name'        },
    { key: 'taxon',   label: 'Taxon'       },
    { key: 'region',  label: 'Region'      },
    { key: 'filters', label: 'Ingest'      },
    { key: 'confirm', label: 'Confirm'     },
  ];

  const next = () => setStep(s => Math.min(s + 1, steps.length));
  const back = () => setStep(s => Math.max(s - 1, 0));

  // Drive the fake ingest progress when we reach step 5
  useEffect_wiz(() => {
    if (step !== 5) return;
    const msgs = [
      'Querying GBIF Occurrence search… (taxonKey=7919, country=US, stateProvince=Indiana)',
      'Paginating GBIF results (limit=300/page)…',
      'Querying iNaturalist API v1… (taxon_id=52719, place_id=33)',
      'Paginating iNat observations (per_page=200)…',
      'Reverse-geocoding lat/lng → county FIPS for 3,148 records…',
      'Deduplicating cross-source records by (observer, date, coord rounding 0.01°)…',
      'Building county-presence materialized view…',
      'Detecting taxonomic conflicts vs GBIF backbone…',
      'Finalizing taxa table, computing inclusion defaults…',
    ];
    let t = 0;
    const total = msgs.length;
    const timer = setInterval(() => {
      setIngestProgress(p => {
        const gbif = Math.min(100, p.gbif + 12);
        const inat = Math.min(100, gbif > 50 ? p.inat + 11 : p.inat + 4);
        const dedup = Math.min(100, gbif >= 100 && inat >= 100 ? p.dedup + 18 : p.dedup);
        const finalize = Math.min(100, dedup >= 100 ? p.finalize + 22 : p.finalize);
        const msg = msgs[Math.min(Math.floor(t / 2), total - 1)];
        if (finalize >= 100) { clearInterval(timer); setTimeout(onComplete, 600); }
        t++;
        return { gbif, inat, dedup, finalize, currentMsg: msg };
      });
    }, 380);
    return () => clearInterval(timer);
  }, [step]);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="bg-white border-b border-surface-3 sticky top-0 z-10">
        <div className="max-w-[1080px] mx-auto px-8 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <window.Icons.Logo size={22}/>
            <span className="font-black text-blue-800 text-[15px] tracking-tight">InsectID Checklist</span>
          </div>
          <span className="text-text-300">/</span>
          <span className="text-[13px] text-text-500">New project</span>
          <div className="flex-1"/>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </header>

      <main className="max-w-[1080px] mx-auto px-8 py-10">
        {step < 5 ? (
          <>
            <Eyebrow className="mb-2">{`STEP ${step + 1} OF ${steps.length}`}</Eyebrow>
            <h1 className="text-[28px] font-black text-blue-800 leading-tight rule mb-5">
              {step === 0 && 'Name your project'}
              {step === 1 && 'Pick a taxon'}
              {step === 2 && 'Pick a geographic region'}
              {step === 3 && 'Review ingest filters'}
              {step === 4 && 'Confirm and start ingest'}
            </h1>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8 mt-6 flex-wrap">
              {steps.map((s, i) => (
                <button key={s.key} onClick={() => setStep(i)}
                  className={`text-[12px] px-3 h-8 border rounded-full inline-flex items-center gap-2 font-bold transition-colors
                    ${i === step ? 'bg-blue-600 text-white border-blue-600'
                      : i < step ? 'bg-blue-50 text-blue-800 border-blue-100' : 'bg-white text-text-400 border-surface-3'}`}>
                  <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold
                    ${i === step ? 'bg-blue-800 text-white' : i < step ? 'bg-blue-600 text-white' : 'bg-surface-2 text-text-500'}`}>
                    {i < step ? <window.Icons.Check size={10} stroke={3}/> : i + 1}
                  </span>
                  {s.label}
                </button>
              ))}
            </div>

            <Card className="p-7">
              {step === 0 && (
                <div className="space-y-5 max-w-2xl">
                  <TextField label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tenebrionidae of Indiana (2018–2024)" />
                  <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                    hint="Optional. Shown in the project list and in the methods section of the DOCX export." />
                </div>
              )}

              {step === 1 && <TaxonStep taxon={taxon} setTaxon={setTaxon} />}

              {step === 2 && <RegionStep region={region} setRegion={setRegion} />}

              {step === 3 && <FiltersStep filters={filters} setFilters={setFilters} />}

              {step === 4 && <ConfirmStep name={name} description={description} taxon={taxon} region={region} filters={filters} />}
            </Card>

            <div className="flex items-center justify-between mt-6">
              <Button variant="secondary" onClick={back} disabled={step === 0} className="disabled:opacity-40">
                <window.Icons.ChevronLeft size={14}/> Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-400 font-mono">Cmd+→ to advance</span>
                {step < 4 ? (
                  <Button variant="primary" onClick={next}>Continue <window.Icons.ChevronRight size={14}/></Button>
                ) : (
                  <Button variant="primary" onClick={next}>Confirm and ingest <window.Icons.Sparkles size={14}/></Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <IngestProgress progress={ingestProgress} taxon={taxon} />
        )}
      </main>
    </div>
  );
}

// ------ Taxon step -------------------------------------------------------
function TaxonStep({ taxon, setTaxon }) {
  const { TextField, Badge, SourceChip } = window.UI;
  const [q, setQ] = useState_wiz('Tenebrionidae');
  const suggestions = [
    { name: 'Tenebrionidae', authority: 'Latreille, 1802',     rank:'family',  family:'\u2014',           gbifKey:7919,     inatId:52719,  gbifN:'Tenebrionidae', inatN:'Tenebrionidae' },
    { name: 'Alobates pennsylvanicus', authority: '(DeGeer, 1775)', rank:'species', family:'Tenebrionidae', gbifKey:4734451, inatId:127344, gbifN:'Alobates pennsylvanicus', inatN:'Alobates pensylvanicus' },
    { name: 'Bolitotherus cornutus', authority: '(Panzer, 1794)', rank:'species', family:'Tenebrionidae', gbifKey:4732001, inatId:121530, gbifN:'Bolitotherus cornutus', inatN:'Bolitotherus cornutus' },
    { name: 'Cerambycidae', authority: 'Latreille, 1802',     rank:'family', family:'\u2014',            gbifKey:9655,     inatId:47208,  gbifN:'Cerambycidae',  inatN:'Cerambycidae' },
    { name: 'Carabidae',   authority: 'Latreille, 1802',     rank:'family', family:'\u2014',            gbifKey:3792,     inatId:47218,  gbifN:'Carabidae',     inatN:'Carabidae' },
  ];
  const filtered = suggestions.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <div className="max-w-2xl">
        <TextField label="Search the GBIF backbone and iNaturalist" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Tenebrionidae, Cerambycidae, Bolitotherus cornutus"
          leftIcon={<window.Icons.Search size={14}/>}
          hint="Both backbones are queried. You'll see how each one names your taxon and can resolve conflicts later."/>
      </div>
      <div className="border border-surface-3 rounded-lg bg-white overflow-hidden">
        <div className="px-3 py-2 bg-surface-1 border-b border-surface-3 text-[11px] uppercase tracking-[0.1em] text-text-500 font-bold flex items-center justify-between">
          <span>{filtered.length} matches</span>
          <span className="font-mono normal-case tracking-normal">gbif.org/species  ·  api.inaturalist.org/v1/taxa</span>
        </div>
        <div className="divide-y divide-surface-3">
          {filtered.map(s => {
            const selected = taxon.name === s.name;
            return (
              <button key={s.name} onClick={() => setTaxon({ ...s, sources:['gbif','inat'] })}
                className={`flex items-center w-full text-left px-4 py-3 gap-4 transition-colors
                  ${selected ? 'bg-blue-50/60' : 'hover:bg-surface-1'}`}>
                <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full border-2 flex-shrink-0
                  ${selected ? 'bg-blue-600 border-blue-600' : 'border-surface-3 bg-white'}`}>
                  {selected && <window.Icons.Check size={12} stroke={3} className="text-white"/>}
                </span>
                <div className="flex-1">
                  <div className="font-bold text-[14.5px] text-blue-800 italic" style={{fontStyle:s.rank==='species'?'italic':'normal'}}>
                    {s.name}
                    <span className="ml-1.5 text-[12px] font-normal not-italic text-text-500">{s.authority}</span>
                  </div>
                  <div className="text-[12px] text-text-500 mt-0.5">
                    <Badge tone="outline" size="sm">{s.rank}</Badge>
                    <span className="mx-2">family: {s.family}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[11.5px] font-mono">
                  <div className="flex items-center gap-1.5"><SourceChip source="gbif" size="xs"/> {s.gbifN}</div>
                  <div className="text-text-400">GBIF:{s.gbifKey}</div>
                  <div className="flex items-center gap-1.5"><SourceChip source="inat" size="xs"/> {s.inatN}</div>
                  <div className="text-text-400">iNat:{s.inatId}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-[12.5px] text-text-500">
        <window.Icons.Question size={12} className="inline align-middle mr-1"/>
        Both names are kept side-by-side until you decide. Conflicts surface in the <span className="font-bold text-blue-800">Conflicts</span> tab during triage.
      </div>
    </div>
  );
}

// ------ Region step ------------------------------------------------------
const US_STATES = [
  ['US-AL','Alabama'],['US-AK','Alaska'],['US-AZ','Arizona'],['US-AR','Arkansas'],['US-CA','California'],
  ['US-CO','Colorado'],['US-CT','Connecticut'],['US-DE','Delaware'],['US-FL','Florida'],['US-GA','Georgia'],
  ['US-HI','Hawaii'],['US-ID','Idaho'],['US-IL','Illinois'],['US-IN','Indiana'],['US-IA','Iowa'],
  ['US-KS','Kansas'],['US-KY','Kentucky'],['US-LA','Louisiana'],['US-ME','Maine'],['US-MD','Maryland'],
  ['US-MA','Massachusetts'],['US-MI','Michigan'],['US-MN','Minnesota'],['US-MS','Mississippi'],['US-MO','Missouri'],
  ['US-MT','Montana'],['US-NE','Nebraska'],['US-NV','Nevada'],['US-NH','New Hampshire'],['US-NJ','New Jersey'],
  ['US-NM','New Mexico'],['US-NY','New York'],['US-NC','North Carolina'],['US-ND','North Dakota'],['US-OH','Ohio'],
  ['US-OK','Oklahoma'],['US-OR','Oregon'],['US-PA','Pennsylvania'],['US-RI','Rhode Island'],['US-SC','South Carolina'],
  ['US-SD','South Dakota'],['US-TN','Tennessee'],['US-TX','Texas'],['US-UT','Utah'],['US-VT','Vermont'],
  ['US-VA','Virginia'],['US-WA','Washington'],['US-WV','West Virginia'],['US-WI','Wisconsin'],['US-WY','Wyoming'],
];
const CA_PROVS = [
  ['CA-AB','Alberta'],['CA-BC','British Columbia'],['CA-MB','Manitoba'],['CA-NB','New Brunswick'],
  ['CA-NL','Newfoundland and Labrador'],['CA-NS','Nova Scotia'],['CA-ON','Ontario'],['CA-PE','Prince Edward Island'],
  ['CA-QC','Quebec'],['CA-SK','Saskatchewan'],['CA-NT','Northwest Territories'],['CA-NU','Nunavut'],['CA-YT','Yukon'],
];
function RegionStep({ region, setRegion }) {
  const [tab, setTab] = useState_wiz('US');
  const list = tab === 'US' ? US_STATES : CA_PROVS;
  const toggle = (code) => {
    const n = new Set(region);
    if (n.has(code)) n.delete(code); else n.add(code);
    setRegion(n);
  };
  const { Badge } = window.UI;
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <window.UI.Segmented value={tab} onChange={setTab} options={[{value:'US',label:'United States'},{value:'CA',label:'Canada'}]}/>
          <div className="flex-1"/>
          <button onClick={() => setRegion(new Set())} className="text-[12px] text-text-500 hover:text-text-700">Clear</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 max-h-[420px] overflow-y-auto nice-scroll pr-1">
          {list.map(([code, name]) => {
            const sel = region.has(code);
            return (
              <button key={code} onClick={() => toggle(code)}
                className={`text-left flex items-center gap-2 px-2.5 h-8 rounded border text-[12.5px] transition-colors
                  ${sel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-text-600 border-surface-3 hover:border-blue-300 hover:bg-blue-50'}`}>
                <span className={`inline-block h-3 w-3 rounded-sm ${sel ? 'bg-white' : 'bg-surface-2'}`}/>
                <span className="font-mono text-[11px] opacity-70">{code.slice(3)}</span>
                <span className="flex-1 truncate">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-[12px] font-semibold text-text-600 mb-2">Selected region preview</div>
        <div className="border border-surface-3 rounded-lg p-3 bg-white">
          <USInsetPreview selected={region}/>
          <div className="mt-2 text-[11.5px] text-text-500">
            <span className="font-mono">{region.size}</span> {region.size === 1 ? 'state/province' : 'states/provinces'}
          </div>
        </div>
        <div className="text-[12px] text-text-500 mt-3">
          County-level rendering uses Census TIGER (US) and StatsCan census divisions (Canada). Topojson bundled at build.
        </div>
      </div>
    </div>
  );
}

function USInsetPreview({ selected }) {
  // A schematic US + Canada grid: tiny coarse rects for each state/province.
  // Selected cells light up blue-600; others surface-2.
  const cells = [
    // very rough geographic layout for US (5 rows). Lat/long-ish.
    ['US-WA','US-MT','US-ND','US-MN','US-WI','US-MI','...','...','...','...','US-ME'],
    ['US-OR','US-ID','US-SD','US-IA','US-IL','US-IN','US-OH','US-PA','US-NY','...','US-VT','US-NH'],
    ['US-CA','US-NV','US-WY','US-NE','US-MO','US-KY','US-WV','US-VA','US-NJ','US-CT','US-MA','US-RI'],
    ['...','US-UT','US-CO','US-KS','US-AR','US-TN','US-NC','US-MD','US-DE','...'],
    ['US-AZ','US-NM','US-OK','US-LA','US-MS','US-AL','US-GA','US-SC','...'],
    ['US-HI','US-AK','US-TX','US-FL'],
  ];
  return (
    <svg viewBox="0 0 240 160" width="100%" height="140">
      {cells.map((row, ri) =>
        row.map((code, ci) => {
          if (code === '...') return null;
          const sel = selected.has(code);
          return (
            <g key={code+'-'+ri+'-'+ci}>
              <rect x={4 + ci*20} y={6 + ri*22} width={16} height={18} rx={2}
                    fill={sel ? '#116dff' : '#F1F3F5'}
                    stroke={sel ? '#0A3F95' : '#B7BDC0'}
                    strokeWidth={sel ? 1.2 : 0.5}/>
              <text x={4 + ci*20 + 8} y={6 + ri*22 + 12.5}
                    fontFamily="Lato" fontSize="8" textAnchor="middle"
                    fill={sel ? '#FFFFFF' : '#5f6360'} fontWeight={700}>
                {code.slice(3)}
              </text>
            </g>
          );
        })
      )}
    </svg>
  );
}

// ------ Filters step -----------------------------------------------------
function FiltersStep({ filters, setFilters }) {
  const { Checkbox, Radio, TextField, Badge } = window.UI;
  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-6 max-w-3xl">
      <div>
        <div className="text-[13px] font-bold text-blue-800 mb-3 rule-sm">iNaturalist quality</div>
        <div className="space-y-2.5">
          <Radio label="Research-grade only" sub="Has community ID + supporting evidence" checked={filters.inatQuality === 'research'} onChange={() => setFilters({...filters, inatQuality:'research'})}/>
          <Radio label="Research-grade + needs-ID" sub="Include records pending community ID" checked={filters.inatQuality === 'all'} onChange={() => setFilters({...filters, inatQuality:'all'})}/>
        </div>
      </div>
      <div>
        <div className="text-[13px] font-bold text-blue-800 mb-3 rule-sm">Date range</div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="From" value={filters.dateStart} onChange={(e) => setFilters({...filters, dateStart:e.target.value})}/>
          <TextField label="To"   value={filters.dateEnd}   onChange={(e) => setFilters({...filters, dateEnd:e.target.value})}/>
        </div>
        <div className="text-[12px] text-text-400 mt-2">Records outside this window are dropped at ingest.</div>
      </div>
      <div>
        <div className="text-[13px] font-bold text-blue-800 mb-3 rule-sm">GBIF basis of record</div>
        <div className="space-y-2.5">
          <Checkbox label="Human observation" checked={filters.basis.humanObservation} onChange={(v) => setFilters({...filters, basis: {...filters.basis, humanObservation: v}})}/>
          <Checkbox label="Preserved specimen" checked={filters.basis.preservedSpecimen} onChange={(v) => setFilters({...filters, basis: {...filters.basis, preservedSpecimen: v}})}/>
          <Checkbox label="Material sample"   checked={filters.basis.materialSample}   onChange={(v) => setFilters({...filters, basis: {...filters.basis, materialSample: v}})}/>
          <Checkbox label="Occurrence (general)" sub="Less precise; off by default" checked={filters.basis.occurrence} onChange={(v) => setFilters({...filters, basis: {...filters.basis, occurrence: v}})}/>
        </div>
      </div>
      <div>
        <div className="text-[13px] font-bold text-blue-800 mb-3 rule-sm">Additional filters</div>
        <div className="space-y-2.5">
          <Checkbox label="Require coordinates" sub="Drops records without lat/long" checked={filters.hasCoords} onChange={(v) => setFilters({...filters, hasCoords:v})}/>
          <Checkbox label="Exclude cultivated / captive" sub="iNat 'captive=true'; GBIF establishmentMeans" checked={filters.excludeCultivated} onChange={(v) => setFilters({...filters, excludeCultivated:v})}/>
        </div>
      </div>
      <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-md px-4 py-3 text-[12.5px] text-blue-800 flex items-start gap-2">
        <window.Icons.Sparkles size={14} className="mt-0.5 flex-shrink-0"/>
        <div>
          Filters can be changed later under <span className="font-bold">Settings → Ingest filters</span>. Re-running ingest with new filters is destructive; the system surfaces a confirm dialog with a record-level diff before applying.
        </div>
      </div>
    </div>
  );
}

// ------ Confirm step -----------------------------------------------------
function ConfirmStep({ name, description, taxon, region, filters }) {
  const { Badge } = window.UI;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-3xl">
        <Field label="Project name" value={name}/>
        <Field label="Description" value={description}/>
        <Field label="Taxon" value={<><span className="italic">{taxon.name}</span> <span className="text-text-400 font-normal">{taxon.authority}</span> · <Badge tone="outline" size="xs">{taxon.rank}</Badge></>}/>
        <Field label="GBIF / iNat ids" value={<span className="font-mono text-[12.5px]">GBIF:{taxon.gbifKey} · iNat:{taxon.inatId}</span>}/>
        <Field label="Region" value={Array.from(region).join(' · ') || '—'}/>
        <Field label="Date range" value={`${filters.dateStart} → ${filters.dateEnd}`}/>
        <Field label="iNat quality" value={filters.inatQuality === 'research' ? 'Research-grade only' : 'Research-grade + needs-ID'}/>
        <Field label="Basis of record" value={Object.entries(filters.basis).filter(([k,v]) => v).map(([k]) => k).join(', ') || 'None'}/>
      </div>
      <div className="bg-surface-1 border border-surface-3 rounded-md px-4 py-3 text-[12.5px] text-text-500">
        <div className="font-bold text-blue-800 mb-1">What happens next</div>
        Two ingest jobs are spawned (one per source). Both paginate and persist progress so they can resume on failure.
        Records are reverse-geocoded to county FIPS, deduplicated across sources, and aggregated into a per-species,
        per-county presence table. You'll land on the Checklist when it's done.
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-[11px] text-text-400 uppercase tracking-[0.1em] font-bold mb-1">{label}</div>
      <div className="text-[14px] text-text-700 font-semibold">{value}</div>
    </div>
  );
}

// ------ Ingest progress --------------------------------------------------
function IngestProgress({ progress, taxon }) {
  const { Card, ProgressBar, Eyebrow, SourceChip, Badge } = window.UI;
  return (
    <div className="max-w-3xl mx-auto">
      <Eyebrow className="mb-2">SETTING UP YOUR PROJECT</Eyebrow>
      <h1 className="text-[28px] font-black text-blue-800 leading-tight rule mb-6">
        Pulling occurrence data…
      </h1>
      <Card className="p-7">
        <div className="space-y-5">
          <ProgressRow source="gbif" label="GBIF Occurrence API" value={progress.gbif} hint="taxonKey=7919 · stateProvince=Indiana · 14 pages × 300"/>
          <ProgressRow source="inat" label="iNaturalist API v1" value={progress.inat} hint="taxon_id=52719 · place_id=33 · 8 pages × 200"/>
          <ProgressRow source="merged" label="Deduplicate + reverse-geocode to county" value={progress.dedup} hint="haversine ≤ 50m · matching observer + date"/>
          <ProgressRow source="merged" label="Build county presence + detect conflicts" value={progress.finalize} hint="aggregate into county_presence · GBIF↔iNat name diff"/>
        </div>
        <div className="mt-7 px-3.5 py-2.5 bg-surface-2 border border-surface-3 rounded font-mono text-[12px] text-text-500 leading-relaxed">
          <span className="text-blue-600 font-bold">[ingest] </span>{progress.currentMsg || 'Starting…'}
        </div>
        <div className="mt-5 flex items-center gap-3 text-[12px] text-text-500">
          <Badge tone="blue" size="sm">ingest_jobs.id = ij_8f3d24</Badge>
          <span>Live counts: <span className="font-mono text-text-700">{Math.round((progress.gbif + progress.inat) * 14)}</span> records seen</span>
        </div>
      </Card>
      <div className="text-[11.5px] text-text-400 mt-6 text-center font-mono">
        Polite ingest: ≤4 req/s/source · per-page cursor persisted in <code>ingest_jobs</code>
      </div>
    </div>
  );
}

function ProgressRow({ source, label, value, hint }) {
  const { SourceChip, ProgressBar } = window.UI;
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1.5">
        <SourceChip source={source}/>
        <span className="font-semibold text-text-700 text-[13.5px]">{label}</span>
        <div className="flex-1"/>
        <span className="font-mono text-[12px] text-text-500 tabular-nums">{value}%</span>
      </div>
      <ProgressBar value={value}/>
      <div className="text-[11.5px] text-text-400 font-mono mt-1">{hint}</div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.WizardScreen = WizardScreen;
