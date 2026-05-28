/* global window, React */
// =========================================================================
// Checklist (species-level) — the workhorse data table.
// Mode 'records' shows a different column set scoped across all taxa.
// =========================================================================
const { useState: useState_cl, useMemo: useMemo_cl } = React;

function ChecklistScreen({ project, taxa, conflicts, members, onOpenSpecies, onMutate, mode = 'species', recordsByTaxon, setNav }) {
  const {
    Card, Eyebrow, Badge, Button, H2, FilterChip, Segmented, InclusionBadge, SourceChip, AvatarStack,
    DataTable, BulkActionBar, PresenceStrip, Avatar, useToast,
  } = window.UI;
  const { MiniChoropleth } = window.MAP;
  const { fmtN, relTime } = window.UTIL;
  const toast = useToast();

  const [filters, setFilters] = useState_cl({ inclusion: 'all', conflict: 'all', family: 'all', recordCount: 'all' });
  const [query, setQuery] = useState_cl('');
  const [selected, setSelected] = useState_cl(new Set());
  const [sort, setSort] = useState_cl({ key: 'nRecords', dir: 'desc' });
  const [density, setDensity] = useState_cl('comfortable');

  const filteredTaxa = useMemo_cl(() => {
    const f = taxa.filter(t => {
      if (filters.inclusion !== 'all' && t.inclusion !== filters.inclusion) return false;
      if (filters.conflict === 'conflict' && !t.hasConflict) return false;
      if (filters.family !== 'all' && t.family !== filters.family) return false;
      if (filters.recordCount === '0' && t.nRecords > 0) return false;
      if (filters.recordCount === 'low' && (t.nRecords < 1 || t.nRecords > 10)) return false;
      if (filters.recordCount === 'mid' && (t.nRecords < 11 || t.nRecords > 99)) return false;
      if (filters.recordCount === 'high' && t.nRecords < 100) return false;
      if (query && !t.scientificName.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    f.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return f;
  }, [filters, query, taxa, sort]);

  const counts = useMemo_cl(() => {
    const c = { include: 0, exclude: 0, undecided: 0, conflict: 0 };
    taxa.forEach(t => {
      c[t.inclusion]++;
      if (t.hasConflict) c.conflict++;
    });
    return c;
  }, [taxa]);

  const onBulkInclude = () => {
    onMutate({ type:'setInclusion', ids: Array.from(selected), value:'include' });
    toast.push({ tone:'success', title:`${selected.size} species marked included`, message:'Reversible via Activity log.', onUndo: () => onMutate({ type:'undoLast' }) });
    setSelected(new Set());
  };
  const onBulkExclude = () => {
    onMutate({ type:'setInclusion', ids: Array.from(selected), value:'exclude' });
    toast.push({ tone:'info', title:`${selected.size} species marked excluded`, onUndo: () => onMutate({ type:'undoLast' }) });
    setSelected(new Set());
  };

  if (mode === 'records') {
    return <RecordsView project={project} taxa={taxa} recordsByTaxon={recordsByTaxon} setNav={setNav} onOpenSpecies={onOpenSpecies}/>;
  }

  const SortHeader = ({ k, children, align = 'left' }) => (
    <button onClick={() => setSort(s => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}
      className={`inline-flex items-center gap-1 font-bold uppercase tracking-[0.08em] text-[11.5px] text-gray-500 hover:text-blue-800
        ${align === 'right' ? 'flex-row-reverse w-full justify-start' : ''}`}>
      {children}
      <window.Icons.ArrowUpDown size={11} className={sort.key === k ? 'text-blue-600' : 'text-text-300'}/>
    </button>
  );

  const columns = [
    { key:'scientificName', header: <SortHeader k="scientificName">Species</SortHeader>, cellClass:'min-w-[280px]', render: (r) => (
      <button onClick={() => onOpenSpecies(r.id)} className="flex items-center gap-2 group text-left">
        <span className="text-[14px] font-bold text-blue-800 italic group-hover:underline">{r.scientificName}</span>
        <span className="text-[12px] text-text-400 not-italic font-normal">{r.authority}</span>
        {r.hasConflict && <window.Icons.Conflict size={13} className="text-warning-700" />}
      </button>
    )},
    { key:'family', header: <SortHeader k="family">Family</SortHeader>, render: (r) => <span className="text-text-500">{r.family}</span> },
    { key:'sources', header:'Source agreement', render: (r) => (
      <div className="flex items-center gap-1">
        <SourceChip source="gbif" size="xs"/>
        <span className={`text-[11px] ${r.sources.includes('gbif') ? 'text-success-600' : 'text-text-300'}`}>
          {r.sources.includes('gbif') ? '✓' : '—'}
        </span>
        <span className="mx-1 text-text-300">·</span>
        <SourceChip source="inat" size="xs"/>
        <span className={`text-[11px] ${r.sources.includes('inat') ? 'text-success-600' : 'text-text-300'}`}>
          {r.sources.includes('inat') ? '✓' : '—'}
        </span>
      </div>
    )},
    { key:'nRecords', align:'right', header: <SortHeader k="nRecords" align="right">Records</SortHeader>, render: (r) => <span className="font-mono tabular-nums text-text-700">{fmtN(r.nRecords)}</span> },
    { key:'nCounties', align:'right', header: <SortHeader k="nCounties" align="right">Counties</SortHeader>, render: (r) => <span className="font-mono tabular-nums text-text-700">{r.nCounties}</span> },
    { key:'countyPresence', header:'County presence', render: (r) => <MiniChoropleth countyPresence={r.countyPresence}/>, cellClass:'min-w-[120px]' },
    { key:'inclusion', header:'Inclusion', render: (r) => <InclusionBadge state={r.inclusion}/> },
    { key:'lastCommenter', header:'Last touched', render: (r) => (
      <div className="flex items-center gap-2">
        <Avatar initials={r.lastCommenter} size={20}/>
        <span className="text-[11.5px] text-text-400 font-mono">{relTime(r.lastTouchedAt)}</span>
      </div>
    )},
  ];

  return (
    <div className="max-w-[1380px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">SPECIES CHECKLIST</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">
            {taxa.length} candidate species
            <span className="text-text-400 font-normal ml-2 text-[16px]">in {project.region}</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<window.Icons.Columns size={13}/>}>Columns</Button>
          <Button variant="secondary" icon={<window.Icons.Download size={13}/>}>Export view (CSV)</Button>
          <Button variant="primary" icon={<window.Icons.Plus size={13}/>} onClick={() => setNav('manual')}>Add manual entry</Button>
        </div>
      </div>

      {conflicts.filter(c => !c.resolution).length > 0 && (
        <div className="mb-4 bg-warning-50 border border-[#FCE2B0] text-warning-700 rounded-md px-4 py-3 flex items-start gap-3">
          <window.Icons.Conflict size={16} className="mt-0.5 flex-shrink-0"/>
          <div className="flex-1">
            <div className="font-bold text-[13.5px]">{conflicts.filter(c => !c.resolution).length} taxonomic conflicts unresolved</div>
            <div className="text-[12.5px] mt-0.5">
              GBIF and iNat disagree on species concept for {conflicts.filter(c => !c.resolution).map(c => <em key={c.id} className="font-semibold">{c.gbifName}</em>).reduce((acc, el, i, arr) => acc === null ? [el] : [...acc, i === arr.length - 1 ? ' and ' : ', ', el], null)}.
              Resolve before exporting.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setNav('conflicts')}>Resolve →</Button>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FilterChip active={filters.inclusion === 'all'} onClick={() => setFilters({...filters, inclusion:'all'})} count={taxa.length}>All</FilterChip>
        <FilterChip active={filters.inclusion === 'include'} onClick={() => setFilters({...filters, inclusion:'include'})} count={counts.include}>Included</FilterChip>
        <FilterChip active={filters.inclusion === 'undecided'} onClick={() => setFilters({...filters, inclusion:'undecided'})} count={counts.undecided}>Undecided</FilterChip>
        <FilterChip active={filters.inclusion === 'exclude'} onClick={() => setFilters({...filters, inclusion:'exclude'})} count={counts.exclude}>Excluded</FilterChip>
        <span className="h-5 w-px bg-surface-3 mx-1"/>
        <FilterChip active={filters.conflict === 'conflict'} onClick={() => setFilters({...filters, conflict: filters.conflict === 'conflict' ? 'all' : 'conflict'})} count={counts.conflict}>
          <window.Icons.Conflict size={11}/>Has conflict
        </FilterChip>
        <FilterChip active={filters.recordCount === 'low'} onClick={() => setFilters({...filters, recordCount: filters.recordCount === 'low' ? 'all' : 'low'})}>
          1–10 records
        </FilterChip>
        <FilterChip active={filters.recordCount === 'mid'} onClick={() => setFilters({...filters, recordCount: filters.recordCount === 'mid' ? 'all' : 'mid'})}>
          11–99 records
        </FilterChip>
        <FilterChip active={filters.recordCount === 'high'} onClick={() => setFilters({...filters, recordCount: filters.recordCount === 'high' ? 'all' : 'high'})}>
          ≥100 records
        </FilterChip>
        <div className="flex-1"/>
        <div className="relative">
          <window.Icons.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300"/>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search species"
            className="h-8 pl-8 pr-3 bg-white border border-surface-3 rounded-md text-[13px] outline-none focus:border-blue-600 w-[220px]"/>
        </div>
        <Segmented value={density} onChange={setDensity} options={[{value:'comfortable',label:'Normal'},{value:'compact',label:'Compact'}]}/>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3">
          <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
            <button onClick={onBulkInclude} className="px-2.5 h-7 rounded bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-1.5 text-[12px] font-medium"><window.Icons.Check size={11} stroke={2.5}/>Mark included</button>
            <button onClick={onBulkExclude} className="px-2.5 h-7 rounded bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-1.5 text-[12px] font-medium"><window.Icons.X size={11} stroke={2.5}/>Mark excluded</button>
            <button className="px-2.5 h-7 rounded bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-1.5 text-[12px] font-medium"><window.Icons.Comment size={11}/>Comment</button>
            <button className="px-2.5 h-7 rounded bg-blue-700 hover:bg-blue-600 text-white inline-flex items-center gap-1.5 text-[12px] font-medium"><window.Icons.Download size={11}/>Export selection</button>
          </BulkActionBar>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={filteredTaxa}
        getRowId={(r) => r.id}
        selected={selected}
        onSelectionChange={setSelected}
        density={density}
      />

      <div className="flex items-center justify-between mt-3 text-[11.5px] text-text-400 font-mono">
        <span>{filteredTaxa.length} of {taxa.length} taxa · sort: {sort.key} {sort.dir}</span>
        <span>Hold <kbd>Shift</kbd> + click to range-select. <kbd>I</kbd> / <kbd>E</kbd> set inclusion.</span>
      </div>
    </div>
  );
}

// ----------------------- Records view (cross-taxon) -----------------------
function RecordsView({ project, taxa, recordsByTaxon, setNav, onOpenSpecies }) {
  const { Card, Eyebrow, Badge, Button, FilterChip, SourceChip, DataTable } = window.UI;
  const { fmtDate } = window.UTIL;
  const [filters, setFilters] = useState_cl({ status:'all', source:'all' });
  // Combine all records (only t1, t8 have rich records; others built lazily)
  const allRecords = useMemo_cl(() => {
    return Object.entries(recordsByTaxon).flatMap(([taxonId, recs]) =>
      recs.map(r => ({ ...r, taxonName: taxa.find(t => t.id === taxonId)?.scientificName || '—' }))
    );
  }, [recordsByTaxon, taxa]);
  const filtered = allRecords.filter(r => {
    if (filters.status !== 'all' && r.status !== filters.status) return false;
    if (filters.source !== 'all' && r.source !== filters.source) return false;
    return true;
  });

  return (
    <div className="max-w-[1380px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">RECORDS</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">
            All records across {Object.keys(recordsByTaxon).length} loaded species
          </h1>
          <p className="text-[13px] text-text-500 mt-1">Cross-taxon triage view. To work record-by-record on a single species, open Species detail.</p>
        </div>
        <Button variant="secondary" icon={<window.Icons.Download size={13}/>}>Export view (CSV)</Button>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FilterChip active={filters.status === 'all'}    onClick={() => setFilters({...filters, status:'all'})}    count={allRecords.length}>All</FilterChip>
        <FilterChip active={filters.status === 'accepted'} onClick={() => setFilters({...filters, status:'accepted'})} count={allRecords.filter(r => r.status === 'accepted').length}>Accepted</FilterChip>
        <FilterChip active={filters.status === 'flagged'} onClick={() => setFilters({...filters, status:'flagged'})} count={allRecords.filter(r => r.status === 'flagged').length}>Flagged</FilterChip>
        <FilterChip active={filters.status === 'pending'} onClick={() => setFilters({...filters, status:'pending'})} count={allRecords.filter(r => r.status === 'pending').length}>Pending</FilterChip>
        <FilterChip active={filters.status === 'rejected'} onClick={() => setFilters({...filters, status:'rejected'})} count={allRecords.filter(r => r.status === 'rejected').length}>Rejected</FilterChip>
        <span className="h-5 w-px bg-surface-3 mx-1"/>
        <FilterChip active={filters.source === 'gbif'} onClick={() => setFilters({...filters, source: filters.source === 'gbif' ? 'all' : 'gbif'})}>GBIF</FilterChip>
        <FilterChip active={filters.source === 'inat'} onClick={() => setFilters({...filters, source: filters.source === 'inat' ? 'all' : 'inat'})}>iNat</FilterChip>
        <FilterChip active={filters.source === 'manual'} onClick={() => setFilters({...filters, source: filters.source === 'manual' ? 'all' : 'manual'})}>Manual</FilterChip>
      </div>

      <DataTable
        rows={filtered}
        getRowId={(r) => r.id}
        columns={[
          { key:'species', header:'Species', render: (r) => (
            <button onClick={() => onOpenSpecies(r.taxonId)} className="text-blue-800 italic font-bold hover:underline text-left">{r.taxonName}</button>
          )},
          { key:'source', header:'Source', render: (r) => <SourceChip source={r.source}/> },
          { key:'externalId', header:'Identifier', cellClass:'font-mono text-[11.5px]', render: (r) => r.externalId },
          { key:'locality', header:'Locality', render: (r) => <span>{r.county} Co., {r.state}</span> },
          { key:'observedAt', header:'Date', render: (r) => fmtDate(r.observedAt) },
          { key:'collector', header:'Collector / observer' },
          { key:'status', header:'Status', render: (r) => (
            <Badge tone={r.status === 'accepted' ? 'success' : r.status === 'flagged' ? 'warning' : r.status === 'rejected' ? 'neutral' : 'blue'} size="sm">{r.status}</Badge>
          )},
          { key:'actions', header:'', align:'right', render: (r) => (
            <a className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[12px]" href="#" onClick={(e) => e.preventDefault()}>
              source <window.Icons.External size={11}/>
            </a>
          )},
        ]}
      />
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.ChecklistScreen = ChecklistScreen;
