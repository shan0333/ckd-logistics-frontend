'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiGroupLine, RiSearchLine, RiUserSettingsLine } from 'react-icons/ri';
import {
  getAccessGroups, createAccessGroup, updateAccessGroup, deleteAccessGroup, getAccessUsers, assignAccessGroup, setAppAccess,
} from '@/lib/api';
import { ACCESS_MODULES, type AccessLevel, type AccessModule } from '@/lib/access';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import { getRoles } from '@/lib/auth';

interface Group { id: number; name: string; members: number; access: Partial<Record<AccessModule, AccessLevel>> }
interface AccessUser {
  id: number; username: string | null; email: string; roles: string | null; adminRole: boolean; superAdmin: boolean;
  groupId: number | null; groupName: string | null; appAllowed: boolean;
}
type Choice = AccessLevel | 'NONE';

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || fallback;

function LevelChip({ level }: { level?: AccessLevel }) {
  if (!level) return <span className="text-slate-300">—</span>;
  return (
    <span className={clsx('inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
      level === 'FULL' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>
      {level === 'FULL' ? 'Full' : 'View'}
    </span>
  );
}

export default function UserAccessPage() {
  const [tab, setTab] = useState<'users' | 'groups'>('users');
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [savingUser, setSavingUser] = useState<number | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<AccessUser | null>(null);
  // App access (which app a user may open) is the Super Admin's call only - backend enforces it too.
  const viewerIsSuperAdmin = getRoles().some((r) => r.toUpperCase() === 'SUPER ADMIN');

  const [editing, setEditing] = useState<{ id: number | null; name: string; access: Record<AccessModule, Choice> } | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, u] = await Promise.all([getAccessGroups(), getAccessUsers()]);
      setGroups(g.data?.data ?? []);
      setUsers(u.data?.data ?? []);
    } catch (e) {
      toast.error(errMsg(e, 'Could not load user access.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Only this app's users (App access Allowed). The Super Admin can also show users without access,
  // since that's where they allow someone into this app.
  const [showBlocked, setShowBlocked] = useState(false);
  const blockedCount = useMemo(() => users.filter((u) => !u.appAllowed && !u.superAdmin).length, [users]);
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (u.appAllowed || u.superAdmin || (viewerIsSuperAdmin && showBlocked))
      && (!q || u.email.toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q))
      && (groupFilter === '' || (groupFilter === 'none' ? u.groupId == null : String(u.groupId) === groupFilter)));
  }, [users, search, groupFilter, showBlocked, viewerIsSuperAdmin]);

  const assign = async (u: AccessUser, value: string) => {
    const groupId = value === '' ? null : Number(value);
    setSavingUser(u.id);
    try {
      await assignAccessGroup(u.id, groupId);
      const g = groups.find((x) => x.id === groupId);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, groupId, groupName: g?.name ?? null } : x)));
      setGroups((prev) => prev.map((x) => ({
        ...x,
        members: x.members + (x.id === groupId ? 1 : 0) - (x.id === u.groupId ? 1 : 0),
      })));
      toast.success(`${u.email} → ${g?.name ?? 'No group (default access)'}`);
    } catch (e) {
      toast.error(errMsg(e, 'Could not save.'));
    } finally {
      setSavingUser(null);
    }
  };

  const saveAppAccess = async (u: AccessUser, allowed: boolean) => {
    setSavingUser(u.id);
    try {
      await setAppAccess(u.id, allowed);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, appAllowed: allowed } : x)));
      toast.success(`${u.email}: Logistics ${allowed ? 'allowed' : 'blocked'}`);
    } catch (e) {
      toast.error(errMsg(e, 'Could not save.'));
    } finally {
      setSavingUser(null);
    }
  };

  const openGroup = (g: Group | null) => {
    const access = {} as Record<AccessModule, Choice>;
    ACCESS_MODULES.forEach((m) => { access[m.key] = g?.access?.[m.key] ?? 'NONE'; });
    setEditing({ id: g?.id ?? null, name: g?.name ?? '', access });
  };

  const saveGroup = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Group name is required'); return; }
    setSavingGroup(true);
    try {
      const payload = { name: editing.name.trim(), access: editing.access as Record<string, string> };
      if (editing.id == null) await createAccessGroup(payload);
      else await updateAccessGroup(editing.id, payload);
      toast.success('Group saved');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Could not save the group.'));
    } finally {
      setSavingGroup(false);
    }
  };

  const removeGroup = async () => {
    const g = confirmDelete;
    setConfirmDelete(null);
    if (!g) return;
    try {
      await deleteAccessGroup(g.id);
      toast.success(`Group "${g.name}" deleted`);
      load();
    } catch (e) {
      toast.error(errMsg(e, 'Could not delete the group.'));
    }
  };

  const tabClass = (active: boolean) => clsx(
    'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors',
    active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100');

  return (
    <div>
      <ConfirmDialog
        testId="access-block-confirm"
        open={!!confirmBlock}
        title="Block from Logistics"
        message={`Block ${confirmBlock?.email} from the Logistics app? They won't be able to sign in to it.`}
        confirmLabel="Block"
        onConfirm={() => { const u = confirmBlock; setConfirmBlock(null); if (u) saveAppAccess(u, false); }}
        onCancel={() => setConfirmBlock(null)}
      />
      <ConfirmDialog
        testId="access-group-delete-confirm"
        open={!!confirmDelete}
        title="Delete Group"
        message={`Delete group "${confirmDelete?.name}"?`}
        confirmLabel="Delete"
        onConfirm={removeGroup}
        onCancel={() => setConfirmDelete(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Access</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Put each user in a group; the group decides which menus they see and whether they can only view or also edit.
          </p>
        </div>
        <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1 self-start">
          <button data-testid="access-tab-users" className={tabClass(tab === 'users')} onClick={() => setTab('users')}>
            <RiUserSettingsLine className="w-4 h-4" /> Users
          </button>
          <button data-testid="access-tab-groups" className={tabClass(tab === 'groups')} onClick={() => setTab('groups')}>
            <RiGroupLine className="w-4 h-4" /> Groups
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : tab === 'users' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100">
            <div className="relative flex-1">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input data-testid="access-user-search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select data-testid="access-user-group-filter" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">All groups</option>
              {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
              <option value="none">No group</option>
            </select>
            {viewerIsSuperAdmin && (
              <label className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white whitespace-nowrap cursor-pointer">
                <input type="checkbox" data-testid="access-show-blocked" checked={showBlocked} onChange={(e) => setShowBlocked(e.target.checked)} />
                Show users without access ({blockedCount})
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3 w-40">App access</th>
                  <th className="text-left px-4 py-3 w-64">Group</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100" data-testid={`access-user-row-${u.id}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{u.username || u.email}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{u.roles || '—'}</td>
                    <td className="px-4 py-2.5">
                      {u.superAdmin ? (
                        <span className="text-xs font-semibold text-emerald-700">Allowed</span>
                      ) : !viewerIsSuperAdmin ? (
                        <span data-testid={`access-user-app-${u.id}`} title="Only the Super Admin can change App access"
                          className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border',
                            u.appAllowed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700')}>
                          {u.appAllowed ? 'Allowed' : 'Blocked'}
                        </span>
                      ) : (
                        <button data-testid={`access-user-app-${u.id}`} disabled={savingUser === u.id}
                          onClick={() => (u.appAllowed ? setConfirmBlock(u) : saveAppAccess(u, true))}
                          title={u.appAllowed ? 'Click to block this user from Logistics' : 'Click to allow this user into Logistics'}
                          className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold border disabled:opacity-60',
                            u.appAllowed ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100')}>
                          {u.appAllowed ? 'Allowed' : 'Blocked'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <select data-testid={`access-user-group-${u.id}`} value={u.groupId == null ? '' : String(u.groupId)}
                        disabled={savingUser === u.id} onChange={(e) => assign(u, e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white disabled:opacity-60">
                        <option value="">No group (default)</option>
                        {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                      </select>
                      {u.superAdmin ? <p className="text-[11px] text-amber-600 mt-1">Super Admin — always has full access</p>
                        : u.adminRole && <p className="text-[11px] text-amber-600 mt-1">Admin role — full access while App access is Allowed</p>}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
            No group = view only on Shipments, Receiving and Shipment Report. Blocked = can&apos;t sign in to Logistics; only the Super Admin can change App access. Changes apply on the user&apos;s next page load.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <p className="text-xs text-slate-500">— = no access (menu hidden). Reports: View and Full both allow download.</p>
            <button data-testid="access-group-add" onClick={() => openGroup(null)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
              <RiAddLine className="w-4 h-4" /> New Group
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Group</th>
                  {ACCESS_MODULES.map((m) => <th key={m.key} className="px-3 py-3 text-center whitespace-nowrap">{m.label}</th>)}
                  <th className="px-3 py-3 text-center">Users</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-t border-slate-100" data-testid={`access-group-row-${g.id}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{g.name}</td>
                    {ACCESS_MODULES.map((m) => <td key={m.key} className="px-3 py-2.5 text-center"><LevelChip level={g.access?.[m.key]} /></td>)}
                    <td className="px-3 py-2.5 text-center text-slate-600">{g.members}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <button data-testid={`access-group-edit-${g.id}`} onClick={() => openGroup(g)} title="Edit"
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><RiEditLine className="w-4 h-4" /></button>
                      <button data-testid={`access-group-delete-${g.id}`} onClick={() => setConfirmDelete(g)} title="Delete"
                        className="p-1.5 rounded hover:bg-red-50 text-red-600"><RiDeleteBinLine className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id == null ? 'New Group' : 'Edit Group'} size="lg" testId="access-group-modal">
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Group name</label>
              <input data-testid="access-group-name" value={editing.name} maxLength={60}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {ACCESS_MODULES.map((m) => (
                <div key={m.key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-slate-700">{m.label}</span>
                  <div className="flex gap-1" role="radiogroup" aria-label={m.label}>
                    {(['NONE', 'VIEW', 'FULL'] as Choice[]).map((c) => (
                      <button key={c} type="button" data-testid={`access-group-${m.key}-${c}`}
                        aria-pressed={editing.access[m.key] === c}
                        onClick={() => setEditing({ ...editing, access: { ...editing.access, [m.key]: c } })}
                        className={clsx('px-3 py-1 rounded-md text-xs font-semibold border',
                          editing.access[m.key] === c
                            ? c === 'FULL' ? 'bg-emerald-600 border-emerald-600 text-white'
                              : c === 'VIEW' ? 'bg-sky-600 border-sky-600 text-white' : 'bg-slate-600 border-slate-600 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50')}>
                        {c === 'NONE' ? 'None' : c === 'VIEW' ? 'View' : 'Full'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100">Cancel</button>
              <button data-testid="access-group-save" onClick={saveGroup} disabled={savingGroup}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {savingGroup ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
