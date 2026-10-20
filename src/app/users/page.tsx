'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiEyeLine, RiKeyLine } from 'react-icons/ri';
import {
  getUserList, saveUser, resetUserPassword, viewUserPassword, getLocationList,
  getAccessUsers, getAccessGroups, assignAccessGroup,
} from '@/lib/api';
import DataTable, { Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import ActionMenu from '@/components/ui/ActionMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { getUsername } from '@/lib/auth';

// Logistics users: everyone who can open the Logistics app. A user created here can open only
// Logistics (backend: UserServiceImpl.createUser app=LOGISTICS); the Super Admin can allow CKD
// later on User Access. Admin / Super Admin only (page rule in lib/access.tsx + backend).
interface Row {
  id: number;
  userName: string;
  email: string;
  roles: string[];
  locId: number | null;
  customerId: number | null;
  groupId: number | null;
  groupName: string | null;
  superAdmin: boolean;
  ckdBlocked: boolean;
}
interface Group { id: number; name: string }
interface Location { id: number; name: string }
interface Form { id?: number; userName: string; email: string; admin: boolean; locId: string; groupId: string; customerId: number | null; otherRoles: string[]; superAdmin: boolean }

const EMPTY: Form = { userName: '', email: '', admin: false, locId: '', groupId: '', customerId: null, otherRoles: [], superAdmin: false };
const INPUT = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const BTN_PRI = 'px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60';
const BTN_SEC = 'px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50';

export default function UsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState<Form | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [confirmReset, setConfirmReset] = useState<Row | null>(null);
  const [passwordView, setPasswordView] = useState<{ title: string; value: string } | null>(null);
  const me = getUsername().toLowerCase();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, a, g, l] = await Promise.all([getUserList(), getAccessUsers(), getAccessGroups(), getLocationList()]);
      const users: any[] = u.data?.data ?? [];
      const access = new Map<number, any>((a.data?.data ?? []).map((x: any) => [Number(x.id), x]));
      setRows(users
        .map((x) => {
          const acc = access.get(Number(x.id));
          if (!acc) return null;
          return {
            id: Number(x.id),
            userName: x.userName ?? acc.username ?? '',
            email: x.email ?? acc.email ?? '',
            roles: String(x.role ?? acc.roles ?? '').split(',').map((r: string) => r.trim()).filter(Boolean),
            locId: x.locId ?? null,
            customerId: x.customerId ?? null,
            groupId: acc.groupId ?? null,
            groupName: acc.groupName ?? null,
            superAdmin: !!acc.superAdmin,
            ckdBlocked: (acc.blockedApps ?? []).includes('CKD'),
            appAllowed: acc.appAllowed !== false,
          };
        })
        .filter((x): x is Row & { appAllowed: boolean } => !!x && (x.appAllowed || x.superAdmin)));
      setGroups(g.data?.data ?? []);
      setLocations(l.data?.data ?? []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? rows : rows.filter((r) => r.userName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q));
  }, [rows, search]);
  const paged = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);
  const locName = (id: number | null) => (id == null ? 'All locations' : locations.find((l) => Number(l.id) === Number(id))?.name ?? `#${id}`);

  const openEdit = (r: Row) => setForm({
    id: r.id, userName: r.userName, email: r.email, admin: r.roles.map((x) => x.toUpperCase()).includes('ADMIN'),
    locId: r.locId == null ? '' : String(r.locId), groupId: r.groupId == null ? '' : String(r.groupId), customerId: r.customerId,
    otherRoles: r.roles.filter((x) => !['ADMIN', 'USER'].includes(x.toUpperCase())), superAdmin: r.superAdmin,
  });

  const showPassword = async (id: number, title: string) => {
    const res = await viewUserPassword(id);
    setPasswordView({ title, value: res.data?.name ?? '—' });
  };

  const save = async () => {
    if (!form) return;
    if (!form.userName.trim()) { toast.error('Username is required'); return; }
    if (form.userName.trim().length < 3) { toast.error('Username needs at least 3 characters'); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { toast.error('Enter a valid email'); return; }
    // Only Admin / User is chosen here; any other role the user holds (e.g. MANAGEMENT for CKD) is kept.
    const roles = form.superAdmin ? undefined
      : [...form.otherRoles, ...(form.admin ? ['ADMIN'] : form.otherRoles.length ? [] : ['USER'])];
    setSpinning(true);
    try {
      const res = await saveUser({
        ...(form.id ? { id: form.id, customerId: form.customerId } : {}),
        userName: form.userName.trim(), email: form.email.trim(), roles,
        locId: form.locId === '' ? null : Number(form.locId), app: 'LOGISTICS',
      });
      const msg: string = res.data?.message ?? '';
      if (/already exists|unexpected error/i.test(msg)) {
        toast.error(/already exists/i.test(msg)
          ? 'This email already has a login (it may be a CKD user). Ask the Super Admin to allow Logistics for it on User Access.'
          : msg);
        return;
      }
      // Group: the user's id is needed, so for a new user find it by email.
      const list: any[] = (await getAccessUsers()).data?.data ?? [];
      const saved = list.find((x) => String(x.email).toLowerCase() === form.email.trim().toLowerCase());
      const wantGroup = form.groupId === '' ? null : Number(form.groupId);
      if (saved && (saved.groupId ?? null) !== wantGroup) await assignAccessGroup(Number(saved.id), wantGroup);
      toast.success(form.id ? 'User updated' : 'User created - Logistics access only');
      setForm(null);
      await load();
      if (!form.id && saved) await showPassword(Number(saved.id), `Password for ${form.userName.trim()}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSpinning(false);
    }
  };

  const del = async () => {
    const r = confirmDelete;
    setConfirmDelete(null);
    if (!r) return;
    setSpinning(true);
    try {
      await saveUser({ id: r.id, deleteFlag: true });
      toast.success('User deleted');
      load();
    } catch { toast.error('Delete failed'); } finally { setSpinning(false); }
  };

  const resetPassword = async () => {
    const r = confirmReset;
    setConfirmReset(null);
    if (!r) return;
    setSpinning(true);
    try {
      await resetUserPassword({ id: r.id, userName: r.userName });
      await showPassword(r.id, `New password for ${r.userName}`);
    } catch { toast.error('Reset password failed'); } finally { setSpinning(false); }
  };

  const cols: Column<Row>[] = [
    { key: 'id', label: '#', width: '60px' },
    { key: 'userName', label: 'Username' },
    { key: 'email', label: 'Email' },
    {
      key: 'roles', label: 'Role',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.map((x) => <span key={x} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-medium">{x}</span>)}
        </div>
      ),
    },
    { key: 'groupName', label: 'Group', render: (r) => r.superAdmin || r.roles.includes('ADMIN') ? <span className="text-slate-400">Full access</span> : (r.groupName ?? <span className="text-slate-400">No group (default)</span>) },
    { key: 'locId', label: 'Home Location', render: (r) => locName(r.locId) },
    { key: 'apps', label: 'Apps', render: (r) => (r.superAdmin || !r.ckdBlocked ? 'Logistics + CKD' : 'Logistics') },
    {
      key: 'actions', label: 'Actions',
      render: (r) => (
        <ActionMenu triggerTestId={`users-row-actions-${r.id}`} items={[
          { label: 'Edit', icon: RiEditLine, onClick: () => openEdit(r), testId: `users-edit-${r.id}` },
          { label: 'View Password', icon: RiEyeLine, onClick: () => { setSpinning(true); showPassword(r.id, `Password for ${r.userName}`).catch(() => toast.error('Failed to fetch password')).finally(() => setSpinning(false)); } },
          { label: 'Reset Password', icon: RiKeyLine, onClick: () => setConfirmReset(r) },
          // Only Logistics-only users can be deleted here - deleting someone who also uses CKD
          // would remove them from CKD too.
          { label: 'Delete', icon: RiDeleteBinLine, danger: true, hidden: r.superAdmin || !r.ckdBlocked || r.email.toLowerCase() === me,
            onClick: () => setConfirmDelete(r), testId: `users-delete-${r.id}` },
        ]} />
      ),
    },
  ];

  return (
    <div>
      {spinning && <Spinner fullScreen />}
      <ConfirmDialog testId="users-delete-confirm" open={!!confirmDelete} title="Delete User"
        message={`Delete user "${confirmDelete?.userName}"? This cannot be undone.`} confirmLabel="Delete"
        onConfirm={del} onCancel={() => setConfirmDelete(null)} />
      <ConfirmDialog testId="users-reset-confirm" open={!!confirmReset} title="Reset Password"
        message={`Reset the password for "${confirmReset?.userName}"? A new password will be generated.`} confirmLabel="Reset"
        onConfirm={resetPassword} onCancel={() => setConfirmReset(null)} />

      <Modal open={!!passwordView} onClose={() => setPasswordView(null)} title={passwordView?.title ?? ''} size="sm" testId="users-password-modal">
        <p className="text-sm text-slate-600 mb-2">Share this password with the user securely:</p>
        <div data-testid="users-password-value" className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg font-mono text-lg text-center text-slate-800 select-all">
          {passwordView?.value}
        </div>
        <div className="flex justify-end mt-6"><button onClick={() => setPasswordView(null)} className={BTN_PRI}>Close</button></div>
      </Modal>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} of {rows.length} users with Logistics access</p>
        </div>
        <button data-testid="users-new" onClick={() => setForm({ ...EMPTY })}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          <RiAddLine /> New User
        </button>
      </div>

      <div className="mb-5">
        <input data-testid="users-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search by username or email…"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6">
        <DataTable testId="users-table" columns={cols} data={paged} totalElements={filtered.length} page={page}
          pageSize={pageSize} sortColumn="" sortMode="" loading={loading}
          onPageChange={(p) => setPage(p)} onSort={() => {}}
          onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} />
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit User' : 'New User'} size="lg" testId="users-modal">
        {form && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input data-testid="users-username" className={INPUT} value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input data-testid="users-email" type="email" className={INPUT} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                {form.superAdmin ? <p className="text-sm text-slate-600 py-2">Super Admin</p> : (
                  <div className="flex gap-2">
                    {[{ v: false, l: 'User' }, { v: true, l: 'Admin' }].map((o) => (
                      <label key={o.l} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                        <input type="radio" data-testid={`users-role-${o.l.toLowerCase()}`} checked={form.admin === o.v} onChange={() => setForm({ ...form, admin: o.v })} /> {o.l}
                      </label>
                    ))}
                  </div>
                )}
                {form.otherRoles.length > 0 && <p className="text-xs text-slate-500 mt-1">Also keeps: {form.otherRoles.join(', ')}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Home Location</label>
                <select data-testid="users-location" className={INPUT} value={form.locId} onChange={(e) => setForm({ ...form, locId: e.target.value })}>
                  <option value="">All locations (HQ)</option>
                  {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Logistics group</label>
                <select data-testid="users-group" className={INPUT} value={form.groupId} disabled={form.admin || form.superAdmin}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                  <option value="">No group (default: view Shipments, Receiving, Shipment Report)</option>
                  {groups.map((g) => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
                </select>
                {(form.admin || form.superAdmin) && <p className="text-xs text-slate-500 mt-1">Admins have full access; the group doesn&apos;t apply.</p>}
              </div>
            </div>
            {!form.id && (
              <p className="text-xs text-slate-500 mt-3">
                The new user can open <b>Logistics only</b>. A password is generated and shown after saving; the Super Admin can allow CKD later on User Access.
              </p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setForm(null)} className={BTN_SEC}>Cancel</button>
              <button data-testid="users-save" onClick={save} disabled={spinning} className={BTN_PRI}>Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
