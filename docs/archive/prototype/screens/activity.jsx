/* global window, React */
// =========================================================================
// Activity log — audit trail.
// =========================================================================
const { useState: useState_act } = React;

function ActivityScreen({ activity, members }) {
  const { Card, Eyebrow, Badge, Button, FilterChip, Avatar, useToast } = window.UI;
  const { fmtDateTime, relTime } = window.UTIL;
  const [filters, setFilters] = useState_act({ member:'all', action:'all', date:'all' });

  const actionMeta = {
    include:        { tone:'success', label:'Inclusion changed', icon: window.Icons.Check },
    exclude:        { tone:'neutral', label:'Inclusion changed', icon: window.Icons.X },
    comment:        { tone:'blue',    label:'Comment',           icon: window.Icons.Comment },
    reject:         { tone:'neutral', label:'Records rejected',  icon: window.Icons.X },
    flag:           { tone:'warning', label:'Record flagged',    icon: window.Icons.Flag },
    add_manual:     { tone:'cyan',    label:'Cite-only added',   icon: window.Icons.Pencil },
    conflict_open:  { tone:'warning', label:'Conflict flagged',  icon: window.Icons.Conflict },
    conflict_resolve:{tone:'success', label:'Conflict resolved', icon: window.Icons.Check },
    ingest:         { tone:'blue',    label:'Ingest run',        icon: window.Icons.Sparkles },
    create:         { tone:'blue',    label:'Project created',   icon: window.Icons.Plus },
    lock:           { tone:'dark',    label:'Locked',            icon: window.Icons.Lock },
    unlock:         { tone:'outline', label:'Unlocked',          icon: window.Icons.Unlock },
  };

  const filtered = activity.filter(a => {
    if (filters.member !== 'all' && a.actor !== filters.member) return false;
    if (filters.action !== 'all' && a.action !== filters.action) return false;
    return true;
  });

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">AUDIT TRAIL</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">Activity log</h1>
          <p className="text-[13.5px] text-text-500 mt-1 max-w-2xl">Every state-changing action is recorded here. The log is append-only — undoing an action in the UI emits a new entry that references the original.</p>
        </div>
        <Button variant="secondary" icon={<window.Icons.Download size={13}/>}>Export as JSONL</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[11.5px] text-text-500 mr-1 font-bold uppercase tracking-[0.1em]">Member</span>
        <FilterChip active={filters.member === 'all'} onClick={() => setFilters({...filters, member:'all'})}>All</FilterChip>
        {members.map(m => (
          <FilterChip key={m.id} active={filters.member === m.initials} onClick={() => setFilters({...filters, member: filters.member === m.initials ? 'all' : m.initials})}>{m.name}</FilterChip>
        ))}
        <span className="h-5 w-px bg-surface-3 mx-1"/>
        <span className="text-[11.5px] text-text-500 mr-1 font-bold uppercase tracking-[0.1em]">Action</span>
        {['include','exclude','comment','reject','flag','add_manual','conflict_resolve'].map(a => (
          <FilterChip key={a} active={filters.action === a} onClick={() => setFilters({...filters, action: filters.action === a ? 'all' : a})}>
            {actionMeta[a].label}
          </FilterChip>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-1 border-b border-surface-3 text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-bold w-[140px]">Timestamp</th>
              <th className="px-3 py-2.5 font-bold w-[140px]">Actor</th>
              <th className="px-3 py-2.5 font-bold w-[180px]">Action</th>
              <th className="px-3 py-2.5 font-bold">Target</th>
              <th className="px-3 py-2.5 font-bold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3">
            {filtered.map(a => {
              const m = actionMeta[a.action] || { tone:'neutral', label: a.action, icon: window.Icons.Activity };
              return (
                <tr key={a.id} className="hover:bg-surface-1">
                  <td className="px-4 py-3 align-top">
                    <div className="text-[12.5px] text-text-700 font-mono">{relTime(a.ts)}</div>
                    <div className="text-[11px] text-text-400 font-mono mt-0.5">{fmtDateTime(a.ts)}</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="inline-flex items-center gap-2"><Avatar initials={a.actor} size={22}/>
                      <span className="text-[12.5px] text-text-700 font-semibold">{members.find(mm => mm.initials === a.actor)?.name || a.actor}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <Badge tone={m.tone} size="sm" icon={<m.icon size={11}/>}>{m.label}</Badge>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="font-bold text-blue-800 italic">{a.target}</span>
                  </td>
                  <td className="px-3 py-3 align-top text-text-500 text-[12.5px] leading-snug">{a.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="text-[11.5px] text-text-400 mt-2 font-mono">{filtered.length} of {activity.length} entries · activity_log table</div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.ActivityScreen = ActivityScreen;
