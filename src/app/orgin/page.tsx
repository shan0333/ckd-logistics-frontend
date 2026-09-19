'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getOrginList, createOrgin, deleteOrgin,
  getOrginCustomer, getVehicletype, getLocationList, getOrginImages, dupCheck,
} from '@/lib/api';
import { Orgin, GenericData, Location, OrginImage } from '@/lib/types';
import DataTable, { Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import ActionMenu from '@/components/ui/ActionMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { RiAddLine, RiDeleteBinLine, RiImageLine, RiEyeLine } from 'react-icons/ri';
import { isAdmin, getLocId } from '@/lib/auth';

// TEMPORARY (testing): while true, no new shipment can be saved from this form even with the
// ODC document attached. Set to false to go back to the normal "doc attached => can save" rule.
const SHIPMENT_CREATION_BLOCKED = true;

const EMPTY_ORG: Orgin = {
  shipment_no: '', vehicle_no: '', lr_no: '', lr_date: '',
  transporter_name: '', transit_days: '', fast_mode: 'N',
  odc: 'N', customer_id: '', shipment_route_from_id: '', shipment_route_to_id: '',
  vehicle_type: '', flag: 'O',
};
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

export default function OrginPage() {
  const [all, setAll] = useState<Orgin[]>([]);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [org, setOrg] = useState<Orgin>({ ...EMPTY_ORG });
  const [files, setFiles] = useState<File[]>([]);
  const [dupWarning, setDupWarning] = useState(false);
  const [customers, setCustomers] = useState<GenericData[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<GenericData[]>([]);
  const [routeFrom, setRouteFrom] = useState<Location[]>([]);
  const [routeTo, setRouteTo] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState(daysAgoStr(30));
  const [toDate, setToDate] = useState(todayStr());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [confirmRow, setConfirmRow] = useState<Orgin | null>(null);
  const [imageShipment, setImageShipment] = useState<string | null>(null);
  const [images, setImages] = useState<OrginImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [viewRow, setViewRow] = useState<Orgin | null>(null);
  const admin = isAdmin();
  const locId = getLocId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrginList({
        loc_id: locId != null ? String(locId) : '',
        flag: 'O',
        status: statusFilter ? [statusFilter] : [],
        fromDate, toDate,
      });
      setAll(res.data?.data ?? []);
    } catch { toast.error('Failed to load shipments'); }
    finally { setLoading(false); }
  }, [locId, statusFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Route From/To pickers: exclude the 'Logistics' hub location, then split the rest by the
  // signed-in user's own home location — their location becomes Route From, everything else
  // becomes Route To. No fixed location (locId null, HQ/admin) sees every location in both.
  useEffect(() => {
    getLocationList().then((res) => {
      const nested = res.data?.data;
      const raw: Location[] = Array.isArray(nested) ? nested : Array.isArray(res.data) ? res.data : [];
      const list = raw.filter((l) => l.name !== 'Logistics');
      if (locId == null) {
        setRouteFrom(list);
        setRouteTo(list);
      } else {
        setRouteFrom(list.filter((l) => l.id === locId));
        setRouteTo(list.filter((l) => l.id !== locId));
      }
    }).catch(() => {});
  }, [locId]);

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

  const loadDropdowns = async () => {
    const [cu, vt] = await Promise.all([getOrginCustomer(), getVehicletype()]);
    // A category with no rows yet gets back a 204 with an empty-string body, not null/undefined
    // — plain `?? []` doesn't catch that, so guard on Array.isArray instead.
    setCustomers(Array.isArray(cu.data) ? cu.data : []);
    setVehicleTypes(Array.isArray(vt.data) ? vt.data : []);
  };

  const openCreate = async () => {
    setOrg({ ...EMPTY_ORG });
    setFiles([]);
    setDupWarning(false);
    await loadDropdowns();
    setShowModal(true);
  };

  const checkDup = async () => {
    if (!org.shipment_no?.trim()) { setDupWarning(false); return; }
    try {
      const res = await dupCheck(org.shipment_no.trim());
      setDupWarning(res.data?.message === 'true');
    } catch { /* best-effort — don't block on a failed check */ }
  };

  // ODC document is mandatory for every new shipment, not just ODC='Y' ones — a placeholder
  // image attached just to get past this check still satisfies it (the backend has no way to
  // verify content), but at least one attachment must always be present.
  const odcDocMissing = files.length === 0;
  const saveBlocked = SHIPMENT_CREATION_BLOCKED || odcDocMissing;

  const save = async () => {
    if (SHIPMENT_CREATION_BLOCKED) {
      toast.error('ODC document must be attached before this shipment can be saved');
      return;
    }
    if (!org.customer_id) { toast.error('Customer is required'); return; }
    if (!org.shipment_route_from_id) { toast.error('Route From is required'); return; }
    if (!org.shipment_route_to_id) { toast.error('Route To is required'); return; }
    if (!org.shipment_no?.trim()) { toast.error('Shipment No is required'); return; }
    if (!org.vehicle_no?.trim()) { toast.error('Vehicle No is required'); return; }
    if (!org.lr_date) { toast.error('LR Date is required'); return; }
    if (!org.transporter_name?.trim()) { toast.error('Transporter is required'); return; }
    if (dupWarning) { toast.error('This Shipment No already exists'); return; }
    if (odcDocMissing) {
      toast.error('ODC document is required');
      return;
    }
    setSpinning(true);
    try {
      const payload: Orgin = { ...org, isfastflag: org.fast_mode === 'Y' };
      const formData = new FormData();
      formData.append('org', JSON.stringify(payload));
      files.forEach((f) => formData.append('files', f));
      const res = await createOrgin(formData);
      // The backend returns HTTP 200 even on a failed insert, putting the DB/exception
      // text in `message` (data stays null on success too, so it's not a usable signal).
      // Only CREATE_MESSAGE/UPDATE_MESSAGE ("… Successfully!") mean it actually saved.
      const msg: string = res?.data?.message ?? '';
      if (!/success/i.test(msg)) {
        toast.error(msg || 'Save failed');
        return;
      }
      toast.success('Shipment saved');
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSpinning(false);
    }
  };

  const del = async () => {
    if (!confirmRow) return;
    setConfirmRow(null);
    setSpinning(true);
    try {
      await deleteOrgin({ ...confirmRow, deleteFlag: true });
      toast.success('Deleted');
      load();
    } catch { toast.error('Delete failed'); }
    finally { setSpinning(false); }
  };

  const openImages = async (row: Orgin) => {
    if (!row.shipment_no) return;
    setImageShipment(row.shipment_no);
    setImages([]);
    setLoadingImages(true);
    try {
      const res = await getOrginImages(row.shipment_no, 'ORGIN');
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
    // Serial number by position (continues across pages), not the DB id — ids skip and
    // reflect insert order, which reads as a broken sequence in the table.
    { key: 'sno', label: '#', width: '50px', render: (row) => page * pageSize + paged.indexOf(row) + 1 },
    {
      key: 'shipment_no', label: 'Shipment No', sortable: true,
      render: (row) => (
        <button data-testid={`orgin-row-view-${row.shipment_no}`} className="text-blue-600 hover:underline font-medium" onClick={() => setViewRow(row)}>
          {row.shipment_no}
        </button>
      ),
    },
    { key: 'customer', label: 'Customer' },
    { key: 'shipment_route_from', label: 'Route From' },
    { key: 'shipment_route_to', label: 'Route To' },
    { key: 'transporter_name', label: 'Transporter', sortable: true },
    { key: 'vehicle_no', label: 'Vehicle No' },
    { key: 'lr_no', label: 'LR No' },
    { key: 'lr_date', label: 'LR Date' },
    { key: 'transit_days', label: 'Transit Days' },
    { key: 'curr_status', label: 'Status', render: (row) => statusBadge(row.curr_status) },
    { key: 'created_By', label: 'Created By' },
    {
      key: 'actions', label: 'Actions',
      render: (row) => (
        <ActionMenu triggerTestId={`orgin-row-actions-${row.shipment_no}`} items={[
          { label: 'View', icon: RiEyeLine, onClick: () => setViewRow(row), testId: `orgin-row-action-view-${row.shipment_no}` },
          { label: 'Images', icon: RiImageLine, onClick: () => openImages(row), testId: `orgin-row-action-images-${row.shipment_no}` },
          { label: 'Delete', icon: RiDeleteBinLine, danger: true, hidden: !admin, onClick: () => setConfirmRow(row), testId: `orgin-row-delete-${row.shipment_no}` },
        ]} />
      ),
    },
  ];

  const SEL = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div>
      {spinning && <Spinner fullScreen />}
      <ConfirmDialog
        testId="orgin-delete-confirm"
        open={!!confirmRow}
        title="Delete Shipment"
        message={`Delete shipment "${confirmRow?.shipment_no}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={del}
        onCancel={() => setConfirmRow(null)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} of {all.length} records</p>
        </div>
        <button data-testid="orgin-new-shipment-button" onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          <RiAddLine /> New Shipment
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" value={search} data-testid="orgin-search-input"
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by shipment no, transporter or vehicle…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
          </div>
          <div className="flex gap-2 items-center">
            <input type="date" value={fromDate} data-testid="orgin-date-from" onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={toDate} data-testid="orgin-date-to" onChange={(e) => { setToDate(e.target.value); setPage(0); }}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_PILLS.map(f => (
            <button key={f.value} data-testid={`orgin-status-pill-${f.value || 'ALL'}`} onClick={() => { setStatusFilter(f.value); setPage(0); }}
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
        <DataTable testId="orgin-table" columns={cols} data={paged} totalElements={filtered.length} page={page}
          pageSize={pageSize} sortColumn="" sortMode="" loading={loading}
          onPageChange={p => setPage(p)} onSort={() => {}}
          onPageSizeChange={(n) => { setPageSize(n); setPage(0); }} />
      </div>

      {/* Create */}
      <Modal testId="orgin-new-shipment-modal" open={showModal} onClose={() => setShowModal(false)} title="New Shipment" size="xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
            <select data-testid="orgin-modal-customer-select" className={SEL} value={org.customer_id} onChange={e => setOrg(p => ({ ...p, customer_id: e.target.value }))}>
              <option value="">Select customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.data}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle Type</label>
            <select data-testid="orgin-modal-vehicletype-select" className={SEL} value={org.vehicle_type} onChange={e => setOrg(p => ({ ...p, vehicle_type: e.target.value }))}>
              <option value="">Select type</option>
              {vehicleTypes.map((v) => <option key={v.id} value={v.id}>{v.data}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Route From</label>
            <select data-testid="orgin-modal-route-from-select" className={SEL} value={org.shipment_route_from_id} onChange={e => setOrg(p => ({ ...p, shipment_route_from_id: e.target.value }))}>
              <option value="">Select origin</option>
              {routeFrom.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Route To</label>
            <select data-testid="orgin-modal-route-to-select" className={SEL} value={org.shipment_route_to_id} onChange={e => setOrg(p => ({ ...p, shipment_route_to_id: e.target.value }))}>
              <option value="">Select destination</option>
              {routeTo.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shipment No</label>
            <input data-testid="orgin-modal-shipment-no-input" className={SEL + (dupWarning ? ' border-red-400' : '')} value={org.shipment_no ?? ''}
              onBlur={checkDup}
              onChange={e => { setOrg(p => ({ ...p, shipment_no: e.target.value })); setDupWarning(false); }} />
            {dupWarning && <p data-testid="orgin-modal-shipment-no-dupwarning" className="text-xs text-red-600 mt-1">This Shipment No already exists.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle No</label>
            <input data-testid="orgin-modal-vehicle-no-input" className={SEL} value={org.vehicle_no ?? ''}
              onChange={e => setOrg(p => ({ ...p, vehicle_no: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">LR No</label>
            <input data-testid="orgin-modal-lr-no-input" className={SEL} value={org.lr_no ?? ''}
              onChange={e => setOrg(p => ({ ...p, lr_no: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transporter</label>
            <input data-testid="orgin-modal-transporter-input" className={SEL} value={org.transporter_name ?? ''}
              onChange={e => setOrg(p => ({ ...p, transporter_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Transit Days</label>
            <input data-testid="orgin-modal-transit-days-input" className={SEL} value={org.transit_days ?? ''}
              onChange={e => setOrg(p => ({ ...p, transit_days: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">LR Date</label>
            <input type="date" data-testid="orgin-modal-lr-date-input" className={SEL} value={org.lr_date ?? ''}
              onChange={e => setOrg(p => ({ ...p, lr_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fast Mode</label>
            <select data-testid="orgin-modal-fastmode-select" className={SEL} value={org.fast_mode} onChange={e => setOrg(p => ({ ...p, fast_mode: e.target.value as 'Y' | 'N' }))}>
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ODC</label>
            <select data-testid="orgin-modal-odc-select" className={SEL} value={org.odc} onChange={e => setOrg(p => ({ ...p, odc: e.target.value as 'Y' | 'N' }))}>
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Attach Images<span className="text-red-500"> * (ODC document required)</span>
            </label>
            <input type="file" multiple accept="image/*" data-testid="orgin-modal-images-input" className={SEL + ' cursor-pointer'}
              onChange={e => setFiles(Array.from(e.target.files ?? []))} />
            {files.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{files.length} file(s) selected</p>
            )}
            {saveBlocked && (
              <p data-testid="orgin-modal-odc-doc-error" className="text-xs text-red-600 mt-1">
                ODC document must be attached before this shipment can be saved.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setShowModal(false)}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
          <button data-testid="orgin-modal-save-button" onClick={save} disabled={saveBlocked}
            title={saveBlocked ? 'ODC document must be attached before this shipment can be saved' : undefined}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600">Save Shipment</button>
        </div>
      </Modal>

      {/* View details — read-only. Editing shipment details (customer/route/vehicle/etc.) isn't
          exposed here: the backend's UPDATE_ORGIN only ever updates the receiving-side fields
          (fast mode, delay, ODC, vehicle-reported-on, status) via the Destination/receive
          workflow, not the fields set at creation — an edit form for those would silently no-op. */}
      <Modal testId="orgin-view-modal" open={!!viewRow} onClose={() => setViewRow(null)} title={`Shipment ${viewRow?.shipment_no ?? ''}`} size="lg">
        {viewRow && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Customer', viewRow.customer], ['Status', viewRow.curr_status],
              ['Route From', viewRow.shipment_route_from], ['Route To', viewRow.shipment_route_to],
              ['Vehicle Type', viewRow.vehicle_type], ['Vehicle No', viewRow.vehicle_no],
              ['LR No', viewRow.lr_no], ['LR Date', viewRow.lr_date],
              ['Transporter', viewRow.transporter_name], ['Transit Days', viewRow.transit_days],
              ['Fast Mode', viewRow.fast_mode], ['ODC', viewRow.odc],
              ['Vehicle Reported On', viewRow.vehicle_reported_on ?? '—'],
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

      {/* Images */}
      <Modal testId="orgin-images-modal" open={!!imageShipment} onClose={() => setImageShipment(null)} title={`Images — ${imageShipment ?? ''}`} size="lg">
        {loadingImages ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : images.length === 0 ? (
          <div data-testid="orgin-images-modal-empty-state" className="py-10 text-center text-slate-400 text-sm">No images uploaded for this shipment.</div>
        ) : (
          <div data-testid="orgin-images-modal-grid" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
