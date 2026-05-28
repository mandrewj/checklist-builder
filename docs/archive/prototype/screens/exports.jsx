/* global window, React */
// =========================================================================
// Exports — generate manuscript pack when locked, instructions if unlocked.
// =========================================================================
const { useState: useState_ex, useEffect: useEffect_ex } = React;

function ExportsScreen({ project, exportArtifacts, setExportArtifacts, setLockConfirmOpen }) {
  const { Card, Eyebrow, Badge, Button, H3, useToast } = window.UI;
  const { CountyChoropleth } = window.MAP;
  const { fmtDateTime, relTime } = window.UTIL;
  const toast = useToast();
  const [generating, setGenerating] = useState_ex(null); // {format, progress}

  const EXPORTS = [
    { format:'docx',   label:'Manuscript draft (DOCX)',         icon: window.Icons.Doc,      desc:'Methods + Results boilerplate, species accounts, county distribution maps inline, references. Edit-ready in Word or LibreOffice.', size:'~2.1 MB' },
    { format:'csv',    label:'Species checklist (CSV)',         icon: window.Icons.Table,    desc:'One row per species. Columns: scientificName, authority, family, sources, nRecords, nCounties, inclusion, inclusionReasoning.', size:'14 KB' },
    { format:'maps',   label:'Distribution maps · SVG + PNG (300 dpi) + PDF',icon: window.Icons.Map, desc:'One file per species + a small-multiples composite (4×3 grid) at 8.5×11 in. Same SVG source used in the on-screen view.', size:'~38 MB' },
    { format:'dwc',    label:'Darwin Core Archive (DwC-A)',     icon: window.Icons.Layers,   desc:'Standards-compliant zip for republishing to a GBIF-affiliated data publisher. Includes meta.xml, eml.xml, occurrence.txt.', size:'~4.8 MB' },
    { format:'json',   label:'Snapshot JSON',                   icon: window.Icons.Doc,      desc:'Full snapshot of taxa, records, county-presence, conflicts, comments, and decisions. Replayable.', size:'~9.2 MB' },
  ];

  const startGenerate = (fmt) => {
    setGenerating({ format: fmt, progress: 0 });
    const id = Math.random().toString(36).slice(2, 8);
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + 14);
      setGenerating({ format: fmt, progress: p });
      if (p >= 100) {
        clearInterval(timer);
        const art = {
          id: 'ea_' + id,
          format: fmt,
          generatedAt: new Date().toISOString(),
          generator: 'Maya Patel',
          snapshotId: 'ss_p1_240525',
          blobUrl: `vercel-blob://insectid/p1/${id}/${fmt}.${fmt === 'maps' ? 'zip' : fmt}`,
          size: EXPORTS.find(e => e.format === fmt).size,
        };
        setExportArtifacts(prev => [art, ...prev]);
        setGenerating(null);
        toast.push({ tone:'success', title:'Export ready', message: EXPORTS.find(e => e.format === fmt).label });
      }
    }, 350);
  };

  if (!project.locked) {
    return (
      <div className="max-w-[1100px] mx-auto px-8 py-7">
        <div className="mb-5">
          <Eyebrow className="mb-2">EXPORTS</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">Locked snapshots only</h1>
          <p className="text-[13.5px] text-text-500 mt-1 max-w-2xl">Exports are generated against an immutable snapshot so reviewers always know the data behind a paper. Lock the project to generate exports.</p>
        </div>
        <Card className="p-8 text-center" accent>
          <div className="h-14 w-14 mx-auto rounded-full bg-blue-50 inline-flex items-center justify-center text-blue-600 mb-3">
            <window.Icons.Lock size={26}/>
          </div>
          <h3 className="text-[18px] font-bold text-blue-800">Lock the project to generate exports</h3>
          <p className="text-[13px] text-text-500 max-w-xl mx-auto mt-2">
            Locking creates an immutable snapshot. All exports are generated against that snapshot, so anyone who downloads them sees the same data — including reviewers who come back months later.
            You can unlock at any time to make further edits.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button variant="primary" icon={<window.Icons.Lock size={13}/>} onClick={() => setLockConfirmOpen(true)}>Lock for export</Button>
          </div>
          <div className="mt-6 text-[12px] text-text-400 font-mono">
            export_artifacts.snapshot_id ← projects.locked_snapshot_id
          </div>
        </Card>

        <div className="mt-8">
          <H3>What you'll get</H3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {EXPORTS.map(e => (
              <div key={e.format} className="border border-surface-3 rounded-lg p-4 bg-white flex items-start gap-3">
                <span className="h-9 w-9 bg-surface-2 text-text-500 rounded-md inline-flex items-center justify-center flex-shrink-0"><e.icon size={16}/></span>
                <div>
                  <div className="text-[13.5px] font-bold text-blue-800">{e.label}</div>
                  <div className="text-[12px] text-text-500 leading-snug mt-1">{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // LOCKED state — exports panel
  return (
    <div className="max-w-[1200px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">EXPORTS · LOCKED SNAPSHOT</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">Generate your manuscript pack</h1>
          <p className="text-[13.5px] text-text-500 mt-1 max-w-2xl">
            Snapshot <span className="font-mono text-text-700">ss_p1_240525</span> captured 14 included species, 4,070 accepted records, presence in 89 counties.
          </p>
        </div>
        <div className="text-right">
          <Badge tone="dark" size="sm" icon={<window.Icons.Lock size={10}/>}>Locked for export</Badge>
          <div className="text-[11.5px] text-text-400 font-mono mt-1.5">snapshot ss_p1_240525 · 2026-05-25 12:00</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-7">
        {EXPORTS.map(e => (
          <Card key={e.format} className="p-4">
            <div className="flex items-start gap-3">
              <span className="h-10 w-10 bg-blue-50 text-blue-600 rounded-md inline-flex items-center justify-center flex-shrink-0"><e.icon size={18}/></span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-blue-800">{e.label}</div>
                <div className="text-[12px] text-text-500 leading-snug mt-1">{e.desc}</div>
                <div className="text-[11.5px] text-text-400 font-mono mt-2">est. {e.size}</div>
              </div>
              <div className="flex-shrink-0">
                {generating && generating.format === e.format ? (
                  <div className="w-[120px]">
                    <window.UI.ProgressBar value={generating.progress}/>
                    <div className="text-[11px] text-text-400 font-mono mt-1 text-right">{generating.progress}%</div>
                  </div>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => startGenerate(e.format)} disabled={!!generating}>Generate</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Past exports */}
      <H3>Past exports</H3>
      <Card className="p-0 mt-3 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-1 border-b border-surface-3 text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-bold">Artifact</th>
              <th className="px-3 py-2.5 font-bold">Format</th>
              <th className="px-3 py-2.5 font-bold">Snapshot</th>
              <th className="px-3 py-2.5 font-bold">Generated by</th>
              <th className="px-3 py-2.5 font-bold">Size</th>
              <th className="px-3 py-2.5 font-bold">When</th>
              <th className="px-4 py-2.5 font-bold text-right">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3">
            {exportArtifacts.length === 0 && (
              <tr><td colSpan={7} className="text-center text-text-400 py-6 text-[12.5px]">No exports yet. Generate one above.</td></tr>
            )}
            {exportArtifacts.map(a => (
              <tr key={a.id} className="hover:bg-surface-1">
                <td className="px-4 py-3 font-mono text-[12px] text-text-500">{a.id}</td>
                <td className="px-3 py-3"><Badge tone="blue" size="sm">{a.format.toUpperCase()}</Badge></td>
                <td className="px-3 py-3 font-mono text-[11.5px] text-text-400">{a.snapshotId}</td>
                <td className="px-3 py-3 text-text-700">{a.generator}</td>
                <td className="px-3 py-3 font-mono text-text-500">{a.size}</td>
                <td className="px-3 py-3 text-text-400 text-[12px] font-mono">{relTime(a.generatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="secondary" size="sm" icon={<window.Icons.Download size={12}/>}>Download</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Map preview */}
      <H3 className="mt-7">Manuscript map preview</H3>
      <Card className="p-5 mt-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[12.5px] text-text-500"><span className="font-bold text-text-700 italic">Alobates pennsylvanicus</span> · Indiana · all sources · viridis(record-count)</div>
            <div className="text-[11.5px] text-text-400 font-mono mt-0.5">8.5 × 11 in · 300 dpi · same SVG used in DOCX export</div>
          </div>
          <Button variant="secondary" size="sm" icon={<window.Icons.Download size={12}/>}>Download this map</Button>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded p-4 flex justify-center">
          <CountyChoropleth countyPresence={window.MOCK.TAXA[0].countyPresence} size="print" ariaLabel="Alobates pennsylvanicus distribution"/>
        </div>
      </Card>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.ExportsScreen = ExportsScreen;
