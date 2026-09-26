'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  getOrginList, deleteOrgin, getOrginImages,
} from '@/lib/api';
import { Orgin, OrginImage } from '@/lib/types';
import DataTable, { Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import ActionMenu from '@/components/ui/ActionMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShipmentImageGrid from '@/components/ui/ShipmentImageGrid';
import { formatDateTime, formatDateOnly } from '@/lib/dateTime';
import { RiAddLine, RiDeleteBinLine, RiImageLine, RiEyeLine } from 'react-icons/ri';
import { isAdmin, getLocId } from '@/lib/auth';

const STATUS_PILLS = [
  { label: 'All', value: '' },
  { label: 'New', value: 'NEW' },
  { label: 'In Transit', value: 'TRANSIT' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Work In-Progress', value: 'WORK IN-PROGRESS' },
  { label: 'Over Due', value: 'OVER DUE' },
  { label: 'Completed', value: 'COMPLETED' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Prefer the live Transporter Master name (joined server-side by transporter_master_id) over the
// free-text snapshot — they only diverge if the transporter was renamed in Master after this
// shipment was created and the row predates the transporter_master_id link (see the migration).
const transporterDisplayName = (row: Orgin): string => row.transporter_master_name ?? row.transporter_name ?? '';

// ETA is derived, never stored: LR Date + Transit Days. ATA is simply when the vehicle was
// actually reported at destination (set by the Receiving flow) — blank until then.
const etaFor = (row: Orgin): string => {
  const days = parseInt(row.transit_days ?? '', 10);
  if (!row.lr_date || Number.isNaN(days)) return '—';
  const d = new Date(row.lr_date);
  if (Number.isNaN(d.getTime())) return '—';
  d.setDate(d.getDate() + days);
  return formatDateOnly(d);
};

export default function OrginPage() {
  const [all, setAll] = useState<Orgin[]>([]);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      (r.shipment_no ?? '').toLowerCase().includes(q) ||
      (transporterDisplayName(r)).toLowerCase().includes(q) ||
      (r.vehicle_no ?? '').toLowerCase().includes(q)
    );
  }, [all, search]);

  const paged = useMemo(() =>
    filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize]
  );

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
      'COMPLETED': 'bg-indigo-100 text-indigo-700',
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
    { key: 'transporter_name', label: 'Transporter', sortable: true, render: (row) => transporterDisplayName(row) || '—' },
    { key: 'vehicle_no', label: 'Vehicle No' },
    { key: 'lr_no', label: 'LR No' },
    { key: 'lr_date', label: 'LR Date', render: (row) => formatDateOnly(row.lr_date) },
    { key: 'transit_days', label: 'Transit Days' },
    { key: 'eta', label: 'ETA', render: (row) => etaFor(row) },
    {
      key: 'ata', label: 'ATA',
      render: (row) => row.vehicle_reported_on ? formatDateTime(row.vehicle_reported_on) : '—',
    },
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
        <Link href="/orgin/new" data-testid="orgin-new-shipment-button"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          <RiAddLine /> New Shipment
        </Link>
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
              ['LR No', viewRow.lr_no], ['LR Date', formatDateOnly(viewRow.lr_date)],
              ['Transporter', transporterDisplayName(viewRow)], ['Transit Days', viewRow.transit_days],
              ['Fast Mode', viewRow.fast_mode], ['Inward ODC', viewRow.odc],
              ['Lot', viewRow.odc_lot ?? '—'], ['Scan Code', viewRow.odc_scan_code ?? '—'],
              ['Vehicle Reported On', formatDateTime(viewRow.vehicle_reported_on)],
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
          <ShipmentImageGrid testId="orgin-images-modal-grid" images={images} />
        )}
      </Modal>
    </div>
  );
}
