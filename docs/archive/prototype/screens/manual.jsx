/* global window, React */
// =========================================================================
// Manual entries — cite-only records, augmenting the dataset.
// =========================================================================
const { useState: useState_man } = React;

function ManualScreen({ taxa, manual, onMutate }) {
  const { Card, Eyebrow, Badge, Button, H3, SourceChip, Sheet, TextField, TextArea, useToast, DataTable, FilterChip } = window.UI;
  const { fmtDate, fmtDateTime } = window.UTIL;
  const toast = useToast();
  const [open, setOpen] = useState_man(false);
  const [draft, setDraft] = useState_man({
    taxonId: '', taxonName: '', county: '', countyFips: '', citation: '', doi: '', notes: '',
    addNewTaxon: false, newTaxonName: '',
  });

  const submit = () => {
    onMutate({ type:'addManual', entry: draft });
    toast.push({ tone:'success', title:'Cite-only record added', message:`${draft.taxonName} · ${draft.county} Co.`, onUndo: () => onMutate({ type:'undoLast' }) });
    setDraft({ taxonId:'', taxonName:'', county:'', countyFips:'', citation:'', doi:'', notes:'', addNewTaxon:false, newTaxonName:'' });
    setOpen(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">MANUAL ENTRIES · CITE-ONLY</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">{manual.length} cite-only record{manual.length === 1 ? '' : 's'}</h1>
          <p className="text-[13.5px] text-text-500 mt-1 max-w-2xl">Records you've added based on the literature — appear in the checklist clearly badged so they're never confused with API-sourced occurrences.</p>
        </div>
        <Button variant="primary" icon={<window.Icons.Plus size={13}/>} onClick={() => setOpen(true)}>Add cite-only record</Button>
      </div>

      {manual.length > 0 ? (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-1 border-b border-surface-3 text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-bold">Species</th>
                <th className="px-3 py-2.5 font-bold">County</th>
                <th className="px-3 py-2.5 font-bold">Citation</th>
                <th className="px-3 py-2.5 font-bold">Notes</th>
                <th className="px-3 py-2.5 font-bold">Added by</th>
                <th className="px-4 py-2.5 font-bold text-right">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3">
              {manual.map(m => (
                <tr key={m.id} className="hover:bg-surface-1">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <SourceChip source="cite" size="xs"/>
                      <span className="italic font-bold text-blue-800">{m.taxonName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-text-700">{m.county} Co.<span className="ml-1.5 font-mono text-[11px] text-text-400">{m.countyFips}</span></td>
                  <td className="px-3 py-3 text-text-500 max-w-[480px]">
                    <div className="text-[12.5px] leading-snug">{m.citation}</div>
                    {m.doi && <div className="font-mono text-[11px] text-blue-600 mt-1">DOI: {m.doi}</div>}
                  </td>
                  <td className="px-3 py-3 text-text-500 text-[12px] max-w-[240px]">{m.notes || <span className="text-text-300">—</span>}</td>
                  <td className="px-3 py-3 text-text-500">{m.addedBy}</td>
                  <td className="px-4 py-3 text-right text-[12px] text-text-400 font-mono">{fmtDateTime(m.addedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <window.UI.EmptyState
          icon={<window.Icons.Pencil size={20}/>}
          title="No cite-only records yet"
          body="Add records you've found in the literature that aren't in GBIF or iNat. They'll show up in the species checklist with a Cite badge and a citation tooltip."
          action={<Button variant="primary" icon={<window.Icons.Plus size={13}/>} onClick={() => setOpen(true)}>Add the first one</Button>}/>
      )}

      <Sheet open={open} onClose={() => setOpen(false)}
        title="Add a cite-only record"
        subtitle="Documents a county-level presence record from the literature."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={!draft.taxonName || !draft.county || !draft.citation}>Save record</Button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <div className="text-[12.5px] font-semibold text-text-600 mb-1.5">Species</div>
            <TaxonAutocomplete value={draft.taxonName} onPick={(t) => setDraft({...draft, taxonId: t.id || '', taxonName: t.name, addNewTaxon: t.isNew })} taxa={taxa}/>
            {draft.addNewTaxon && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded text-[12px] text-blue-800 flex items-start gap-2">
                <window.Icons.Plus size={12} className="mt-0.5"/>
                Adding <em className="font-bold">{draft.taxonName}</em> as a new taxon. It will appear in the checklist with source <code className="font-mono">manual</code>.
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CountyDropdown value={draft.county} onChange={(name, fips) => setDraft({...draft, county: name, countyFips: fips})}/>
            <TextField label="DOI (optional)" placeholder="10.5281/zenodo.4456789" value={draft.doi} onChange={(e) => setDraft({...draft, doi: e.target.value})}/>
          </div>
          <TextArea label="Citation" rows={3} placeholder="Steiner, W.E. & Triplehorn, C.A. (2010). The genera of darkling beetles (Coleoptera: Tenebrionidae) of eastern North America. Insecta Mundi 0146: 1–66."
            value={draft.citation} onChange={(e) => setDraft({...draft, citation: e.target.value})}
            hint="Plain text. CSL-JSON structured entry is on the roadmap."/>
          <TextArea label="Notes" rows={3} placeholder="Optional — what does the record document? Any caveats?"
            value={draft.notes} onChange={(e) => setDraft({...draft, notes: e.target.value})}/>
          <div className="text-[12px] text-text-500 bg-surface-1 border border-surface-3 rounded p-3">
            Cite-only records do not contribute to county <em>record-count</em> heatmaps, but they <em>do</em> establish county presence and are surfaced on the choropleth via diagonal stripes.
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function TaxonAutocomplete({ value, onPick, taxa }) {
  const [q, setQ] = useState_man(value || '');
  const [open, setOpen] = useState_man(false);
  const filtered = q ? taxa.filter(t => t.scientificName.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  const hasExact = filtered.some(t => t.scientificName.toLowerCase() === q.toLowerCase());
  return (
    <div className="relative">
      <window.UI.TextField placeholder="Type a species name…" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        leftIcon={<window.Icons.Search size={13}/>}
      />
      {open && q && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-surface-3 rounded-md shadow-pop z-10 overflow-hidden">
          {filtered.map(t => (
            <button key={t.id} onClick={() => { onPick({ id: t.id, name: t.scientificName }); setQ(t.scientificName); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2">
              <window.UI.SourceChip source={t.sources[0] || 'gbif'} size="xs"/>
              <span className="italic text-blue-800 font-bold text-[13px]">{t.scientificName}</span>
              <span className="text-[11.5px] text-text-400 ml-auto">{t.family}</span>
            </button>
          ))}
          {!hasExact && (
            <button onClick={() => { onPick({ id: '', name: q, isNew: true }); setOpen(false); }}
              className="w-full text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 flex items-center gap-2 border-t border-surface-3 text-blue-800 font-semibold">
              <window.Icons.Plus size={12}/> Add new taxon: <em className="italic">{q}</em>
            </button>
          )}
          {filtered.length === 0 && hasExact === false && !q && <div className="px-3 py-2 text-text-400 text-[12px]">Start typing…</div>}
        </div>
      )}
    </div>
  );
}

function CountyDropdown({ value, onChange }) {
  const [q, setQ] = useState_man(value || '');
  const [open, setOpen] = useState_man(false);
  const list = window.MOCK.INDIANA_COUNTIES.filter(([fips, name]) =>
    !q || name.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 12);
  return (
    <div className="relative">
      <window.UI.TextField label="County (Indiana)" placeholder="Type or select…" value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        leftIcon={<window.Icons.Map size={13}/>}/>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-surface-3 rounded-md shadow-pop z-10 max-h-[220px] overflow-y-auto nice-scroll">
          {list.map(([fips, name]) => (
            <button key={fips} onClick={() => { setQ(name); onChange(name, fips); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center gap-2 text-[13px]">
              <span className="font-mono text-[10.5px] text-text-400 w-12">{fips}</span>
              <span>{name} Co.</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.ManualScreen = ManualScreen;
