/* global window, React */
// =========================================================================
// Project Overview — landing screen with stats, next steps, activity feed,
// and the headline species map.
// =========================================================================

function OverviewScreen({ project, taxa, conflicts, activity, members, onOpenSpecies, setNav }) {
  const { Card, Eyebrow, Badge, Button, H2, H3, AvatarStack, PresenceStrip } = window.UI;
  const { CountyChoropleth } = window.MAP;
  const { fmtN, relTime, viridis } = window.UTIL;
  const top = window.MOCK.TOPLINE.p1;
  const headline = taxa[0];
  const nUnresolvedConflicts = conflicts.filter(c => !c.resolution).length;

  return (
    <div className="max-w-[1320px] mx-auto px-8 py-8">
      <div className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <Eyebrow className="mb-2">PROJECT OVERVIEW</Eyebrow>
          <h1 className="text-[30px] font-black text-blue-800 leading-tight" style={{letterSpacing:'-0.012em'}}>
            {project.name}
          </h1>
          <p className="text-[13.5px] text-text-500 mt-1.5 max-w-2xl">{project.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<window.Icons.Snapshot size={13}/>}>Snapshot history</Button>
          <Button variant="primary" icon={<window.Icons.List size={13}/>} onClick={() => setNav('checklist')}>Go to checklist</Button>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-7">
        <StatTile label="Species" value={top.nSpecies} sub={`${top.nIncluded} included · ${top.nExcluded} excluded · ${top.nUndecided} undecided`} accent/>
        <StatTile label="Records" value={fmtN(top.nRecords)} sub={`${fmtN(top.nAccepted)} accepted · ${top.nRejected} rejected · ${top.nFlagged} flagged`}/>
        <StatTile label="Counties with presence" value={top.nCountiesWithPresence} sub={`of ${92} in region`}/>
        <StatTile label="Manual / cite-only" value={window.MOCK.MANUAL_ENTRIES.length} sub="2 species augmented"/>
        <StatTile label="Conflicts" value={nUnresolvedConflicts} sub="taxonomic disagreements" tone={nUnresolvedConflicts > 0 ? 'warning' : 'neutral'}/>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Next steps */}
        <div className="xl:col-span-2 space-y-5">
          <Card className="p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <Eyebrow>NEXT STEPS</Eyebrow>
                <H3 className="mt-1">Where to spend your next hour</H3>
              </div>
              <Badge tone="blue" size="sm" icon={<window.Icons.Sparkles size={11}/>}>auto-prioritized</Badge>
            </div>
            <div className="divide-y divide-surface-3 -mx-5 mt-2">
              <NextStepRow
                tone="warning"
                icon={<window.Icons.Conflict size={14}/>}
                title={`${nUnresolvedConflicts} taxonomic conflict${nUnresolvedConflicts === 1 ? '' : 's'} unresolved`}
                body="GBIF and iNat disagree on the species concept for Alobates pennsylvanicus (orthography), Diaperis maculata (subspecies treatment), and Hymenorus pilosus (Campbell synonymy). Each conflict needs an explicit user choice; no defaults are pre-selected."
                cta={<Button variant="primary" size="sm" onClick={() => setNav('conflicts')}>Resolve →</Button>}/>
              <NextStepRow
                tone="warning"
                icon={<window.Icons.Question size={14}/>}
                title={`${top.nUndecided} species still marked undecided`}
                body="Hymenorus pilosus, H. densus, Mycetochara fraterna, Platydema subcostatum, Uloma impressa, Uloma punctulata. Six undecided species cluster in the Alleculinae and southern-tier Diaperinae."
                cta={<Button variant="secondary" size="sm" onClick={() => setNav('checklist')}>Triage →</Button>}/>
              <NextStepRow
                tone="info"
                icon={<window.Icons.Flag size={14}/>}
                title={`${top.nFlagged} records flagged for follow-up`}
                body="17 records flagged across 5 species — locality precision >10 km or specimens lacking date precision."
                cta={<Button variant="secondary" size="sm" onClick={() => setNav('records')}>Open records →</Button>}/>
              <NextStepRow
                tone="info"
                icon={<window.Icons.Lock size={14}/>}
                title="Lock and export when triage is complete"
                body="Generates a manuscript draft DOCX, species-level CSV, Darwin Core archive, and county distribution maps (SVG/PNG/PDF)."
                cta={<Button variant="ghost" size="sm" onClick={() => setNav('exports')}>Exports →</Button>}/>
            </div>
          </Card>

          {/* Headline species panel */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <Eyebrow>HEADLINE SPECIES</Eyebrow>
                <h3 className="text-[18px] font-bold text-blue-800 mt-1 italic">{headline.scientificName}
                  <span className="ml-2 text-[12px] not-italic font-normal text-text-500">{headline.authority}</span>
                </h3>
                <div className="text-[12.5px] text-text-500 mt-1">
                  <span className="font-bold text-text-700 tabular-nums">{headline.nRecords}</span> records ·
                  <span className="font-bold text-text-700 ml-1.5 tabular-nums">{headline.nCounties}</span> of 92 counties
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onOpenSpecies(headline.id)}>Open species →</Button>
            </div>
            <div className="flex justify-center">
              <CountyChoropleth countyPresence={headline.countyPresence} size="md" ariaLabel="Alobates pennsylvanicus county distribution"/>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card className="p-5">
            <Eyebrow>RECENT ACTIVITY</Eyebrow>
            <H3 className="mt-1">What's happened</H3>
            <div className="space-y-3.5 mt-2 max-h-[380px] overflow-y-auto nice-scroll -mx-5 px-5">
              {activity.slice(0, 6).map(a => (
                <ActivityItem key={a.id} a={a}/>
              ))}
            </div>
            <button onClick={() => setNav('activity')}
              className="text-blue-600 text-[12.5px] font-semibold mt-3 hover:underline">View full activity log →</button>
          </Card>

          <Card className="p-5">
            <Eyebrow>MEMBERS</Eyebrow>
            <H3 className="mt-1">Project team</H3>
            <div className="space-y-2.5 mt-2">
              {members.slice(0, 4).map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <window.UI.Avatar initials={m.initials} size={26}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text-700 font-semibold truncate">{m.name}</div>
                    <div className="text-[11.5px] text-text-400 truncate">{m.email}</div>
                  </div>
                  <Badge tone={m.role === 'Lead' ? 'blue' : m.role === 'Contributor' ? 'cyan' : 'neutral'} size="sm">{m.role}</Badge>
                </div>
              ))}
            </div>
            <button onClick={() => setNav('members')}
              className="text-blue-600 text-[12.5px] font-semibold mt-3 hover:underline">Manage members →</button>
          </Card>

          <Card className="p-5" accent>
            <Eyebrow>DATA SOURCES</Eyebrow>
            <H3 className="mt-1">Where it came from</H3>
            <div className="space-y-2.5 mt-2 text-[13px]">
              <SourceLine source="gbif" lastSynced="2026-05-22" count="1,612 records · 9 pages · cursor t8x21"/>
              <SourceLine source="inat"  lastSynced="2026-05-22" count="1,221 records · 6 pages · 0 errors"/>
              <SourceLine source="manual" lastSynced="2026-04-25" count="14 cite-only records · 2 contributors"/>
            </div>
            <div className="border-t border-surface-3 mt-4 pt-3 text-[11.5px] text-text-400 font-mono">
              Next polite re-sync: <span className="text-text-600">+72h</span> · Vercel Cron · 04:00 UTC
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent, tone = 'neutral' }) {
  const { Card } = window.UI;
  return (
    <Card accent={accent} className="px-4 py-3.5">
      <div className="text-[10.5px] uppercase tracking-[0.12em] font-bold text-text-400">{label}</div>
      <div className={`text-[26px] font-black leading-none mt-2 tabular-nums ${tone === 'warning' ? 'text-warning-700' : 'text-blue-800'}`}>
        {value}
      </div>
      <div className="text-[11.5px] text-text-500 mt-1.5 leading-snug">{sub}</div>
    </Card>
  );
}

function NextStepRow({ tone, icon, title, body, cta }) {
  const dot = tone === 'warning' ? 'bg-warning-50 text-warning-700' : 'bg-blue-50 text-blue-800';
  return (
    <div className="flex items-start gap-3.5 px-5 py-3.5">
      <span className={`h-7 w-7 rounded-full inline-flex items-center justify-center flex-shrink-0 ${dot}`}>{icon}</span>
      <div className="flex-1">
        <div className="text-[13.5px] font-bold text-text-700">{title}</div>
        <div className="text-[12.5px] text-text-500 mt-0.5 max-w-[60ch] leading-snug">{body}</div>
      </div>
      <div className="flex-shrink-0">{cta}</div>
    </div>
  );
}

function ActivityItem({ a }) {
  const { Avatar, Badge } = window.UI;
  const { relTime } = window.UTIL;
  const verb = ({
    include:'marked included',
    exclude:'marked excluded',
    comment:'commented on',
    reject:'rejected records',
    flag:'flagged',
    add_manual:'added cite-only',
    conflict_open:'flagged conflict',
    conflict_resolve:'resolved conflict',
    ingest:'ran ingest',
    create:'created',
    lock:'locked',
    unlock:'unlocked',
  })[a.action] || a.action;
  return (
    <div className="flex items-start gap-2.5">
      <Avatar initials={a.actor} size={22}/>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-text-600 leading-snug">
          <span className="font-bold text-text-700">{a.actor}</span>{' '}
          <span className="text-text-500">{verb}</span>{' '}
          <span className="font-bold text-blue-800 italic">{a.target}</span>
        </div>
        <div className="text-[11.5px] text-text-400 mt-0.5">{a.detail}</div>
        <div className="text-[11px] text-text-300 mt-0.5 font-mono">{relTime(a.ts)}</div>
      </div>
    </div>
  );
}

function SourceLine({ source, lastSynced, count }) {
  const { SourceChip } = window.UI;
  return (
    <div className="flex items-start gap-2.5">
      <SourceChip source={source}/>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-text-700">{count}</div>
        <div className="text-[11.5px] text-text-400 font-mono">last sync · {lastSynced}</div>
      </div>
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.OverviewScreen = OverviewScreen;
