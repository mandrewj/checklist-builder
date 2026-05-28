/* global window, React */
// =========================================================================
// Settings — project name, description, region, filters, delete.
// =========================================================================
const { useState: useState_set } = React;

function SettingsScreen({ project }) {
  const { Card, Eyebrow, Badge, Button, H3, TextField, TextArea, Checkbox, Modal, useToast } = window.UI;
  const toast = useToast();
  const [name, setName] = useState_set(project.name);
  const [desc, setDesc] = useState_set(project.description);
  const [confirmReingest, setConfirmReingest] = useState_set(false);
  const [confirmDelete, setConfirmDelete] = useState_set(false);

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-7">
      <div className="mb-5">
        <Eyebrow className="mb-2">PROJECT SETTINGS</Eyebrow>
        <h1 className="text-[26px] font-black text-blue-800 leading-tight">Configure {project.name}</h1>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <H3>General</H3>
          <div className="space-y-4 mt-3 max-w-2xl">
            <TextField label="Project name" value={name} onChange={(e) => setName(e.target.value)}/>
            <TextArea label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}/>
            <div className="flex items-center justify-end">
              <Button variant="primary" onClick={() => toast.push({tone:'success', title:'Settings saved'})}>Save changes</Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <H3>Region</H3>
          <div className="mt-3 flex items-center gap-3">
            <Badge tone="blue" size="md">{project.region}</Badge>
            <span className="text-[12.5px] text-text-500">{project.regionCodes.join(' · ')}</span>
            <Button variant="secondary" size="sm">Change region…</Button>
          </div>
          <div className="text-[12px] text-text-500 mt-3">Changing the region is destructive — records outside the new region will be excluded from county-presence aggregation. You'll see a diff before applying.</div>
        </Card>

        <Card className="p-5">
          <H3>Ingest filters</H3>
          <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-3 max-w-3xl">
            <FilterRow label="iNat quality" value="Research-grade only"/>
            <FilterRow label="Date range" value="2018-01-01 → 2024-12-31"/>
            <FilterRow label="Basis of record" value="Human observation, Preserved specimen"/>
            <FilterRow label="Coordinates" value="Required"/>
            <FilterRow label="Cultivated / captive" value="Excluded"/>
          </div>
          <div className="mt-4 p-3 bg-warning-50 border border-[#FCE2B0] rounded text-[12.5px] text-warning-700 flex items-start gap-2 max-w-3xl">
            <window.Icons.Conflict size={12} className="mt-0.5"/>
            <span>Re-running ingest with new filters is destructive. The system surfaces a confirmation dialog with a record-level diff preview before applying.</span>
          </div>
          <div className="mt-3">
            <Button variant="secondary" icon={<window.Icons.Sparkles size={13}/>} onClick={() => setConfirmReingest(true)}>Re-run ingest with new filters…</Button>
          </div>
        </Card>

        <Card className="p-5">
          <H3>Topojson · static assets</H3>
          <div className="grid grid-cols-2 gap-4 mt-3 text-[13px]">
            <div className="border border-surface-3 rounded p-3 bg-surface-1">
              <div className="text-[11.5px] uppercase tracking-[0.1em] font-bold text-text-500 mb-1">US counties</div>
              <div className="text-text-700">Census TIGER · 2024 · simplified to 0.5°</div>
              <div className="text-[11.5px] text-text-400 font-mono mt-1">/public/topojson/us-counties.json · 480 KB</div>
            </div>
            <div className="border border-surface-3 rounded p-3 bg-surface-1">
              <div className="text-[11.5px] uppercase tracking-[0.1em] font-bold text-text-500 mb-1">Canada census divisions</div>
              <div className="text-text-700">StatsCan · 2021</div>
              <div className="text-[11.5px] text-text-400 font-mono mt-1">/public/topojson/ca-cdivs.json · 218 KB</div>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-danger-600/30">
          <H3 className="!text-danger-700">Danger zone</H3>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="flex items-start justify-between gap-3 p-3 border border-surface-3 rounded">
              <div>
                <div className="font-bold text-text-700 text-[13.5px]">Transfer ownership</div>
                <div className="text-[12px] text-text-500">Make another Lead the project owner.</div>
              </div>
              <Button variant="secondary" size="sm">Transfer…</Button>
            </div>
            <div className="flex items-start justify-between gap-3 p-3 border border-surface-3 rounded">
              <div>
                <div className="font-bold text-danger-600 text-[13.5px]">Delete project</div>
                <div className="text-[12px] text-text-500">Erases all records, decisions, and exports. Irreversible.</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete…</Button>
            </div>
          </div>
        </Card>
      </div>

      {confirmReingest && (
        <Modal open onClose={() => setConfirmReingest(false)} title="Re-run ingest?" width={560}
          footer={<><Button variant="ghost" onClick={() => setConfirmReingest(false)}>Cancel</Button><Button variant="primary" onClick={() => { setConfirmReingest(false); toast.push({tone:'info', title:'Ingest queued', message:'Diff preview will appear when ready.'}); }}>Re-run</Button></>}>
          <p>Re-ingesting will replace existing records with the new filter set. Manual entries are preserved.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
            <div className="bg-surface-1 p-2.5 rounded border border-surface-3"><div className="text-text-400 text-[10.5px] uppercase tracking-wide font-bold">Records dropped</div><div className="font-mono text-danger-600">−312</div></div>
            <div className="bg-surface-1 p-2.5 rounded border border-surface-3"><div className="text-text-400 text-[10.5px] uppercase tracking-wide font-bold">Records added</div><div className="font-mono text-success-600">+84</div></div>
            <div className="bg-surface-1 p-2.5 rounded border border-surface-3"><div className="text-text-400 text-[10.5px] uppercase tracking-wide font-bold">Species affected</div><div className="font-mono text-text-700">9</div></div>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} title="Delete this project?" width={520}
          footer={<><Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="danger" onClick={() => setConfirmDelete(false)}>Delete project</Button></>}>
          <p>This permanently deletes <span className="font-bold italic">{project.name}</span>, all records, decisions, comments, and export artifacts.</p>
          <p className="mt-2">Type <code className="font-mono bg-surface-2 px-1.5 py-0.5 rounded">{project.name}</code> to confirm.</p>
          <TextField className="mt-3" placeholder={project.name}/>
        </Modal>
      )}
    </div>
  );
}

function FilterRow({ label, value }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.1em] font-bold text-text-400 mb-0.5">{label}</div>
      <div className="text-[13.5px] text-text-700">{value}</div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.SettingsScreen = SettingsScreen;
