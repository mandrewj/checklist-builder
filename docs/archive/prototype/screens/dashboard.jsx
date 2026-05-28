/* global window, React */
// =========================================================================
// Project list dashboard. Cards for each project the user belongs to.
// =========================================================================
const { useState: useState_dash } = React;

function DashboardScreen({ projects, onOpenProject, onNewProject, onSignOut, currentUser }) {
  const { Button, Card, Badge, Eyebrow, FilterChip, AvatarStack, H2, Segmented } = window.UI;
  const { MiniChoropleth } = window.MAP;
  const { fmtN, relTime, classNames } = window.UTIL;
  const [filter, setFilter] = useState_dash('all');
  const [layout, setLayout] = useState_dash('grid');
  const [query, setQuery] = useState_dash('');

  const filtered = projects.filter(p => {
    if (filter === 'lead' && p.role !== 'Lead') return false;
    if (filter === 'locked' && !p.locked) return false;
    if (filter === 'unlocked' && p.locked) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="bg-white border-b border-surface-3">
        <div className="max-w-[1320px] mx-auto px-8 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <window.Icons.Logo size={22}/>
            <span className="font-black text-blue-800 text-[15px] tracking-tight">InsectID Checklist</span>
          </div>
          <div className="flex-1"/>
          <div className="text-[12px] text-text-500 whitespace-nowrap">Signed in as <span className="text-text-700 font-semibold">{currentUser.name}</span></div>
          <window.UI.Avatar initials={currentUser.initials} size={28} title={currentUser.name}/>
          <button onClick={onSignOut} className="text-[12px] text-text-500 hover:text-text-700 whitespace-nowrap">Sign out</button>
        </div>
      </header>

      <main className="max-w-[1320px] mx-auto px-8 py-10">
        <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
          <div>
            <Eyebrow className="mb-2">YOUR PROJECTS</Eyebrow>
            <h1 className="text-[34px] font-black text-blue-800 leading-tight" style={{letterSpacing:'-0.012em'}}>
              Welcome back, {currentUser.firstName}.
            </h1>
            <p className="text-text-500 text-[14px] mt-1.5">
              You belong to <span className="text-text-700 font-semibold">{projects.length} projects</span>.
              <span className="mx-2 text-text-300">·</span>
              <span className="text-text-700 font-semibold">{projects.filter(p => p.nConflicts > 0).length} have unresolved conflicts</span>.
            </p>
          </div>
          <Button variant="primary" size="lg" icon={<window.Icons.Plus size={15}/>} onClick={onNewProject}>
            New project
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="flex items-center gap-1.5">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={projects.length}>All</FilterChip>
            <FilterChip active={filter === 'lead'} onClick={() => setFilter('lead')} count={projects.filter(p => p.role === 'Lead').length}>I lead</FilterChip>
            <FilterChip active={filter === 'unlocked'} onClick={() => setFilter('unlocked')} count={projects.filter(p => !p.locked).length}>In progress</FilterChip>
            <FilterChip active={filter === 'locked'} onClick={() => setFilter('locked')} count={projects.filter(p => p.locked).length}>Locked</FilterChip>
          </div>
          <div className="flex-1"/>
          <div className="relative">
            <window.Icons.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-300"/>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects"
              className="h-8 pl-8 pr-3 bg-white border border-surface-3 rounded-md text-[13px] outline-none focus:border-blue-600 w-[220px]"/>
          </div>
          <Segmented value={layout} onChange={setLayout} options={[
            { value:'grid', label:'Grid'},{ value:'list', label:'List'}
          ]}/>
        </div>

        {/* Grid or list */}
        {layout === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => onOpenProject(p.id)} />
            ))}
            <button onClick={onNewProject}
              className="border border-dashed border-surface-3 rounded-lg text-text-400 hover:border-blue-300 hover:text-blue-600 transition-colors p-6 flex flex-col items-center justify-center gap-2 min-h-[260px]">
              <window.Icons.Plus size={22}/>
              <span className="text-[14px] font-bold">Start a new project</span>
              <span className="text-[12px] text-text-400">Begins the taxon + region wizard.</span>
            </button>
          </div>
        ) : (
          <ProjectList projects={filtered} onOpen={onOpenProject} />
        )}

        {/* Footer */}
        <div className="mt-16 text-[11.5px] text-text-400 flex items-center gap-4 font-mono">
          <span>GBIF backbone synced 2026-05-18 · 2.7B occurrences indexed</span>
          <span className="text-text-300">·</span>
          <span>iNat API v1 reachable</span>
          <span className="text-text-300">·</span>
          <span>Neon · us-east-1 · scaled-to-zero</span>
        </div>
      </main>
    </div>
  );
}

function ProjectCard({ project, onClick }) {
  const { Card, Badge, AvatarStack } = window.UI;
  const { MiniChoropleth } = window.MAP;
  const { fmtN, relTime } = window.UTIL;
  const p = project;
  // Build a synthetic per-county heatmap from member taxa for the mini choropleth.
  // We'll use the first project's headline species presence for visual interest.
  const sample = window.MOCK.TAXA[0].countyPresence;
  return (
    <button onClick={onClick}
      className="text-left bg-white border border-surface-3 rounded-lg shadow-card hover:shadow-pop hover:border-blue-300 transition-all duration-150 overflow-hidden group">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <Badge tone={p.role === 'Lead' ? 'blue' : p.role === 'Contributor' ? 'cyan' : 'neutral'} size="sm">
            {p.role}
          </Badge>
          {p.locked
            ? <Badge tone="dark" size="sm" icon={<window.Icons.Lock size={10}/>}>Locked</Badge>
            : <Badge tone="outline" size="sm">In progress</Badge>}
        </div>
        <h3 className="text-[15.5px] font-bold text-blue-800 leading-tight group-hover:text-blue-900" style={{letterSpacing:'-0.005em'}}>
          {p.name}
        </h3>
        <div className="mt-1 text-[12px] text-text-500 font-mono">
          <span>{p.taxonQuery}</span>
          <span className="mx-1.5 text-text-300">·</span>
          <span>{p.region}</span>
        </div>
        <p className="text-[12.5px] text-text-500 leading-relaxed mt-2.5 line-clamp-2">{p.description}</p>
      </div>

      <div className="border-t border-surface-3 bg-surface-1 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-[12px]">
          <Stat label="species" value={p.nSpecies}/>
          <Stat label="records" value={fmtN(p.nRecords)}/>
          <Stat label="counties" value={p.nCounties}/>
          {p.nConflicts > 0 && (
            <span className="inline-flex items-center gap-1 text-warning-700 font-semibold" title={`${p.nConflicts} unresolved conflicts`}>
              <window.Icons.Conflict size={12}/> {p.nConflicts}
            </span>
          )}
        </div>
        <div className="opacity-70 group-hover:opacity-100 transition-opacity">
          <MiniChoropleth countyPresence={sample}/>
        </div>
      </div>
      <div className="px-5 py-2 border-t border-surface-3 flex items-center justify-between">
        <AvatarStack list={window.MOCK.MEMBERS.slice(0, 4).map(m => ({ initials: m.initials, name: m.name }))} size={20}/>
        <span className="text-[11.5px] text-text-400 font-mono">{relTime(p.lastActivity)}</span>
      </div>
    </button>
  );
}

function Stat({ label, value }) {
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="font-black text-text-700 tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.1em] text-text-400 font-bold">{label}</span>
    </span>
  );
}

function ProjectList({ projects, onOpen }) {
  const { Badge, AvatarStack } = window.UI;
  const { fmtN, relTime } = window.UTIL;
  return (
    <div className="bg-white border border-surface-3 rounded-lg shadow-card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-surface-3 bg-surface-1 text-left text-[11.5px] uppercase tracking-[0.08em] text-gray-500">
            <th className="px-4 py-2.5 font-bold">Project</th>
            <th className="px-3 py-2.5 font-bold">Role</th>
            <th className="px-3 py-2.5 font-bold">Region</th>
            <th className="px-3 py-2.5 font-bold text-right">Species</th>
            <th className="px-3 py-2.5 font-bold text-right">Records</th>
            <th className="px-3 py-2.5 font-bold">Members</th>
            <th className="px-3 py-2.5 font-bold">Status</th>
            <th className="px-4 py-2.5 font-bold text-right">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => (
            <tr key={p.id} onClick={() => onOpen(p.id)}
                className="border-b border-surface-3 last:border-0 cursor-pointer hover:bg-surface-1">
              <td className="px-4 py-3">
                <div className="font-bold text-blue-800">{p.name}</div>
                <div className="text-[11.5px] text-text-400 font-mono mt-0.5">{p.taxonQuery}</div>
              </td>
              <td className="px-3 py-3"><Badge tone={p.role === 'Lead' ? 'blue' : p.role === 'Contributor' ? 'cyan' : 'neutral'} size="sm">{p.role}</Badge></td>
              <td className="px-3 py-3 text-text-500">{p.region}</td>
              <td className="px-3 py-3 text-right font-mono">{p.nSpecies}</td>
              <td className="px-3 py-3 text-right font-mono">{fmtN(p.nRecords)}</td>
              <td className="px-3 py-3"><AvatarStack list={window.MOCK.MEMBERS.slice(0, 4).map(m => ({ initials: m.initials, name: m.name }))} size={18}/></td>
              <td className="px-3 py-3">
                {p.locked
                  ? <Badge tone="dark" size="sm" icon={<window.Icons.Lock size={10}/>}>Locked</Badge>
                  : <Badge tone="outline" size="sm">In progress</Badge>}
              </td>
              <td className="px-4 py-3 text-right text-text-400 font-mono text-[12px]">{relTime(p.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.DashboardScreen = DashboardScreen;
