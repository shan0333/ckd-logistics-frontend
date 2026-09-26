'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  getBillingDetailsList, getEligibleShipmentsForBilling, createBillingDetails, updateBillingDetails,
} from '@/lib/api';
import { BillingDetails, EligibleShipment } from '@/lib/types';
import DataTable, { Column } from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import ActionMenu from '@/components/ui/ActionMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { RiAddLine, RiEditLine, RiEyeLine } from 'react-icons/ri';
import { isAdmin } from '@/lib/auth';

const EMPTY: BillingDetails = {
  orginId: undefined, grnNumber: '', podStatus: '', invoiceNumber: '', invoiceDate: '',
  baseFare: '', haltingCharges: '', customerInvoiceNo: '', customerInvoiceDate: '',
  customerBaseFare: '', customerHaltingCharges: '', status: 'DRAFT',
};

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
};
const total = (a: unknown, b: unknown) => {
  const x = Number(a) || 0, y = Number(b) || 0;
  return (x + y).toFixed(2);
};

// The list endpoint does real server-side search, but this page still fetches one generous page
// and paginates client-side — same convention every other list in this app already uses.
const FETCH_LIMIT = 500;

export default function BillingDetailsPage() {
  const [all, setAll] = useState<BillingDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<BillingDetails>({ ...EMPTY });
  const [viewOnly, setViewOnly] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const [shipments, setShipments] = useState<EligibleShipment[]>([]);
  const [shipmentSearch, setShipmentSearch] = useState('');
  // Live results show as soon as there's a search term and nothing is picked yet — closed once a
  // shipment is chosen, reopened the moment the user edits the text again (picking implies "this
  // isn't right, let me search again").
  const [shipmentDropdownOpen, setShipmentDropdownOpen] = useState(false);

  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const admin = isAdmin();

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getBillingDetailsList({ offset: 0, limit: FETCH_LIMIT, search: q });
      setAll(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load billing details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); load(search); }, 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const loadShipments = useCallback(async (q: string) => {
    try {
      const res = await getEligibleShipmentsForBilling(q);
      setShipments(res.data?.data ?? []);
    } catch {
      toast.error('Failed to load eligible shipments');
    }
  }, []);

  // Debounce the shipment-picker search the same way the main list search is debounced.
  useEffect(() => {
    if (!showModal || form.id) return; // only needed for Add — Edit doesn't re-pick a shipment
    const t = setTimeout(() => loadShipments(shipmentSearch), 350);
    return () => clearTimeout(t);
  }, [showModal, form.id, shipmentSearch, loadShipments]);

  const paged = useMemo(() =>
    all.slice(page * pageSize, (page + 1) * pageSize),
    [all, page, pageSize]
  );

  const isLocked = (row: BillingDetails) => row.status === 'FINAL';

  const openAdd = () => {
    setForm({ ...EMPTY });
    setViewOnly(false);
    setUnlocked(false);
    setShipmentSearch('');
    setShipments([]);
    loadShipments('');
    setShowModal(true);
  };

  const openEdit = (row: BillingDetails, readOnly: boolean) => {
    setForm({ ...row });
    setViewOnly(readOnly);
    setUnlocked(false);
    setShowModal(true);
  };

  const formLocked = viewOnly || (!!form.id && isLocked(form) && !unlocked);

  // Every field is mandatory to save at all — Draft or Final — matching the backend's
  // validateAllFieldsRequired(). Checked client-side too so the user gets instant feedback
  // instead of a round trip.
  const REQUIRED_FIELDS: { key: keyof BillingDetails; label: string }[] = [
    { key: 'grnNumber', label: 'GRN Number' },
    { key: 'podStatus', label: 'POD Status' },
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'invoiceDate', label: 'Invoice Date' },
    { key: 'baseFare', label: 'Base Fare' },
    { key: 'haltingCharges', label: 'Halting Charges' },
    { key: 'customerInvoiceNo', label: 'Customer Invoice No' },
    { key: 'customerInvoiceDate', label: 'Customer Invoice Date' },
    { key: 'customerBaseFare', label: 'Customer Base Fare' },
    { key: 'customerHaltingCharges', label: 'Customer Halting Charges' },
  ];

  const doSave = async (asFinal: boolean) => {
    if (!form.orginId) { toast.error('Please select a shipment'); return; }
    for (const f of REQUIRED_FIELDS) {
      const v = form[f.key];
      if (v === undefined || v === null || String(v).trim() === '') {
        toast.error(`${f.label} is required.`);
        return;
      }
    }
    const payload: BillingDetails = { ...form, status: asFinal ? 'FINAL' : 'DRAFT' };
    setSpinning(true);
    try {
      const res = form.id ? await updateBillingDetails(payload) : await createBillingDetails(payload);
      const dto = res.data ?? {};
      toast.success(dto.message || 'Saved Successfully!');
      setShowModal(false);
      load(search);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSpinning(false);
    }
  };

  const cols: Column<BillingDetails>[] = [
    { key: 'shipmentNo', label: 'Shipment No', sortable: true },
    { key: 'invoiceNumber', label: 'Invoice Number', render: (row) => row.invoiceNumber || '—' },
    {
      key: 'podStatus', label: 'POD',
      render: (row) => row.podStatus === 'Y' ? 'Yes' : row.podStatus === 'N' ? 'No' : '—',
    },
    {
      key: 'totalBillingAmount', label: 'Total Billing Amount',
      render: (row) => row.totalBillingAmount != null ? money(row.totalBillingAmount) : '—',
    },
    { key: 'customerInvoiceNo', label: 'Customer Invoice No', render: (row) => row.customerInvoiceNo || '—' },
    {
      key: 'customerTotalAmount', label: 'Total Amount',
      render: (row) => row.customerTotalAmount != null ? money(row.customerTotalAmount) : '—',
    },
    {
      key: 'status', label: 'Status',
      render: (row) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.status === 'FINAL' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {row.status === 'FINAL' ? 'Final' : 'Draft'}
        </span>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      render: (row) => (
        <ActionMenu triggerTestId={`billing-row-actions-${row.id}`} items={[
          { label: 'View', icon: RiEyeLine, onClick: () => openEdit(row, true), testId: `billing-row-view-${row.id}` },
          {
            label: isLocked(row) ? (admin ? 'Enable Edit' : 'Locked') : 'Edit',
            icon: RiEditLine,
            hidden: isLocked(row) && !admin,
            onClick: () => openEdit(row, false),
            testId: `billing-row-edit-${row.id}`,
          },
        ]} />
      ),
    },
  ];

  const SEL = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <div>
      {(loading || spinning) && <Spinner fullScreen />}

      <ConfirmDialog
        testId="billing-submit-confirm"
        open={confirmSubmit}
        title="Save Billing Details"
        message="Once saved (not draft), this record can't be edited again except by an admin, and the shipment will be marked Completed. Continue?"
        confirmLabel="Save"
        onConfirm={() => { setConfirmSubmit(false); doSave(true); }}
        onCancel={() => setConfirmSubmit(false)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Details</h1>
          <p className="text-sm text-gray-500 mt-0.5">{all.length} record(s)</p>
        </div>
        <button data-testid="billing-add-button" onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          <RiAddLine className="w-4 h-4" /> New Billing Details
        </button>
      </div>

      <div className="relative mb-5 max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input type="text" value={search} data-testid="billing-search-input"
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by shipment no, invoice number or customer invoice no…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent" />
      </div>

      <DataTable testId="billing-table" columns={cols} data={paged} totalElements={all.length} page={page}
        pageSize={pageSize} sortColumn="" sortMode="" loading={loading}
        onPageChange={p => setPage(p)} onSort={() => {}}
        onPageSizeChange={n => { setPageSize(n); setPage(0); }} />

      <Modal testId="billing-modal" open={showModal} onClose={() => setShowModal(false)}
        title={form.id ? `${viewOnly ? 'View' : 'Edit'} Billing Details — ${form.shipmentNo}` : 'New Billing Details'} size="lg">
        {formLocked && !viewOnly && (
          <div className="px-3 py-2 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm flex items-center justify-between">
            <span>This billing record has already been finalized and is locked.</span>
            {admin && (
              <button data-testid="billing-enable-edit-button" onClick={() => setUnlocked(true)} className="font-semibold underline shrink-0 ml-3">Enable Edit</button>
            )}
          </div>
        )}

        {!form.id && (
          <div className="mb-4 relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Shipment</label>
            <input type="text" placeholder="Search shipment no…" value={shipmentSearch}
              data-testid="billing-modal-shipment-search-input"
              autoComplete="off"
              onChange={e => {
                setShipmentSearch(e.target.value);
                setForm(p => ({ ...p, orginId: undefined }));
                setShipmentDropdownOpen(true);
              }}
              onFocus={() => { if (!form.orginId) setShipmentDropdownOpen(true); }}
              // Delayed so a click on a result below still registers before the list unmounts.
              onBlur={() => setTimeout(() => setShipmentDropdownOpen(false), 150)}
              className={SEL} />
            {shipmentDropdownOpen && !form.orginId && (
              <ul data-testid="billing-modal-shipment-results"
                className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                {shipments.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-400">No matching Received shipments.</li>
                ) : shipments.map(s => (
                  <li key={s.id}>
                    <button type="button" data-testid={`billing-modal-shipment-option-${s.id}`}
                      onClick={() => {
                        setForm(p => ({ ...p, orginId: s.id }));
                        setShipmentSearch(`${s.shipment_no} — ${s.customer} (${s.vehicle_no})`);
                        setShipmentDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                      {s.shipment_no} — {s.customer} ({s.vehicle_no})
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400 mt-1">Only Received shipments without existing billing details are shown.</p>
          </div>
        )}

        <div className="border border-slate-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Transporter Billing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GRN Number <span className="text-red-500">*</span></label>
              <input data-testid="billing-modal-grn-input" disabled={formLocked} className={SEL}
                value={form.grnNumber ?? ''} onChange={e => setForm(p => ({ ...p, grnNumber: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">POD Status <span className="text-red-500">*</span></label>
              <select data-testid="billing-modal-pod-select" disabled={formLocked} className={SEL}
                value={form.podStatus ?? ''} onChange={e => setForm(p => ({ ...p, podStatus: e.target.value as 'Y' | 'N' }))}>
                <option value="">Select…</option>
                <option value="Y">Yes</option>
                <option value="N">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number <span className="text-red-500">*</span></label>
              <input data-testid="billing-modal-invoice-number-input" disabled={formLocked} className={SEL}
                value={form.invoiceNumber ?? ''} onChange={e => setForm(p => ({ ...p, invoiceNumber: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date <span className="text-red-500">*</span></label>
              <input type="date" data-testid="billing-modal-invoice-date-input" disabled={formLocked} className={SEL}
                value={form.invoiceDate ?? ''} onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Base Fare <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" data-testid="billing-modal-base-fare-input" disabled={formLocked} className={SEL}
                value={form.baseFare ?? ''} onChange={e => setForm(p => ({ ...p, baseFare: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Halting Charges <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" data-testid="billing-modal-halting-charges-input" disabled={formLocked} className={SEL}
                value={form.haltingCharges ?? ''} onChange={e => setForm(p => ({ ...p, haltingCharges: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Billing Amount</label>
              <input data-testid="billing-modal-total-billing-amount" disabled className={SEL + ' font-semibold'}
                value={total(form.baseFare, form.haltingCharges)} readOnly />
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Customer Billing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Invoice No <span className="text-red-500">*</span></label>
              <input data-testid="billing-modal-customer-invoice-no-input" disabled={formLocked} className={SEL}
                value={form.customerInvoiceNo ?? ''} onChange={e => setForm(p => ({ ...p, customerInvoiceNo: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Invoice Date <span className="text-red-500">*</span></label>
              <input type="date" data-testid="billing-modal-customer-invoice-date-input" disabled={formLocked} className={SEL}
                value={form.customerInvoiceDate ?? ''} onChange={e => setForm(p => ({ ...p, customerInvoiceDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Base Fare <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" data-testid="billing-modal-customer-base-fare-input" disabled={formLocked} className={SEL}
                value={form.customerBaseFare ?? ''} onChange={e => setForm(p => ({ ...p, customerBaseFare: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Halting Charges <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" data-testid="billing-modal-customer-halting-charges-input" disabled={formLocked} className={SEL}
                value={form.customerHaltingCharges ?? ''} onChange={e => setForm(p => ({ ...p, customerHaltingCharges: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount</label>
              <input data-testid="billing-modal-total-amount" disabled className={SEL + ' font-semibold'}
                value={total(form.customerBaseFare, form.customerHaltingCharges)} readOnly />
            </div>
          </div>
        </div>

        {!viewOnly && (
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
            <button data-testid="billing-modal-draft-button" onClick={() => doSave(false)} disabled={formLocked}
              className="px-4 py-2 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed">Save as Draft</button>
            <button data-testid="billing-modal-save-button" onClick={() => setConfirmSubmit(true)} disabled={formLocked}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Save</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
