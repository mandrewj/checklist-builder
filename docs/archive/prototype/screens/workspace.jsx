/* global window, React */
// =========================================================================
// Workspace shell: sidebar + top bar + nested screen renderer.
// =========================================================================
const { useState: useState_ws, useEffect: useEffect_ws } = React;

function WorkspaceScreen(props) {
  const {
    project, projects, members, taxa, conflicts, manual, activity, currentUser,
    nav, setNav, onLockToggle, onBackToDashboard, onMutate, comments, recordsByTaxon, setExportArtifacts, exportArtifacts,
  } = props;
  const { Avatar, AvatarStack, Button, Badge, useToast } = window.UI;

  const NAV = [
    { key:'overview',  label:'Overview',     icon: window.Icons.Home,    badge: null },
    { key:'checklist', label:'Checklist',    icon: window.Icons.List,    badge: taxa.length },
    { key:'records',   label:'Records',      icon: window.Icons.Table,   badge: window.MOCK.TOPLINE.p1.nFlagged },
    { key:'conflicts', label:'Conflicts',    icon: window.Icons.Conflict,badge: conflicts.filter(c => !c.resolution).length, tone:'warning' },
    { key:'manual',    label:'Manual entries',icon: window.Icons.Pencil, badge: manual.length },
    { key:'activity',  label:'Activity',     icon: window.Icons.Activity,badge: null },
    { key:'members',   label:'Members',      icon: window.Icons.Users,   badge: members.length },
    { key:'exports',   label:'Exports',      icon: window.Icons.Download,badge: null },
    { key:'settings',  label:'Settings',     icon: window.Icons.Settings,badge: null },
  ];

  const [collapsed, setCollapsed] = useState_ws(false);
  const [selectedTaxonId, setSelectedTaxonId] = useState_ws(null);
  const [recordsFilter, setRecordsFilter] = useState_ws(null); // {flagged:true} etc
  const [lockConfirmOpen, setLockConfirmOpen] = useState_ws(false);
  const [helpOpen, setHelpOpen] = useState_ws(false);

  // Listen for global keyboard shortcuts (? opens keyboard help overlay)
  useEffect_ws(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === '?') { e.preventDefault(); setHelpOpen(h => !h); }
      if (e.key === 'Escape') { setHelpOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const screenProps = {
    project, taxa, conflicts, manual, activity, members, currentUser,
    comments, recordsByTaxon, onMutate,
    onOpenSpecies: (taxonId) => { setSelectedTaxonId(taxonId); setNav('species'); },
    onOpenConflicts: () => setNav('conflicts'),
    setNav, exportArtifacts, setExportArtifacts,
    recordsFilter, setRecordsFilter,
    onLockToggle, setLockConfirmOpen,
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-surface-3 flex flex-col flex-shrink-0 transition-all duration-200
        ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}>
        <button onClick={onBackToDashboard}
          className="flex items-center gap-2.5 px-4 h-14 border-b border-surface-3 hover:bg-surface-1 w-full">
          <window.Icons.Logo size={22}/>
          {!collapsed && <span className="font-black text-blue-800 text-[14.5px] tracking-tight">InsectID</span>}
          {!collapsed && <span className="text-text-300 text-[11px] ml-auto">v0.4</span>}
        </button>
        <div className={`px-3 py-4 border-b border-surface-3 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && (
            <>
              <div className="text-[10.5px] text-text-400 uppercase font-bold tracking-[0.12em]">Active project</div>
              <div className="text-[13.5px] font-bold text-blue-800 leading-tight mt-1 line-clamp-2">{project.name}</div>
              <div className="text-[11.5px] text-text-500 font-mono mt-1.5">{project.taxonQuery}</div>
              <div className="flex items-center gap-1.5 mt-2.5">
                {project.locked
                  ? <Badge tone="dark" size="sm" icon={<window.Icons.Lock size={10}/>}>Locked</Badge>
                  : <Badge tone="outline" size="sm">In progress</Badge>}
                <Badge tone={project.role === 'Lead' ? 'blue' : project.role === 'Contributor' ? 'cyan' : 'neutral'} size="sm">{project.role || 'Lead'}</Badge>
              </div>
            </>
          )}
          {collapsed && <Badge tone="blue" size="sm">L</Badge>}
        </div>
        <nav className="flex-1 py-2 overflow-y-auto nice-scroll">
          {NAV.map(item => {
            const isActive = nav === item.key || (nav === 'species' && item.key === 'checklist');
            return (
              <button key={item.key} onClick={() => { setNav(item.key); setSelectedTaxonId(null); }}
                className={`w-full flex items-center gap-2.5 px-4 h-9 text-[13.5px] transition-colors
                  ${isActive ? 'bg-blue-50 text-blue-800 font-bold border-r-2 border-blue-600' : 'text-text-500 hover:bg-surface-1 hover:text-text-700'}`}
                title={item.label}>
                <item.icon size={16}/>
                {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                {!collapsed && item.badge != null && item.badge > 0 && (
                  <span className={`text-[10.5px] font-mono px-1.5 rounded ${
                    item.tone === 'warning' ? 'bg-warning-50 text-warning-700' :
                    isActive ? 'bg-blue-100 text-blue-800' : 'bg-surface-2 text-text-500'
                  }`}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-surface-3 p-3">
          <button onClick={() => setCollapsed(c => !c)}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 text-[12px] text-text-500 hover:text-text-700 hover:bg-surface-1 rounded">
            {collapsed ? <window.Icons.ChevronRight size={13}/> : <><window.Icons.ChevronLeft size={13}/><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-surface-3 flex items-center px-6 gap-4 flex-shrink-0">
          <button onClick={onBackToDashboard} className="text-text-500 hover:text-text-700 text-[12.5px] inline-flex items-center gap-1">
            <window.Icons.ChevronLeft size={13}/> Projects
          </button>
          <span className="text-text-300">/</span>
          <div className="font-bold text-blue-800 text-[14.5px] truncate">{project.name}</div>
          {project.locked && (
            <Badge tone="dark" size="sm" icon={<window.Icons.Lock size={10}/>}>
              Locked for export · snapshot ss_{project.id}_240525
            </Badge>
          )}
          <div className="flex-1"/>
          <button title="Keyboard shortcuts (?)" onClick={() => setHelpOpen(true)} className="text-text-500 hover:text-text-700 text-[12px] font-mono">
            <kbd>?</kbd>
          </button>
          <AvatarStack list={members.map(m => ({ initials: m.initials, name: m.name }))} size={24}/>
          {!project.locked
            ? <Button variant="primary" icon={<window.Icons.Lock size={13}/>} onClick={() => setLockConfirmOpen(true)}>Lock for export</Button>
            : <Button variant="secondary" icon={<window.Icons.Unlock size={13}/>} onClick={onLockToggle}>Unlock</Button>}
        </header>

        {/* Body */}
        <main className="flex-1 min-h-0 overflow-y-auto nice-scroll bg-page">
          {nav === 'overview'  && <window.SCREENS.OverviewScreen  {...screenProps}/>}
          {nav === 'checklist' && <window.SCREENS.ChecklistScreen {...screenProps}/>}
          {nav === 'records'   && <window.SCREENS.ChecklistScreen {...screenProps} mode="records"/>}
          {nav === 'species'   && <window.SCREENS.SpeciesScreen   {...screenProps} taxonId={selectedTaxonId} onBack={() => setNav('checklist')}/>}
          {nav === 'conflicts' && <window.SCREENS.ConflictsScreen {...screenProps}/>}
          {nav === 'manual'    && <window.SCREENS.ManualScreen    {...screenProps}/>}
          {nav === 'activity'  && <window.SCREENS.ActivityScreen  {...screenProps}/>}
          {nav === 'members'   && <window.SCREENS.MembersScreen   {...screenProps}/>}
          {nav === 'exports'   && <window.SCREENS.ExportsScreen   {...screenProps}/>}
          {nav === 'settings'  && <window.SCREENS.SettingsScreen  {...screenProps}/>}
        </main>
      </div>

      {/* Lock confirmation */}
      {lockConfirmOpen && (
        <window.UI.Modal open={true} onClose={() => setLockConfirmOpen(false)}
          title={project.locked ? 'Unlock project?' : 'Lock project for export?'}
          width={560}
          footer={
            <>
              <Button variant="ghost" onClick={() => setLockConfirmOpen(false)}>Cancel</Button>
              <Button variant="primary"
                icon={project.locked ? <window.Icons.Unlock size={13}/> : <window.Icons.Lock size={13}/>}
                onClick={() => { onLockToggle(); setLockConfirmOpen(false); }}>
                {project.locked ? 'Unlock' : 'Lock for export'}
              </Button>
            </>
          }>
          {project.locked ? (
            <>
              <p>Unlocking the project allows further edits and invalidates pending exports for snapshot <span className="font-mono">ss_{project.id}_240525</span>.</p>
              <p className="text-text-500 mt-2">Already-downloaded files remain valid; new exports must wait until the project is re-locked.</p>
            </>
          ) : (
            <>
              <p>Locking creates an immutable snapshot. Exports run against this snapshot. You can unlock at any time.</p>
              <div className="mt-4 grid grid-cols-3 gap-3 bg-surface-1 border border-surface-3 rounded-md p-4">
                <SnapshotStat label="Species" value={window.MOCK.TOPLINE.p1.nIncluded} sub={`of ${taxa.length} ⨯ included`}/>
                <SnapshotStat label="Records" value={window.UTIL.fmtN(window.MOCK.TOPLINE.p1.nAccepted)} sub={`of ${window.UTIL.fmtN(window.MOCK.TOPLINE.p1.nRecords)} accepted`}/>
                <SnapshotStat label="Counties" value={window.MOCK.TOPLINE.p1.nCountiesWithPresence} sub="with presence"/>
              </div>
              <div className="mt-3 text-[12.5px] text-warning-700 bg-warning-50 border border-[#FCE2B0] rounded px-3 py-2 flex items-start gap-2">
                <window.Icons.Conflict size={12} className="mt-0.5"/>
                <span>{conflicts.filter(c => !c.resolution).length} taxonomic conflicts are still unresolved. They will be locked in their current state.</span>
              </div>
            </>
          )}
        </window.UI.Modal>
      )}

      {/* Keyboard shortcut help overlay */}
      {helpOpen && <KeyboardHelp onClose={() => setHelpOpen(false)}/>}
    </div>
  );
}

function SnapshotStat({ label, value, sub }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-text-400 mb-1">{label}</div>
      <div className="font-black text-blue-800 text-[22px] leading-none tabular-nums">{value}</div>
      <div className="text-[11.5px] text-text-500 mt-1">{sub}</div>
    </div>
  );
}

function KeyboardHelp({ onClose }) {
  const groups = [
    { name:'Triage', items:[
      ['J', 'Next record'], ['K','Previous record'], ['A','Accept'], ['R','Reject'], ['F','Flag for review'], ['C','Add comment'],
    ]},
    { name:'Navigation', items:[
      ['G then C','Go to Checklist'], ['G then R','Go to Records'], ['G then X','Go to Conflicts'], ['Cmd+K','Quick search'], ['Esc','Close drawer/modal'],
    ]},
    { name:'Selection', items:[
      ['Shift+click','Range-select rows'], ['Cmd+A','Select page'], ['I','Mark included (selection)'], ['E','Mark excluded (selection)'],
    ]},
    { name:'Help', items:[
      ['?','Toggle this overlay'],
    ]},
  ];
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-text-700/55" onClick={onClose}/>
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="bg-white border border-surface-3 rounded-lg shadow-pop w-full max-w-[640px] fade-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
            <div>
              <div className="eyebrow text-text-400">KEYBOARD</div>
              <h3 className="text-[18px] font-black text-blue-800 leading-tight mt-1">Shortcuts</h3>
            </div>
            <button onClick={onClose} className="text-text-400 hover:text-text-700"><window.Icons.X size={18}/></button>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-5 py-5">
            {groups.map(g => (
              <div key={g.name}>
                <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-text-500 mb-2.5">{g.name}</div>
                <div className="space-y-2">
                  {g.items.map(([k, label]) => (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-text-600">{label}</span>
                      <span className="flex items-center gap-1">
                        {k.split(/\s+/).map((seg, i) => seg.toLowerCase()==='then'
                          ? <span key={i} className="text-[11px] text-text-300">then</span>
                          : <kbd key={i}>{seg}</kbd>)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-surface-3 px-5 py-3 bg-surface-1 flex items-center justify-between text-[12px] text-text-500">
            Press <kbd>?</kbd> to toggle.
            <window.UI.Button variant="secondary" size="sm" onClick={onClose}>Close</window.UI.Button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.WorkspaceScreen = WorkspaceScreen;
