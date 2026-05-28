/* global window, React */
// =========================================================================
// Conflicts — list of GBIF↔iNat naming disagreements. No default resolution.
// =========================================================================
const { useState: useState_cf } = React;

function ConflictsScreen({ conflicts, taxa, onMutate }) {
  const { Card, Eyebrow, Badge, Button, H3, Radio, FilterChip, SourceChip, useToast, TextField } = window.UI;
  const toast = useToast();
  const [filter, setFilter] = useState_cf('open');
  const [drafts, setDrafts] = useState_cf({}); // {conflictId: 'gbif'|'inat'|'separate'|'merged'}
  const [customName, setCustomName] = useState_cf({}); // for merged

  const filtered = conflicts.filter(c => filter === 'all' ? true : filter === 'open' ? !c.resolution : !!c.resolution);

  const resolve = (cid) => {
    const choice = drafts[cid];
    if (!choice) return;
    onMutate({ type:'resolveConflict', conflictId: cid, resolution: choice, custom: customName[cid] });
    const c = conflicts.find(c => c.id === cid);
    const verb = ({
      gbif:`Resolved · Use GBIF name (${c.gbifName})`,
      inat:`Resolved · Use iNat name (${c.inatName})`,
      separate:'Resolved · Treat as separate species',
      merged:`Resolved · Merge under custom name "${customName[cid] || '—'}"`,
    })[choice];
    toast.push({ tone:'success', title: verb, message: `iNat records re-mapped under chosen taxon.`, onUndo: () => onMutate({ type:'undoLast' }) });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">TAXONOMIC CONFLICTS</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">{conflicts.filter(c => !c.resolution).length} unresolved disagreements</h1>
          <p className="text-[13.5px] text-text-500 mt-1 max-w-2xl">GBIF and iNaturalist sometimes treat the same taxon under different concepts. Each conflict requires an explicit choice — no resolution is pre-selected.</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterChip active={filter === 'open'} onClick={() => setFilter('open')} count={conflicts.filter(c => !c.resolution).length}>Unresolved</FilterChip>
          <FilterChip active={filter === 'all'}  onClick={() => setFilter('all')}  count={conflicts.length}>All</FilterChip>
          <FilterChip active={filter === 'resolved'} onClick={() => setFilter('resolved')} count={conflicts.filter(c => c.resolution).length}>Resolved</FilterChip>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map(c => {
          const choice = drafts[c.id] || null;
          const isResolved = !!c.resolution;
          return (
            <Card key={c.id} className="p-5" accent={!isResolved}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {!isResolved
                      ? <Badge tone="warning" size="sm" icon={<window.Icons.Conflict size={11}/>}>unresolved</Badge>
                      : <Badge tone="success" size="sm" icon={<window.Icons.Check size={11} stroke={2.5}/>}>resolved</Badge>}
                    <span className="text-[11.5px] text-text-400 font-mono">{c.id} · taxon_conflicts.id</span>
                  </div>
                  <h3 className="text-[18px] font-bold text-blue-800">
                    <span className="italic">{c.gbifName}</span> <span className="text-text-300 mx-1">↔</span> <span className="italic">{c.inatName}</span>
                  </h3>
                  <p className="text-[12.5px] text-text-500 mt-1 max-w-2xl">{c.note}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <ConflictSourcePanel source="gbif" name={c.gbifName} authority={c.gbifAuthority} count={c.gbifRecords}/>
                <ConflictSourcePanel source="inat" name={c.inatName} authority={c.inatAuthority} count={c.inatRecords}/>
              </div>

              {!isResolved ? (
                <div className="mt-4 border-t border-surface-3 pt-4">
                  <div className="text-[12px] font-bold text-text-700 uppercase tracking-[0.1em] mb-2.5">Resolution · no default selected</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Radio label={<>Use GBIF name <em className="font-normal text-text-500">{c.gbifName}</em></>}
                      sub={`${c.inatRecords} iNat records will be re-mapped under this taxon.`}
                      checked={choice === 'gbif'} onChange={() => setDrafts({...drafts, [c.id]:'gbif'})}/>
                    <Radio label={<>Use iNat name <em className="font-normal text-text-500">{c.inatName}</em></>}
                      sub={`${c.gbifRecords} GBIF records will be re-mapped under this taxon.`}
                      checked={choice === 'inat'} onChange={() => setDrafts({...drafts, [c.id]:'inat'})}/>
                    <Radio label="Treat as separate species"
                      sub="Both names appear in the checklist with their own records."
                      checked={choice === 'separate'} onChange={() => setDrafts({...drafts, [c.id]:'separate'})}/>
                    <Radio label="Merge under custom name"
                      sub="Combined record count under a name you choose."
                      checked={choice === 'merged'} onChange={() => setDrafts({...drafts, [c.id]:'merged'})}/>
                  </div>
                  {choice === 'merged' && (
                    <div className="mt-3 max-w-md">
                      <TextField label="Custom scientific name" placeholder={`e.g. ${c.gbifName} sensu lato`}
                        value={customName[c.id] || ''} onChange={(e) => setCustomName({...customName, [c.id]: e.target.value})}/>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <Button variant="ghost" onClick={() => setDrafts({...drafts, [c.id]: null})}>Reset</Button>
                    <Button variant="primary" disabled={!choice || (choice === 'merged' && !customName[c.id])} onClick={() => resolve(c.id)}>Apply resolution</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-surface-3 pt-3 text-[12.5px] text-success-700 bg-success-50 px-3 py-2 rounded flex items-center gap-2">
                  <window.Icons.Check size={12} stroke={3}/>
                  <span>
                    Resolved as <span className="font-bold">{c.resolution === 'gbif' ? `Use GBIF name (${c.gbifName})`
                      : c.resolution === 'inat' ? `Use iNat name (${c.inatName})`
                      : c.resolution === 'separate' ? 'Treat as separate species'
                      : `Merge under custom name`}</span>
                  </span>
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <window.UI.EmptyState
            icon={<window.Icons.Check size={20} stroke={2.5}/>}
            title="No conflicts to show"
            body="All taxonomic disagreements between GBIF and iNaturalist for this project have been resolved."/>
        )}
      </div>
    </div>
  );
}

function ConflictSourcePanel({ source, name, authority, count }) {
  const { SourceChip } = window.UI;
  return (
    <div className="border border-surface-3 rounded-md p-3 bg-white">
      <div className="flex items-center gap-2 mb-1.5">
        <SourceChip source={source} size="xs"/>
        <span className="text-[11px] uppercase tracking-[0.1em] font-bold text-text-500">{source === 'gbif' ? 'GBIF backbone' : 'iNaturalist taxonomy'}</span>
      </div>
      <div className="text-[15px] font-bold text-blue-800 italic">{name}
        <span className="ml-1.5 text-[12px] font-normal not-italic text-text-500">{authority}</span>
      </div>
      <div className="text-[12px] text-text-500 mt-2 font-mono">{count} records mapped under this name</div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.ConflictsScreen = ConflictsScreen;
