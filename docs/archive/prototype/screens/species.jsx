/* global window, React */
// =========================================================================
// Species detail — choropleth, record list, taxonomy panel, comments, and
// per-record triage mode (with keyboard nav J/K and actions A/R/F/C).
// =========================================================================
const { useState: useState_sp, useEffect: useEffect_sp, useMemo: useMemo_sp, useRef: useRef_sp } = React;

function SpeciesScreen({ project, taxa, taxonId, recordsByTaxon, comments, onMutate, onBack, onOpenConflicts, conflicts }) {
  const {
    Button, Card, Badge, InclusionBadge, SourceChip, Segmented, Eyebrow, H3, Sheet, Avatar, TextArea, FilterChip,
    useToast, DataTable, KbdHint,
  } = window.UI;
  const { CountyChoropleth } = window.MAP;
  const { fmtDate, fmtN } = window.UTIL;
  const toast = useToast();

  // Fall back to first taxon if none provided
  const taxon = taxa.find(t => t.id === taxonId) || taxa[0];
  const records = recordsByTaxon[taxon.id] || [];
  const conflict = conflicts.find(c => c.taxonId === taxon.id && !c.resolution);

  const [mode, setMode] = useState_sp('overview');       // 'overview' | 'triage'
  const [mapMode, setMapMode] = useState_sp('count');    // 'count' | 'binary'
  const [reasoning, setReasoning] = useState_sp(taxon.inclusionReasoning || '');
  const [commentOpen, setCommentOpen] = useState_sp(false);
  const [commentDraft, setCommentDraft] = useState_sp('');
  const [highlightFips, setHighlightFips] = useState_sp(null);

  // Triage state
  const [triageIdx, setTriageIdx] = useState_sp(0);
  const [triageFilter, setTriageFilter] = useState_sp('all');
  const triageList = useMemo_sp(() => {
    if (triageFilter === 'all') return records;
    return records.filter(r => r.status === triageFilter);
  }, [triageFilter, records]);

  const taxonComments = comments[taxon.id] || [];

  const setInclusion = (v) => {
    onMutate({ type:'setInclusion', ids:[taxon.id], value:v, reasoning });
    toast.push({ tone: v === 'include' ? 'success' : v === 'exclude' ? 'info' : 'warning',
      title: v === 'include' ? 'Marked included' : v === 'exclude' ? 'Marked excluded' : 'Marked undecided',
      message: taxon.scientificName,
      onUndo: () => onMutate({ type:'undoLast' }) });
  };

  // Record actions
  const setRecordStatus = (recordId, status, msg) => {
    onMutate({ type:'setRecordStatus', taxonId: taxon.id, recordId, status });
    toast.push({ tone: status === 'accepted' ? 'success' : status === 'rejected' ? 'info' : 'warning',
      title: msg, message: recordId, onUndo: () => onMutate({ type:'undoLast' }) });
  };
  const bulkRejectOutOfRange = () => {
    const ids = records.filter(r => r.isLikelyOutOfRange && r.status !== 'rejected').slice(0, 12).map(r => r.id);
    onMutate({ type:'bulkRecordStatus', taxonId: taxon.id, recordIds: ids, status:'rejected', note:'Out of stated range; locality precision >25 km.' });
    toast.push({ tone:'info', title:`Rejected ${ids.length} records`, message:'Reason: out of stated range', onUndo: () => onMutate({ type:'undoLast' }) });
  };

  // Keyboard shortcuts (only in triage mode)
  useEffect_sp(() => {
    if (mode !== 'triage') return;
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const cur = triageList[triageIdx];
      if (!cur) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setTriageIdx(i => Math.min(i + 1, triageList.length - 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setTriageIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === 'a' || e.key === 'A') { e.preventDefault(); setRecordStatus(cur.id, 'accepted', 'Accepted'); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); setRecordStatus(cur.id, 'rejected', 'Rejected'); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setRecordStatus(cur.id, 'flagged', 'Flagged for review'); }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); setCommentOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, triageIdx, triageList]);

  const cur = triageList[triageIdx];

  return (
    <div className="max-w-[1380px] mx-auto px-8 py-7">
      {/* Breadcrumb + actions */}
      <div className="flex items-center gap-3 mb-4 text-[12.5px]">
        <button onClick={onBack} className="text-text-500 hover:text-text-700 inline-flex items-center gap-1">
          <window.Icons.ChevronLeft size={13}/> Back to Checklist
        </button>
        <span className="text-text-300">/</span>
        <span className="text-text-500 italic">{taxon.scientificName}</span>
        <div className="flex-1"/>
        <Segmented value={mode} onChange={setMode} options={[{value:'overview',label:'Overview'},{value:'triage',label:`Triage records (${records.length})`}]}/>
      </div>

      {/* Title */}
      <div className="flex items-end justify-between gap-4 mb-1 flex-wrap">
        <div>
          <Eyebrow className="mb-2 flex items-center gap-2"><span>SPECIES · {taxon.family.toUpperCase()}</span></Eyebrow>
          <h1 className="text-[34px] font-black text-blue-800 leading-tight italic" style={{letterSpacing:'-0.012em'}}>
            {taxon.scientificName}
            <span className="ml-2 text-[16px] not-italic font-normal text-text-500">{taxon.authority}</span>
          </h1>
          <div className="text-[12.5px] text-text-500 mt-1 flex items-center gap-3 flex-wrap">
            <InclusionBadge state={taxon.inclusion}/>
            <span>{taxon.nRecords} records</span>
            <span className="text-text-300">·</span>
            <span>{taxon.nCounties} of 92 counties</span>
            <span className="text-text-300">·</span>
            <span>sources:</span>
            {taxon.sources.includes('gbif') && <SourceChip source="gbif" size="xs"/>}
            {taxon.sources.includes('inat') && <SourceChip source="inat" size="xs"/>}
            {taxon.hasConflict && (
              <button onClick={onOpenConflicts} className="inline-flex items-center gap-1 text-warning-700 font-bold hover:underline">
                <window.Icons.Conflict size={12}/> taxonomy conflict
              </button>
            )}
          </div>
        </div>

        {mode === 'overview' && (
          <div className="flex items-center gap-2">
            <Button variant={taxon.inclusion === 'exclude' ? 'primary' : 'secondary'} icon={<window.Icons.X size={13}/>} onClick={() => setInclusion('exclude')}>Exclude</Button>
            <Button variant={taxon.inclusion === 'include' ? 'primary' : 'secondary'} icon={<window.Icons.Check size={13}/>} onClick={() => setInclusion('include')}>Include</Button>
          </div>
        )}
      </div>

      {mode === 'overview' ? (
        <SpeciesOverview
          taxon={taxon} records={records} conflict={conflict}
          mapMode={mapMode} setMapMode={setMapMode}
          comments={taxonComments} commentOpen={commentOpen} setCommentOpen={setCommentOpen}
          commentDraft={commentDraft} setCommentDraft={setCommentDraft}
          onSubmitComment={() => { onMutate({ type:'addComment', taxonId: taxon.id, text: commentDraft }); setCommentDraft(''); setCommentOpen(false); toast.push({ tone:'success', title:'Comment added' }); }}
          reasoning={reasoning} setReasoning={setReasoning}
          highlightFips={highlightFips} setHighlightFips={setHighlightFips}
          onBulkRejectOutOfRange={bulkRejectOutOfRange}
          setMode={setMode}
        />
      ) : (
        <SpeciesTriage
          taxon={taxon} records={records} triageList={triageList} triageIdx={triageIdx} setTriageIdx={setTriageIdx}
          triageFilter={triageFilter} setTriageFilter={setTriageFilter}
          cur={cur} setRecordStatus={setRecordStatus} bulkRejectOutOfRange={bulkRejectOutOfRange}
          commentOpen={commentOpen} setCommentOpen={setCommentOpen}
          commentDraft={commentDraft} setCommentDraft={setCommentDraft}
          onSubmitComment={() => { onMutate({ type:'addComment', taxonId: taxon.id, text: commentDraft, recordId: cur && cur.id }); setCommentDraft(''); setCommentOpen(false); toast.push({ tone:'success', title:'Comment added' }); }}
        />
      )}
    </div>
  );
}

// -------- Species overview view -----------------------------------------
function SpeciesOverview({
  taxon, records, conflict, mapMode, setMapMode, comments, commentOpen, setCommentOpen, commentDraft, setCommentDraft, onSubmitComment, reasoning, setReasoning, highlightFips, setHighlightFips, onBulkRejectOutOfRange, setMode,
}) {
  const { Card, Eyebrow, Badge, SourceChip, Segmented, Button, H3, Avatar, TextArea } = window.UI;
  const { CountyChoropleth } = window.MAP;
  const { fmtDate, fmtN, relTime } = window.UTIL;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-5">
      {/* Map */}
      <Card className="xl:col-span-8 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Eyebrow>COUNTY DISTRIBUTION</Eyebrow>
            <H3 className="mt-1">Indiana · all sources</H3>
          </div>
          <div className="flex items-center gap-2">
            <Segmented value={mapMode} onChange={setMapMode} options={[
              { value:'count', label:'Record count'}, { value:'binary', label:'Presence / absence'}
            ]}/>
            <Button variant="secondary" size="sm" icon={<window.Icons.Download size={12}/>}>SVG · PNG · PDF</Button>
          </div>
        </div>
        <div className="flex justify-center">
          <CountyChoropleth countyPresence={taxon.countyPresence} mode={mapMode} highlightFips={highlightFips}
            citeOnlyCounties={new Set(window.MOCK.MANUAL_ENTRIES.filter(m => m.taxonId === taxon.id).map(m => m.countyFips))}/>
        </div>
        <div className="flex items-center gap-4 text-[11.5px] text-text-400 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 border border-gray-300 rounded-sm" style={{background:'repeating-linear-gradient(45deg, #FFFFFF 0 3px, #0E7693 3px 5px)'}}/>
            = cite-only county
          </span>
          <span>Hover any county for record count. Click to open record triage filtered to that county.</span>
          <span className="ml-auto font-mono">projection · cartogram · cells 26px</span>
        </div>
      </Card>

      {/* Taxonomy + decision */}
      <div className="xl:col-span-4 space-y-5">
        <Card className="p-5">
          <Eyebrow>TAXONOMY</Eyebrow>
          <H3 className="mt-1">Backbone disagreement</H3>
          <div className="space-y-3 mt-2">
            <BackboneRow source="gbif" name={taxon.scientificName} authority={taxon.authority} count={taxon.nRecords - 12}/>
            <BackboneRow source="inat" name={conflict ? conflict.inatName : taxon.scientificName} authority={taxon.authority} count={12}/>
          </div>
          {conflict ? (
            <div className="mt-4 p-3 bg-warning-50 border border-[#FCE2B0] rounded text-[12.5px] text-warning-700 flex items-start gap-2">
              <window.Icons.Conflict size={12} className="mt-0.5"/>
              <div className="flex-1">
                <div className="font-bold">Unresolved conflict</div>
                <div className="mt-0.5">{conflict.note}</div>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-success-50 border border-[#CEEDD7] rounded text-[12.5px] text-success-700 flex items-start gap-2">
              <window.Icons.Check size={12} stroke={3} className="mt-0.5"/>
              GBIF and iNat agree on this species concept.
            </div>
          )}
          <div className="mt-4 text-[11.5px] text-text-400 font-mono">GBIF taxonKey: 4734451 · iNat taxon_id: 127344</div>
        </Card>

        <Card className="p-5">
          <Eyebrow>INCLUSION DECISION</Eyebrow>
          <H3 className="mt-1">Reasoning</H3>
          <TextArea value={reasoning} onChange={(e) => setReasoning(e.target.value)} rows={4}
            placeholder="State the reason for including or excluding this species. Will appear in the Activity log and DOCX methods section."
            hint="Plain text · markdown formatting not rendered in exports."/>
        </Card>
      </div>

      {/* Record list */}
      <Card className="xl:col-span-8 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Eyebrow>RECORDS</Eyebrow>
            <H3 className="mt-1">{taxon.nRecords} records · this is a sample of {records.length} loaded for triage</H3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<window.Icons.Flag size={12}/>} onClick={onBulkRejectOutOfRange}>Quick-reject likely out-of-range (12)</Button>
            <Button variant="primary" size="sm" icon={<window.Icons.ArrowRight size={13}/>} onClick={() => setMode('triage')}>Open triage mode →</Button>
          </div>
        </div>
        <div className="overflow-hidden border border-surface-3 rounded-md">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-1 border-b border-surface-3 text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
              <tr>
                <th className="px-3 py-2 font-bold">Source</th>
                <th className="px-3 py-2 font-bold">Identifier</th>
                <th className="px-3 py-2 font-bold">County</th>
                <th className="px-3 py-2 font-bold">Date</th>
                <th className="px-3 py-2 font-bold">Collector / observer</th>
                <th className="px-3 py-2 font-bold">Quality</th>
                <th className="px-3 py-2 font-bold">Status</th>
                <th className="px-3 py-2 font-bold w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3">
              {records.slice(0, 9).map(r => (
                <tr key={r.id} className="hover:bg-surface-1"
                    onMouseEnter={() => setHighlightFips(r.countyFips)}
                    onMouseLeave={() => setHighlightFips(null)}>
                  <td className="px-3 py-2"><SourceChip source={r.source} size="xs"/></td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-text-500">{r.externalId}</td>
                  <td className="px-3 py-2">{r.county} Co.</td>
                  <td className="px-3 py-2 text-text-500">{fmtDate(r.observedAt)}</td>
                  <td className="px-3 py-2 text-text-500">{r.collector}</td>
                  <td className="px-3 py-2">
                    {r.inatQuality === 'research' && <Badge tone="success" size="sm">research</Badge>}
                    {r.inatQuality === 'needs_id' && <Badge tone="warning" size="sm">needs id</Badge>}
                    {!r.inatQuality && <span className="text-text-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={r.status === 'accepted' ? 'success' : r.status === 'flagged' ? 'warning' : r.status === 'rejected' ? 'neutral' : 'blue'} size="sm">{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a href="#" onClick={(e) => e.preventDefault()} className="text-blue-600 hover:underline text-[12px]">
                      <window.Icons.External size={12} className="inline align-middle"/>
                    </a>
                  </td>
                </tr>
              ))}
              {window.MOCK.MANUAL_ENTRIES.filter(m => m.taxonId === taxon.id).map(m => (
                <tr key={m.id} className="bg-cyan-50/30">
                  <td className="px-3 py-2"><SourceChip source="cite" size="xs"/></td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-text-500">{m.id}</td>
                  <td className="px-3 py-2">{m.county} Co.</td>
                  <td className="px-3 py-2 text-text-500">—</td>
                  <td className="px-3 py-2 text-text-500 italic">{m.addedBy}</td>
                  <td className="px-3 py-2"><Badge tone="cyan" size="sm">cite-only</Badge></td>
                  <td className="px-3 py-2"><Badge tone="success" size="sm">accepted</Badge></td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-blue-600 hover:underline text-[12px] cursor-pointer" title={m.citation}>
                      <window.Icons.Quote size={12} className="inline align-middle"/>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-[11.5px] text-text-400 mt-2 font-mono">
          <span>Showing 9 of {records.length} loaded · {taxon.nRecords - records.length} more in DB</span>
          <span>Switch to <span className="text-blue-600 font-semibold">Triage</span> mode for keyboard-driven review.</span>
        </div>
      </Card>

      {/* Comments */}
      <Card className="xl:col-span-4 p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <Eyebrow>DISCUSSION</Eyebrow>
            <H3 className="mt-1">Comments</H3>
          </div>
          <Button variant="secondary" size="sm" icon={<window.Icons.Plus size={12}/>} onClick={() => setCommentOpen(true)}>New</Button>
        </div>
        <div className="space-y-4 mt-2 max-h-[280px] overflow-y-auto nice-scroll -mx-5 px-5">
          {comments.length === 0 && <div className="text-[13px] text-text-400">No comments yet.</div>}
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar initials={c.author} size={26}/>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-text-500 mb-0.5">
                  <span className="font-bold text-text-700">{c.author}</span> · <span className="font-mono">{relTime(c.ts)}</span>
                </div>
                <div className="text-[13px] text-text-600 leading-relaxed">{c.text}</div>
              </div>
            </div>
          ))}
          {commentOpen && (
            <div className="border border-blue-200 rounded-md p-2 bg-blue-50/30">
              <TextArea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} rows={3} placeholder="Add a comment to this species…"/>
              <div className="flex items-center justify-end gap-2 mt-2">
                <Button variant="ghost" size="sm" onClick={() => setCommentOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" disabled={!commentDraft.trim()} onClick={onSubmitComment}>Post</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function BackboneRow({ source, name, authority, count }) {
  const { SourceChip } = window.UI;
  return (
    <div className="flex items-start gap-2.5 border border-surface-3 rounded-md p-2.5 bg-white">
      <SourceChip source={source} size="xs"/>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-blue-800 font-bold italic leading-tight">{name} <span className="text-[11.5px] not-italic font-normal text-text-500 ml-1">{authority}</span></div>
        <div className="text-[11.5px] text-text-400 font-mono mt-0.5">{count} records mapped under this name</div>
      </div>
    </div>
  );
}

// -------- Triage mode ---------------------------------------------------
function SpeciesTriage({
  taxon, records, triageList, triageIdx, setTriageIdx,
  triageFilter, setTriageFilter, cur, setRecordStatus, bulkRejectOutOfRange,
  commentOpen, setCommentOpen, commentDraft, setCommentDraft, onSubmitComment,
}) {
  const { Card, Eyebrow, Badge, Button, SourceChip, KbdHint, FilterChip, Avatar, TextArea } = window.UI;
  const { CountyChoropleth } = window.MAP;
  const { fmtDate } = window.UTIL;

  const counts = {
    all: records.length,
    accepted: records.filter(r => r.status === 'accepted').length,
    pending: records.filter(r => r.status === 'pending').length,
    flagged: records.filter(r => r.status === 'flagged').length,
    rejected: records.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="mt-5">
      {/* Triage filter bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <FilterChip active={triageFilter === 'all'}      onClick={() => { setTriageFilter('all');      setTriageIdx(0); }} count={counts.all}>All</FilterChip>
        <FilterChip active={triageFilter === 'accepted'} onClick={() => { setTriageFilter('accepted'); setTriageIdx(0); }} count={counts.accepted}>Accepted</FilterChip>
        <FilterChip active={triageFilter === 'pending'}  onClick={() => { setTriageFilter('pending');  setTriageIdx(0); }} count={counts.pending}>Pending</FilterChip>
        <FilterChip active={triageFilter === 'flagged'}  onClick={() => { setTriageFilter('flagged');  setTriageIdx(0); }} count={counts.flagged}>Flagged</FilterChip>
        <FilterChip active={triageFilter === 'rejected'} onClick={() => { setTriageFilter('rejected'); setTriageIdx(0); }} count={counts.rejected}>Rejected</FilterChip>
        <div className="flex-1"/>
        <Button variant="secondary" size="sm" icon={<window.Icons.Flag size={12}/>} onClick={bulkRejectOutOfRange}>Quick-reject likely out-of-range (12)</Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Record list (left) */}
        <Card className="col-span-4 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-surface-3 bg-surface-1 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-text-500">{triageList.length} records</span>
            <span className="text-[11px] text-text-400 font-mono">{triageIdx + 1} / {triageList.length}</span>
          </div>
          <div className="max-h-[560px] overflow-y-auto nice-scroll">
            {triageList.map((r, i) => (
              <button key={r.id} onClick={() => setTriageIdx(i)}
                className={`w-full text-left px-3 py-2.5 border-b border-surface-3 last:border-b-0 transition-colors flex items-center gap-2
                  ${i === triageIdx ? 'bg-blue-50/70' : 'hover:bg-surface-1'}`}>
                <SourceChip source={r.source} size="xs"/>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-text-700 truncate">{r.county} Co.</div>
                  <div className="text-[11px] text-text-400 font-mono mt-0.5 truncate">{r.externalId}</div>
                </div>
                <Badge tone={r.status === 'accepted' ? 'success' : r.status === 'flagged' ? 'warning' : r.status === 'rejected' ? 'neutral' : 'blue'} size="xs">{r.status[0].toUpperCase()}</Badge>
              </button>
            ))}
          </div>
        </Card>

        {/* Detail (center) */}
        <div className="col-span-5">
          {cur ? (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <SourceChip source={cur.source}/>
                  <Badge tone={cur.status === 'accepted' ? 'success' : cur.status === 'flagged' ? 'warning' : cur.status === 'rejected' ? 'neutral' : 'blue'} size="sm">{cur.status}</Badge>
                  {cur.isLikelyOutOfRange && <Badge tone="warning" size="sm" icon={<window.Icons.Sparkles size={10}/>}>system-inferred · out of stated range</Badge>}
                </div>
                <a className="text-blue-600 hover:underline text-[12px] inline-flex items-center gap-1" href="#" onClick={(e) => e.preventDefault()}>
                  view source <window.Icons.External size={11}/>
                </a>
              </div>
              <h2 className="text-[20px] font-black text-blue-800 leading-tight" style={{letterSpacing:'-0.01em'}}>
                <span className="italic">{taxon.scientificName}</span> · {cur.county} Co.
              </h2>
              <div className="text-[12.5px] text-text-500 mt-0.5">
                <span className="font-mono">{cur.externalId}</span>
                <span className="mx-1.5 text-text-300">·</span>
                <span>{fmtDate(cur.observedAt)}</span>
                <span className="mx-1.5 text-text-300">·</span>
                <span>{cur.lat.toFixed(4)}°N, {(-cur.lng).toFixed(4)}°W</span>
              </div>

              {/* Image placeholder */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="col-span-2 stripes h-[220px] rounded-md border border-surface-3 flex items-center justify-center text-text-400 text-[12px] font-mono">
                  {cur.imageUrl ? 'iNat observation photo' : 'no media · GBIF specimen record'}
                </div>
                <div className="space-y-2 text-[12.5px]">
                  <Field2 label="Collector / observer" value={cur.collector}/>
                  <Field2 label="State" value={cur.state}/>
                  <Field2 label="County FIPS" value={<span className="font-mono">{cur.countyFips}</span>}/>
                  {cur.inatQuality && <Field2 label="iNat quality" value={<Badge tone={cur.inatQuality === 'research' ? 'success' : 'warning'} size="sm">{cur.inatQuality}</Badge>}/>}
                  {cur.flagReason && <Field2 label="Flag reason" value={<span className="text-warning-700">{cur.flagReason}</span>}/>}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center gap-2 flex-wrap">
                <Button variant={cur.status === 'accepted' ? 'primary' : 'secondary'} icon={<window.Icons.Check size={13}/>} onClick={() => setRecordStatus(cur.id, 'accepted', 'Accepted')}>
                  Accept <kbd className="ml-1.5">A</kbd>
                </Button>
                <Button variant={cur.status === 'rejected' ? 'primary' : 'secondary'} icon={<window.Icons.X size={13}/>} onClick={() => setRecordStatus(cur.id, 'rejected', 'Rejected')}>
                  Reject <kbd className="ml-1.5">R</kbd>
                </Button>
                <Button variant={cur.status === 'flagged' ? 'primary' : 'secondary'} icon={<window.Icons.Flag size={13}/>} onClick={() => setRecordStatus(cur.id, 'flagged', 'Flagged for review')}>
                  Flag <kbd className="ml-1.5">F</kbd>
                </Button>
                <Button variant="secondary" icon={<window.Icons.Comment size={13}/>} onClick={() => setCommentOpen(true)}>
                  Comment <kbd className="ml-1.5">C</kbd>
                </Button>
                <div className="flex-1"/>
                <KbdHint k="J" label="next"/>
                <KbdHint k="K" label="prev"/>
              </div>

              {/* Inline comment */}
              {commentOpen && (
                <div className="mt-4 border border-blue-200 rounded-md p-3 bg-blue-50/30">
                  <TextArea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} rows={3}
                    placeholder={`Comment on ${cur.externalId}…`}/>
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => setCommentOpen(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" disabled={!commentDraft.trim()} onClick={onSubmitComment}>Post</Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-10 text-center">
              <div className="text-text-400">No records in this filter.</div>
            </Card>
          )}
        </div>

        {/* Map mini (right) */}
        <div className="col-span-3 space-y-4">
          <Card className="p-3">
            <Eyebrow>POSITION</Eyebrow>
            <div className="text-[13px] text-text-600 mt-1 mb-2">{cur ? cur.county : '—'} Co.</div>
            <div className="flex justify-center">
              <CountyChoropleth countyPresence={taxon.countyPresence} size="sm" mode="binary" highlightFips={cur && cur.countyFips} showLabels={false} showLegend={false}/>
            </div>
          </Card>
          <Card className="p-3">
            <Eyebrow>KEYBOARD</Eyebrow>
            <div className="space-y-2 mt-2">
              <KbdHint k="J" label="next record"/>
              <KbdHint k="K" label="previous"/>
              <KbdHint k="A" label="accept"/>
              <KbdHint k="R" label="reject"/>
              <KbdHint k="F" label="flag"/>
              <KbdHint k="C" label="comment"/>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field2({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-text-400">{label}</div>
      <div className="text-[13px] text-text-700 mt-0.5">{value}</div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.SpeciesScreen = SpeciesScreen;
