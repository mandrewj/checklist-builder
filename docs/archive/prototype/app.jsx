/* global window, React, ReactDOM */
// =========================================================================
// App entry — top-level routing + state container.
// =========================================================================

const { useState, useEffect, useCallback, useMemo } = React;

function App() {
  // Auth state: 'signin' | 'app'
  const [route, setRoute] = useState('signin');  // 'signin' | 'dashboard' | 'wizard' | 'workspace'
  const [activeProjectId, setActiveProjectId] = useState('p1');
  const [nav, setNav] = useState('checklist'); // inside workspace

  // Mutable copies of seed data
  const [taxa, setTaxa] = useState(window.MOCK.TAXA);
  const [conflicts, setConflicts] = useState(window.MOCK.CONFLICTS);
  const [manual, setManual] = useState(window.MOCK.MANUAL_ENTRIES);
  const [activity, setActivity] = useState(window.MOCK.ACTIVITY);
  const [comments, setComments] = useState(window.MOCK.COMMENTS);
  const [recordsByTaxon, setRecordsByTaxon] = useState(window.MOCK.RECORDS_BY_TAXON);
  const [projects, setProjects] = useState(window.MOCK.PROJECTS);
  const [exportArtifacts, setExportArtifacts] = useState([]);
  const [undoStack, setUndoStack] = useState([]); // for naive undo

  const currentUser = { id:'u1', initials:'MP', name:'Maya Patel', firstName:'Maya' };

  // ---- Mutations -------------------------------------------------------
  const onMutate = useCallback((action) => {
    setUndoStack(stack => [...stack, { taxa, conflicts, manual, activity, comments, recordsByTaxon, projects }]);
    switch (action.type) {
      case 'setInclusion': {
        setTaxa(prev => prev.map(t => action.ids.includes(t.id) ? { ...t, inclusion: action.value, inclusionReasoning: action.reasoning != null ? action.reasoning : t.inclusionReasoning, lastTouchedAt: new Date().toISOString(), lastCommenter: currentUser.initials } : t));
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action: action.value === 'include' ? 'include' : action.value === 'exclude' ? 'exclude' : 'comment', target: action.ids.map(id => taxa.find(t => t.id === id)?.scientificName).filter(Boolean).join(', '), ts: new Date().toISOString(), detail: action.value === 'undecided' ? 'Marked as UNDECIDED' : (action.value === 'include' ? 'Marked species as INCLUDED' : 'Marked species as EXCLUDED') }, ...prev]);
        break;
      }
      case 'setRecordStatus': {
        setRecordsByTaxon(prev => ({
          ...prev,
          [action.taxonId]: prev[action.taxonId].map(r => r.id === action.recordId ? { ...r, status: action.status } : r)
        }));
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action: action.status === 'rejected' ? 'reject' : action.status === 'flagged' ? 'flag' : 'comment', target: action.recordId, ts: new Date().toISOString(), detail: `Record marked ${action.status}` }, ...prev]);
        break;
      }
      case 'bulkRecordStatus': {
        setRecordsByTaxon(prev => ({
          ...prev,
          [action.taxonId]: prev[action.taxonId].map(r => action.recordIds.includes(r.id) ? { ...r, status: action.status } : r)
        }));
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action:'reject', target: `${taxa.find(t => t.id === action.taxonId)?.scientificName} · ${action.recordIds.length} records`, ts: new Date().toISOString(), detail: action.note || 'Bulk action' }, ...prev]);
        break;
      }
      case 'addComment': {
        const c = { id:'cm'+Math.random().toString(36).slice(2,7), author: currentUser.initials, ts: new Date().toISOString(), text: action.text, recordId: action.recordId };
        setComments(prev => ({ ...prev, [action.taxonId]: [...(prev[action.taxonId] || []), c] }));
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action:'comment', target: taxa.find(t => t.id === action.taxonId)?.scientificName || action.taxonId, ts: new Date().toISOString(), detail: '"' + action.text + '"' }, ...prev]);
        break;
      }
      case 'resolveConflict': {
        setConflicts(prev => prev.map(c => c.id === action.conflictId ? { ...c, resolution: action.resolution, custom: action.custom, resolvedBy: currentUser.initials, resolvedAt: new Date().toISOString() } : c));
        // If GBIF wins for conflict c1, remove iNat subspecies count (no real change to taxa for prototype),
        // but for flow C we simulate "species count drops by 1" by hiding hasConflict on t1
        const conflict = conflicts.find(c => c.id === action.conflictId);
        if (conflict && action.resolution === 'gbif') {
          setTaxa(prev => prev.map(t => t.id === conflict.taxonId ? { ...t, hasConflict: false } : t));
        }
        if (conflict && action.resolution === 'inat') {
          setTaxa(prev => prev.map(t => t.id === conflict.taxonId ? { ...t, hasConflict: false, scientificName: conflict.inatName } : t));
        }
        if (conflict && action.resolution === 'merged') {
          setTaxa(prev => prev.map(t => t.id === conflict.taxonId ? { ...t, hasConflict: false, scientificName: action.custom || conflict.gbifName } : t));
        }
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action:'conflict_resolve', target: conflict ? `${conflict.gbifName} ↔ ${conflict.inatName}` : action.conflictId, ts: new Date().toISOString(), detail: 'Resolution: ' + action.resolution + (action.custom ? ` ("${action.custom}")` : '') }, ...prev]);
        break;
      }
      case 'addManual': {
        const m = {
          id:'m'+Math.random().toString(36).slice(2,7),
          taxonId: action.entry.taxonId || ('t'+Math.random().toString(36).slice(2,5)),
          taxonName: action.entry.taxonName,
          county: action.entry.county,
          countyFips: action.entry.countyFips,
          citation: action.entry.citation,
          doi: action.entry.doi,
          notes: action.entry.notes,
          addedBy: currentUser.name,
          addedAt: new Date().toISOString(),
        };
        setManual(prev => [m, ...prev]);
        // If new taxon, append to taxa list
        if (action.entry.addNewTaxon) {
          setTaxa(prev => [...prev, {
            id: m.taxonId, scientificName: action.entry.taxonName, authority:'—', family:'Tenebrionidae',
            rank:'species', inclusion:'undecided', nRecords: 1, nCounties: 1, hasConflict: false,
            sources:['manual'], countyPresence: { [m.countyFips]: 1 },
            inclusionReasoning:'', lastCommenter: currentUser.initials, lastTouchedAt: new Date().toISOString(),
          }]);
        }
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action:'add_manual', target: `${m.taxonName} · ${m.county} Co.`, ts: new Date().toISOString(), detail: m.citation }, ...prev]);
        break;
      }
      case 'lock': {
        setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, locked: true, lockedAt: new Date().toISOString(), lockedSnapshotId: `ss_${p.id}_240525` } : p));
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action:'lock', target:'Project', ts: new Date().toISOString(), detail:'Snapshot ss_p1_240525 created. Exports may now be generated.' }, ...prev]);
        break;
      }
      case 'unlock': {
        setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, locked: false } : p));
        setActivity(prev => [{ id:'a'+Math.random().toString(36).slice(2,7), actor: currentUser.initials, action:'unlock', target:'Project', ts: new Date().toISOString(), detail:'Project re-opened for editing. Pending exports invalidated.' }, ...prev]);
        break;
      }
      case 'undoLast': {
        setUndoStack(stack => {
          if (stack.length === 0) return stack;
          const last = stack[stack.length - 1];
          setTaxa(last.taxa); setConflicts(last.conflicts); setManual(last.manual);
          setActivity(last.activity); setComments(last.comments);
          setRecordsByTaxon(last.recordsByTaxon); setProjects(last.projects);
          return stack.slice(0, -1);
        });
        break;
      }
      default: break;
    }
  }, [taxa, conflicts, manual, activity, comments, recordsByTaxon, projects, activeProjectId]);

  const onLockToggle = () => {
    const proj = projects.find(p => p.id === activeProjectId);
    if (proj.locked) onMutate({ type:'unlock' });
    else { onMutate({ type:'lock' }); setNav('exports'); }
  };

  const project = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
  const members = window.MOCK.MEMBERS;

  // Render
  const { ToastProvider } = window.UI;

  let body;
  if (route === 'signin') {
    body = <window.SCREENS.SignInScreen onSignIn={() => setRoute('dashboard')}/>;
  } else if (route === 'dashboard') {
    body = <window.SCREENS.DashboardScreen
      projects={projects}
      currentUser={currentUser}
      onOpenProject={(id) => { setActiveProjectId(id); setNav('overview'); setRoute('workspace'); }}
      onNewProject={() => setRoute('wizard')}
      onSignOut={() => setRoute('signin')}/>;
  } else if (route === 'wizard') {
    body = <window.SCREENS.WizardScreen
      onCancel={() => setRoute('dashboard')}
      onComplete={() => { setActiveProjectId('p1'); setNav('checklist'); setRoute('workspace'); }}/>;
  } else if (route === 'workspace') {
    body = <window.SCREENS.WorkspaceScreen
      project={project}
      projects={projects}
      members={members}
      taxa={taxa}
      conflicts={conflicts}
      manual={manual}
      activity={activity}
      comments={comments}
      recordsByTaxon={recordsByTaxon}
      currentUser={currentUser}
      nav={nav}
      setNav={setNav}
      onLockToggle={onLockToggle}
      onBackToDashboard={() => setRoute('dashboard')}
      onMutate={onMutate}
      exportArtifacts={exportArtifacts}
      setExportArtifacts={setExportArtifacts}/>;
  }

  return <ToastProvider>{body}</ToastProvider>;
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
