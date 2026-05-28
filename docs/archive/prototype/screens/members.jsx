/* global window, React */
// =========================================================================
// Members — invite / role / remove.
// =========================================================================
const { useState: useState_mem } = React;

function MembersScreen({ members, currentUser, project }) {
  const { Card, Eyebrow, Badge, Button, Avatar, TextField, Modal, useToast } = window.UI;
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = useState_mem(false);
  const [inviteEmail, setInviteEmail] = useState_mem('');
  const [inviteRole, setInviteRole] = useState_mem('Contributor');
  const isLead = currentUser.initials === 'MP';

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-7">
      <div className="flex items-end justify-between gap-6 mb-5 flex-wrap">
        <div>
          <Eyebrow className="mb-2">PROJECT MEMBERS</Eyebrow>
          <h1 className="text-[26px] font-black text-blue-800 leading-tight">{members.length} people on this project</h1>
          <p className="text-[13.5px] text-text-500 mt-1 max-w-2xl">Membership is per-project. Roles control who can include/exclude taxa, manage members, and lock for export.</p>
        </div>
        {isLead && <Button variant="primary" icon={<window.Icons.Plus size={13}/>} onClick={() => setInviteOpen(true)}>Invite member</Button>}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-1 border-b border-surface-3 text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-bold">Person</th>
              <th className="px-3 py-2.5 font-bold">Role</th>
              <th className="px-3 py-2.5 font-bold">Email</th>
              <th className="px-3 py-2.5 font-bold">Joined</th>
              <th className="px-4 py-2.5 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-3">
            {members.map(m => (
              <tr key={m.id} className="hover:bg-surface-1">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={m.initials} size={28}/>
                    <div>
                      <div className="font-bold text-text-700">{m.name}{m.initials === currentUser.initials && <span className="text-text-400 font-normal ml-1.5">(you)</span>}</div>
                      <div className="text-[11.5px] text-text-400 font-mono">u/{m.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {isLead && m.initials !== currentUser.initials ? (
                    <RoleDropdown value={m.role} onChange={(role) => toast.push({tone:'success', title:`Role changed to ${role}`, message:m.name})}/>
                  ) : (
                    <Badge tone={m.role === 'Lead' ? 'blue' : m.role === 'Contributor' ? 'cyan' : 'neutral'} size="sm">{m.role}</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-text-500">{m.email}</td>
                <td className="px-3 py-3 text-text-500 font-mono text-[12px]">{m.joined}</td>
                <td className="px-4 py-3 text-right">
                  {isLead && m.initials !== currentUser.initials ? (
                    <button className="text-danger-600 hover:underline text-[12px]">Remove</button>
                  ) : (
                    <span className="text-text-300 text-[12px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <Card className="p-4">
          <Badge tone="blue" size="sm">Lead</Badge>
          <div className="text-[12.5px] text-text-500 mt-2 leading-snug">Manage members, lock/unlock the project, delete project. Always at least one.</div>
        </Card>
        <Card className="p-4">
          <Badge tone="cyan" size="sm">Contributor</Badge>
          <div className="text-[12.5px] text-text-500 mt-2 leading-snug">Include/exclude taxa, accept/reject records, add cite-only records, resolve conflicts, comment.</div>
        </Card>
        <Card className="p-4">
          <Badge tone="neutral" size="sm">Reviewer</Badge>
          <div className="text-[12.5px] text-text-500 mt-2 leading-snug">Read-only access. Can comment and mark records "looks good" / "needs another look".</div>
        </Card>
      </div>

      {/* Invite modal */}
      {inviteOpen && (
        <Modal open={inviteOpen} onClose={() => setInviteOpen(false)}
          title="Invite a member"
          width={520}
          footer={
            <>
              <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { toast.push({tone:'success', title:'Invitation sent', message: inviteEmail}); setInviteOpen(false); setInviteEmail(''); }} disabled={!inviteEmail}>Send invite</Button>
            </>
          }>
          <div className="space-y-3">
            <TextField label="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@institution.edu"/>
            <div>
              <div className="text-[12.5px] font-semibold text-text-600 mb-1.5">Role</div>
              <div className="flex gap-2">
                {['Lead','Contributor','Reviewer'].map(r => (
                  <button key={r} onClick={() => setInviteRole(r)}
                    className={`flex-1 border rounded-md px-3 py-2 text-[12.5px] font-semibold text-left transition-colors
                      ${inviteRole === r ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-surface-3 hover:border-blue-300'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[12px] text-text-500">An email goes out via Clerk; the invitee creates an account or signs in to accept.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RoleDropdown({ value, onChange }) {
  const [open, setOpen] = useState_mem(false);
  const opts = ['Lead','Contributor','Reviewer'];
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2.5 h-7 rounded border border-surface-3 text-[12px] font-semibold text-text-600 hover:border-blue-300">
        {value} <window.Icons.ChevronDown size={11}/>
      </button>
      {open && (
        <div className="absolute left-0 mt-1 bg-white border border-surface-3 rounded-md shadow-pop z-10 overflow-hidden min-w-[140px]">
          {opts.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-[12.5px]">{o}</button>
          ))}
        </div>
      )}
    </div>
  );
}

window.SCREENS = window.SCREENS || {};
window.SCREENS.MembersScreen = MembersScreen;
