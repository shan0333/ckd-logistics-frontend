'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getOrginList, createOrgin, getOrginImages,
} from '@/lib/api';
import { Orgin, OrginImage } from '@/lib/types';
import DataTable, { Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import ActionMenu from '@/components/ui/ActionMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { RiImageLine, RiEyeLine, RiInboxUnarchiveLine } from 'react-icons/ri';
import { getLocId } from '@/lib/auth';

const STATUS_PILLS = [
  { label: 'All', value: '' },
  { label: 'New', value: 'NEW' },
  { label: 'In Transit', value: 'TRANSIT' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Work In-Progress', value: 'WORK IN-PROGRESS' },
  { label: 'Over Due', value: 'OVER DUE' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// The receive form only ever writes what UPDATE_ORGIN actually persists (see Orgin page's
// note on the same limitation, the other direction) — vehicle-reported-on, delay/fast-mode
// applicable, ODC, and status. Nothing about the shipment itself (customer/route/vehicle) is
// editable from here.
const EMPTY_RECEIVE = {
  vehicle_reported_on: '', delay_applicable_or_not: 'N' as 'Y' | 'N',
  fast_mode_applicable_or_not: 'N' as 'Y' | 'N', odc: 'N' as 'Y' | 'N',
};

export default function DestinationPage() {
  const [all, setAll] = useState<Orgin[]>([]);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState(daysAgoStr(30));
  const [toDate, setToDate] = useState(todayStr());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [viewRow, setViewRow] = useState<Orgin | null>(null);
  const [imageShipment, setImageShipment] = useState<string | null>(null);
  const [images, setImages] = useState<OrginImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const [receiveRow, setReceiveRow] = useState<Orgin | null>(null);
  const [receiveForm, setReceiveForm] = useState({ ...EMPTY_RECEIVE });
  const [receiveFiles, setReceiveFiles] = useState<File[]>([]);
  // Photos already on file for this shipment (from an earlier Save) count toward the ODC
  // mandatory-doc check on Submit — receiveFiles alone would only see files picked in this
  // session and wrongly block a Submit that has no new files to add.
  const [existingReceiveImageCount, setExistingReceiveImageCount] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const locId = getLocId();
  // HQ/admin (no fixed location) can re-open a submitted/locked record via "Enable Edit" —
  // matches the legacy app's loc_id === -1 escape hatch, same modern equivalent used in auth.ts.
  const canForceUnlock = locId == null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrginList({
        loc_id: locId != null ? String(locId) : '',
        flag: 'D',
        status: statusFilter ? [statusFilter] : [],
        fromDate, toDate,
      });
      setAll(res.data?.data ?? []);
    } catch { toast.error('Failed to load inbound shipments'); }
    finally { setLoading(false); }
  }, [locId, statusFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      (r.shipment_no ?? '').toLowerCase().includes(q) ||
      (r.transporter_name ?? '').toLowerCase().includes(q) ||
      (r.vehicle_no ?? '').toLowerCase().includes(q)
    );
  }, [all, search]);

  const paged = useMemo(() =>
    filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize]
  );

  const isLocked = (row: Orgin) => row.org_status === 'S';

  const openReceive = async (row: Orgin) => {
    setReceiveRow(row);
    setReceiveForm({
      vehicle_reported_on: row.vehicle_reported_on ?? '',
      delay_applicable_or_not: (row.delay_applicable_or_not as 'Y' | 'N') ?? 'N',
      fast_mode_applicable_or_not: (row.fast_mode_applicable_or_not as 'Y' | 'N') ?? 'N',
      odc: (row.odc as 'Y' | 'N') ?? 'N',
    });
    setReceiveFiles([]);
    setExistingReceiveImageCount(0);
    setUnlocked(false);
    if (row.shipment_no) {
      try {
        const res = await getOrginImages(row.shipment_no, 'DEST');
        setExistingReceiveImageCount((res.data?.data ?? []).length);
      } catch { /* best-effort — worst case Submit asks for a file that's already on file */ }
    }
  };

  // Document is mandatory for every shipment on final Submit, not just ODC='Y' ones — matches
  // the same unconditional rule on the Origin (creation) page. Not enforced on the intermediate
  // Save (draft/Work-in-Progress), only on Submit which locks the record.
  const receiveDocMissing = existingReceiveImageCount + receiveFiles.length === 0;

  const handleSubmitClick = () => {
    if (receiveDocMissing) {
      toast.error('ODC document is required');
      return;
    }
    setConfirmSubmit(true);
  };

  const doSave = async (submit: boolean) => {
    if (!receiveRow) return;
    if (submit && receiveDocMissing) {
      toast.error('ODC document is required');
      return;
    }
    setSpinning(true);
    try {
      const payload: Orgin = {
        ...receiveRow,
        flag: 'D',
        ...receiveForm,
        org_status: submit ? 'S' : 'C',
      };
      const formData = new FormData();
      formData.append('org', JSON.stringify(payload));
      receiveFiles.forEach((f) => formData.append('files', f));
      const res = await createOrgin(formData);
      // Backend answers 200 even when the update fails, with the error text in `message`.
      // Treat only the "… Successfully!" messages as an actual save.
      const msg: string = res?.data?.message ?? '';
      if (!/success/i.test(msg)) {
        toast.error(msg || 'Save failed');
        return;
      }
      toast.success(submit ? 'Shipment marked received' : 'Saved');
      setReceiveRow(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSpinning(false);
    }
  };

  const openImages = async (row: Orgin) => {
    if (!row.shipment_no) return;
    setImageShipment(row.shipment_no);
    setImages([]);
    setLoadingImages(true);
    try {
      const res = await getOrginImages(row.shipment_no, 'DEST');
      setImages(res.data?.data ?? []);
    } catch { toast.error('Failed to load images'); }
    finally { setLoadingImages(false); }
  };

  const statusBadge = (status?: string) => {
    const map: Record<string, string> = {
      'RECEIVED': 'bg-green-100 text-green-700',
      'TRANSIT': 'bg-blue-100 text-blue-700',
      'OVER DUE': 'bg-red-100 text-red-700',
      'WORK IN-PROGRESS': 'bg-yellow-100 text-yellow-700',
      'NEW': 'bg-slate-100 text-slate-600',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status ? (map[status] ?? 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600'}`}>{status ?? '—'}</span>;
  };

  const cols: Column<Orgin>[] = [
    { key: 'id', label: '#', width: '50px' },
    {
      key: 'shipment_no', label: 'Shipment No', sortable: true,
      render: (row) => (
        <button data-testid={`destination-row-view-${row.shipment_no}`} className="text-blue-600 hover:underline font-medium" onClick={() => setViewRow(row)}>
          {row.shipment_no}
        </button>
      ),
    },
    { key: 'customer', label: 'Customer' },
    { key: 'shipment_route_from', label: 'Route From' },
    { key: 'transporter_name', label: 'Transporter' },
    { key: 'vehicle_no', label: 'Vehicle No' },
    { key: 'lr_date', label: 'LR Date' },
    { key: 'curr_status', label: 'Status', render: (row) => statusBadge(row.curr_status) },
    { key: 'vehicle_reported_on', label: 'Vehicle Reported On', render: (row) => row.vehicle_reported_on ?? '—' },
    {
      key: 'actions', label: 'Actions',
      render: (row) => (
        <ActionMenu triggerTestId={`destination-row-actions-${row.shipment_no}`} items={[
          { label: 'View', icon: RiEyeLine, onClick: () => setViewRow(row), testId: `destination-row-action-view-${row.shipment_no}` },
          {
            label: isLocked(row) ? (canForceUnlock ? 'Enable Edit' : 'Locked') : 'Receive',
            icon: RiInboxUnarchiveLine,
            hidden: isLocked(row) && !canForceUnlock,
            onClick: () => openReceive(row),
            testId: isLocked(row) ? `destination-enable-edit-button-${row.shipment_no}` : `destination-receive-button-${row.shipment_no}`,
          },
          { label: 'Images', icon: RiImageLine, onClick: () => openImages(row), testId: `destination-row-action-images-${row.shipment_no}` },
        ]} />
      ),
    },
  ];

  const SEL = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400';
  const formLocked = !!receiveRow && isLocked(receiveRow) && !unlocked;

  return (
    <div>
      {spinning && <Spinner fullScreen />}

      <ConfirmDialog
        testId="destination-submit-confirm"
        open={confirmSubmit}
        title="Submit Shipment"
        message="Once submitted, this record can't be edited again (unless an admin re-enables it). Continue?"
        confirmLabel="Submit"
        onConfirm={() => { setConfirmSubmit(false); doSave(true); }}
        onCancel={() => setConfirmSubmit(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receiving</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} of {all.length} inbound shipments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" value={search} data-testid="destination-search-input"
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by shipment no, transporter or vehicle…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          </div>
          <div className="flex gap-2 items-center">
            <input type="date" value={fromDate} data-testid="destination-date-from" onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={toDate} data-testid="destination-date-to" onChange={(e) => { setToDate(e.target.value); setPage(0); }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_PILLS.map(f => (
            <button key={f.value} data-testid={`destination-status-pill-${f.value || 'ALL'}`} onClick={() => { setStatusFilter(f.value); setPage(0); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === f.value
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 overflow-x-auto">
        <DataTable testId="destination-table" columns={cols} data={paged} totalElements={filtered.length} page={page}
          pageSize={pageSize} sortColumn="" sortMode="" loading={loading}
          onPageChange={p => setPage(p)} onSort={() => {}}
          onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} />
      </div>

      {/* View details */}
      <Modal testId="destination-view-modal" open={!!viewRow} onClose={() => setViewRow(null)} title={`Shipment ${viewRow?.shipment_no ?? ''}`} size="lg">
        {viewRow && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Customer', viewRow.customer], ['Status', viewRow.curr_status],
              ['Route From', viewRow.shipment_route_from], ['Route To', viewRow.shipment_route_to],
              ['Vehicle Type', viewRow.vehicle_type], ['Vehicle No', viewRow.vehicle_no],
              ['LR No', viewRow.lr_no], ['LR Date', viewRow.lr_date],
              ['Transporter', viewRow.transporter_name], ['Transit Days', viewRow.transit_days],
              ['Vehicle Reported On', viewRow.vehicle_reported_on ?? '—'],
              ['Delay Applicable', viewRow.delay_applicable_or_not ?? '—'],
              ['Fast Mode Applicable', viewRow.fast_mode_applicable_or_not ?? '—'],
              ['ODC', viewRow.odc ?? '—'],
              ['Created By', viewRow.created_By], ['Updated By', viewRow.updated_By ?? '—'],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="text-slate-800">{(value as string) || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Receive */}
      <Modal testId="destination-receive-modal" open={!!receiveRow} onClose={() => setReceiveRow(null)}
        title={`Receive — ${receiveRow?.shipment_no ?? ''}`} size="lg">
        {receiveRow && (
          <div className="flex flex-col gap-4">
            {formLocked && (
              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center justify-between">
                <span>This shipment has already been submitted and is locked.</span>
                {canForceUnlock && (
                  <button data-testid="destination-enable-edit-button" onClick={() => setUnlocked(true)} className="font-semibold underline shrink-0 ml-3">Enable Edit</button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Reported On</label>
                <input type="date" data-testid="destination-modal-vehicle-reported-on-input" disabled={formLocked} className={SEL} value={receiveForm.vehicle_reported_on}
                  onChange={e => setReceiveForm(p => ({ ...p, vehicle_reported_on: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Delay Applicable</label>
                <select data-testid="destination-modal-delay-select" disabled={formLocked} className={SEL} value={receiveForm.delay_applicable_or_not}
                  onChange={e => setReceiveForm(p => ({ ...p, delay_applicable_or_not: e.target.value as 'Y' | 'N' }))}>
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fast Mode Applicable</label>
                <select data-testid="destination-modal-fastmode-select" disabled={formLocked} className={SEL} value={receiveForm.fast_mode_applicable_or_not}
                  onChange={e => setReceiveForm(p => ({ ...p, fast_mode_applicable_or_not: e.target.value as 'Y' | 'N' }))}>
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ODC</label>
                <select data-testid="destination-modal-odc-select" disabled={formLocked} className={SEL} value={receiveForm.odc}
                  onChange={e => setReceiveForm(p => ({ ...p, odc: e.target.value as 'Y' | 'N' }))}>
                  <option value="N">No</option>
                  <option value="Y">Yes</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Attach Images<span className="text-red-500"> * (ODC document required)</span>
                </label>
                <input type="file" multiple accept="image/*" data-testid="destination-modal-images-input" disabled={formLocked} className={SEL + ' cursor-pointer'}
                  onChange={e => setReceiveFiles(Array.from(e.target.files ?? []))} />
                {receiveFiles.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">{receiveFiles.length} file(s) selected</p>
                )}
                {receiveFiles.length === 0 && existingReceiveImageCount > 0 && (
                  <p className="text-xs text-slate-500 mt-1">{existingReceiveImageCount} photo(s) already on file</p>
                )}
                {receiveDocMissing && (
                  <p data-testid="destination-modal-odc-doc-error" className="text-xs text-red-600 mt-1">
                    ODC document must be attached before this shipment can be submitted.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => setReceiveRow(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
              <button data-testid="destination-save-button" onClick={() => doSave(false)} disabled={formLocked}
                className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
              <button data-testid="destination-submit-button" onClick={handleSubmitClick} disabled={formLocked || receiveDocMissing}
                title={receiveDocMissing ? 'ODC document must be attached before this shipment can be submitted' : undefined}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Submit</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Images — note: the backend's getImageList only filters by category when flag is
          exactly "ORGIN" (see OrginController.getImageList); passing "DEST" here returns every
          image on the shipment regardless of category, matching the legacy app's own behavior. */}
      <Modal testId="destination-images-modal" open={!!imageShipment} onClose={() => setImageShipment(null)} title={`Images — ${imageShipment ?? ''}`} size="lg">
        {loadingImages ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : images.length === 0 ? (
          <div data-testid="destination-images-modal-empty-state" className="py-10 text-center text-slate-400 text-sm">No images uploaded for this shipment.</div>
        ) : (
          <div data-testid="destination-images-modal-grid" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map((img) => (
              <button key={img.id} onClick={() => window.open(img.s3_url, '_blank', 'noopener,noreferrer')}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 hover:opacity-80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.s3_url} alt={img.file_name ?? 'Shipment'} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
