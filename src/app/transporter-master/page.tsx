'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getTransporterMasterList, createTransporter, updateTransporter, deleteTransporter,
  importTransportersFromShipments,
} from '@/lib/api';
import { Transporter } from '@/lib/types';
import DataTable, { Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import ActionMenu from '@/components/ui/ActionMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiDownloadCloud2Line } from 'react-icons/ri';
import { isAdmin } from '@/lib/auth';

const EMPTY: Transporter = { name: '', email: '', mobile: '', contactPerson: '' };

// The list endpoint does real server-side search (LIKE, case-insensitive collation) but this
// page still fetches one generous page and paginates client-side — same convention Shipments
// and Receiving already use, so a transporter list behaves the same way as everywhere else in
// this app. Transporter counts realistically stay in the hundreds, not the tens of thousands.
const FETCH_LIMIT = 500;

export default function TransporterMasterPage() {
  const [all, setAll] = useState<Transporter[]>([]);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Transporter>({ ...EMPTY });

  const [confirmRow, setConfirmRow] = useState<Transporter | null>(null);
  // Set only while we're waiting on the user to confirm a rename that will cascade onto
  // existing shipments (backend returned errorCode CONFIRM_RENAME) — see save() below.
  const [renameConfirm, setRenameConfirm] = useState<{ form: Transporter; affected: number } | null>(null);

  const admin = isAdmin();

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getTransporterMasterList({ offset: 0, limit: FETCH_LIMIT, search: q });
      setAll(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load transporters');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce the search box so it doesn't fire a request per keystroke — same pattern as the
  // Report page's part search.
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(search); }, 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const paged = useMemo(() =>
    all.slice(page * pageSize, (page + 1) * pageSize),
    [all, page, pageSize]
  );

  const openAdd = () => {
    setForm({ ...EMPTY });
    setShowModal(true);
  };

  // Backfills the master list from every distinct transporter_name already used on a shipment —
  // added with just a name; email/mobile/contact person are left blank for someone to fill in
  // via Edit. Safe to run more than once: names already present (active or soft-deleted) are
  // skipped by the backend, so re-running just picks up anything new.
  const importFromShipments = async () => {
    setSpinning(true);
    try {
      const res = await importTransportersFromShipments();
      toast.success(res.data?.message || 'Import complete');
      load(search);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Import failed');
    } finally {
      setSpinning(false);
    }
  };

  const openEdit = (row: Transporter) => {
    setForm({ ...row, confirmed: false });
    setShowModal(true);
  };

  // Shared by the normal Save click and by "Yes, rename anyway" in the cascade-confirm dialog —
  // `override` lets the latter force confirmed:true without a second render round-trip.
  const save = async (override?: Partial<Transporter>) => {
    const payload: Transporter = { ...form, ...override };
    if (!payload.name?.trim()) { toast.error('Transporter Name is required'); return; }
    if (!payload.email?.trim()) { toast.error('Email is required'); return; }
    if (!payload.mobile?.trim()) { toast.error('Mobile is required'); return; }
    if (!payload.contactPerson?.trim()) { toast.error('Contact Person Name is required'); return; }

    const isEdit = !!payload.id;
    setSpinning(true);
    try {
      const res = isEdit ? await updateTransporter(payload) : await createTransporter(payload);
      const dto = res.data ?? {};
      if (dto.errorCode === 'CONFIRM_RENAME') {
        // Nothing saved yet — show the warning and wait for an explicit yes/no.
        setRenameConfirm({ form: payload, affected: dto.totalElements ?? 0 });
        return;
      }
      toast.success(dto.message || (isEdit ? 'Transporter updated Successfully!' : 'Transporter created Successfully!'));
      setShowModal(false);
      setRenameConfirm(null);
      load(search);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSpinning(false);
    }
  };

  const confirmRename = () => {
    if (!renameConfirm) return;
    save({ ...renameConfirm.form, confirmed: true });
  };

  const del = async () => {
    if (!confirmRow?.id) return;
    const target = confirmRow;
    setConfirmRow(null);
    setSpinning(true);
    try {
      const res = await deleteTransporter(target.id!);
      toast.success(res.data?.message || 'Transporter deleted Successfully!');
      load(search);
    } catch (e: any) {
      // 409 IN_USE carries a ready-to-read message ("X" is used by N shipment(s)...) straight
      // from the backend — no need to reconstruct it client-side.
      toast.error(e?.response?.data?.message || 'Delete failed');
    } finally {
      setSpinning(false);
    }
  };

  const cols: Column<Transporter>[] = [
    { key: 'name', label: 'Transporter Name', sortable: true },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'contactPerson', label: 'Contact Person' },
    {
      key: 'shipmentCount', label: 'Shipments',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {row.shipmentCount ?? 0}
        </span>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      render: (row) => (
        <ActionMenu triggerTestId={`transporter-row-actions-${row.id}`} items={[
          { label: 'Edit', icon: RiEditLine, onClick: () => openEdit(row), testId: `transporter-row-edit-${row.id}` },
          { label: 'Delete', icon: RiDeleteBinLine, danger: true, hidden: !admin, onClick: () => setConfirmRow(row), testId: `transporter-row-delete-${row.id}` },
        ]} />
      ),
    },
  ];

  const SEL = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div>
      {(loading || spinning) && <Spinner fullScreen />}

      <ConfirmDialog
        testId="transporter-delete-confirm"
        open={!!confirmRow}
        title="Delete Transporter"
        message={`Delete "${confirmRow?.name ?? ''}"? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={del}
        onCancel={() => setConfirmRow(null)}
      />

      <ConfirmDialog
        testId="transporter-rename-confirm"
        open={!!renameConfirm}
        title="Rename Transporter"
        message={renameConfirm
          ? `"${renameConfirm.form.name}" is already used by ${renameConfirm.affected} existing shipment(s). Renaming it will update the transporter name on all of them. Continue?`
          : ''}
        confirmLabel="Yes, rename"
        onConfirm={confirmRename}
        onCancel={() => setRenameConfirm(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transporters</h1>
          <p className="text-sm text-gray-500 mt-0.5">{all.length} transporter(s)</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="transporter-import-button" onClick={importFromShipments}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">
            <RiDownloadCloud2Line className="w-4 h-4" /> Import from Shipments
          </button>
          <button data-testid="transporter-add-button" onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            <RiAddLine className="w-4 h-4" /> New Transporter
          </button>
        </div>
      </div>

      <div className="relative mb-5 max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input type="text" value={search} data-testid="transporter-search-input"
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, mobile or contact person…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
      </div>

      <DataTable testId="transporter-table" columns={cols} data={paged} totalElements={all.length} page={page}
        pageSize={pageSize} sortColumn="" sortMode="" loading={loading}
        onPageChange={p => setPage(p)} onSort={() => {}}
        onPageSizeChange={n => { setPageSize(n); setPage(0); }} />

      <Modal testId="transporter-modal" open={showModal} onClose={() => setShowModal(false)}
        title={form.id ? `Edit Transporter — ${form.name}` : 'New Transporter'}>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transporter Name</label>
            <input data-testid="transporter-modal-name-input" className={SEL} value={form.name ?? ''}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <p className="text-xs text-slate-400 mt-1">Must be unique — "VRL Logistics" and "VRL LOGISTICS" are treated as the same name.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" data-testid="transporter-modal-email-input" className={SEL} value={form.email ?? ''}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mobile</label>
            <input data-testid="transporter-modal-mobile-input" className={SEL} value={form.mobile ?? ''}
              onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person Name</label>
            <input data-testid="transporter-modal-contact-input" className={SEL} value={form.contactPerson ?? ''}
              onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowModal(false)}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
          <button data-testid="transporter-modal-save-button" onClick={() => save()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Save Transporter</button>
        </div>
      </Modal>
    </div>
  );
}
