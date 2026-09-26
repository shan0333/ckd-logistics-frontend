'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  createOrgin, getOrginCustomer, getVehicletype, getLocationList, dupCheck, getTransporterMasterList,
} from '@/lib/api';
import { Orgin, GenericData, Location, Transporter } from '@/lib/types';
import Spinner from '@/components/ui/Spinner';
import DocumentUpload from '@/components/ui/DocumentUpload';
import BarcodeScanModal from '@/components/ui/BarcodeScanModal';
import { tagDocs } from '@/lib/shipmentDocs';
import { RiArrowLeftLine, RiQrScan2Line, RiCheckLine } from 'react-icons/ri';
import { getLocId } from '@/lib/auth';

const EMPTY_ORG: Orgin = {
  shipment_no: '', vehicle_no: '', lr_no: '', lr_date: '',
  transporter_name: '', transit_days: '', fast_mode: 'N',
  odc: 'N', odc_lot: '', odc_scan_code: '',
  customer_id: '', shipment_route_from_id: '', shipment_route_to_id: '',
  vehicle_type: '', flag: 'O',
};

const LOTS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

const SEL = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function NewShipmentPage() {
  const router = useRouter();
  const locId = getLocId();

  const [spinning, setSpinning] = useState(false);
  const [org, setOrg] = useState<Orgin>({ ...EMPTY_ORG });
  const [odcFiles, setOdcFiles] = useState<File[]>([]);
  const [lrFiles, setLrFiles] = useState<File[]>([]);
  const [dupWarning, setDupWarning] = useState(false);
  const [customers, setCustomers] = useState<GenericData[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<GenericData[]>([]);
  const [routeFrom, setRouteFrom] = useState<Location[]>([]);
  const [routeTo, setRouteTo] = useState<Location[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [cu, vt, tm] = await Promise.all([
        getOrginCustomer(), getVehicletype(), getTransporterMasterList({ offset: 0, limit: 500, search: '' }),
      ]);
      // A category with no rows yet gets back a 204 with an empty-string body, not null/undefined
      // — plain `?? []` doesn't catch that, so guard on Array.isArray instead.
      setCustomers(Array.isArray(cu.data) ? cu.data : []);
      setVehicleTypes(Array.isArray(vt.data) ? vt.data : []);
      setTransporters(tm.data?.data ?? []);
    })();

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

  const checkDup = async () => {
    if (!org.shipment_no?.trim()) { setDupWarning(false); return; }
    try {
      const res = await dupCheck(org.shipment_no.trim());
      setDupWarning(res.data?.message === 'true');
    } catch { /* best-effort — don't block on a failed check */ }
  };

  // Inward ODC = Yes gates a sequential flow: pick a Lot -> scan its barcode/QR -> upload a
  // document. Each step only appears once the one before it is satisfied, and changing an earlier
  // step clears everything downstream so a stale scan/doc can't get attached to a different lot.
  const lotPicked = !!org.odc_lot;
  const scanDone = !!org.odc_scan_code?.trim();

  const save = async () => {
    if (!org.customer_id) { toast.error('Customer is required'); return; }
    if (!org.shipment_route_from_id) { toast.error('Route From is required'); return; }
    if (!org.shipment_route_to_id) { toast.error('Route To is required'); return; }
    if (!org.shipment_no?.trim()) { toast.error('Shipment No is required'); return; }
    if (!org.vehicle_no?.trim()) { toast.error('Vehicle No is required'); return; }
    if (!org.lr_date) { toast.error('LR Date is required'); return; }
    if (!org.transporter_name?.trim()) { toast.error('Transporter is required'); return; }
    const selectedTransporter = transporters.find((t) => t.name === org.transporter_name);
    if (!selectedTransporter?.id) { toast.error('Please pick a transporter from the list'); return; }
    if (dupWarning) { toast.error('This Shipment No already exists'); return; }
    if (org.odc === 'Y') {
      if (!lotPicked) { toast.error('Please pick a Lot'); return; }
      if (!scanDone) { toast.error('Please scan the barcode/QR code for this lot'); return; }
      if (odcFiles.length === 0) { toast.error('Please upload the ODC document'); return; }
    }
    setSpinning(true);
    try {
      const payload: Orgin = { ...org, isfastflag: org.fast_mode === 'Y', transporter_master_id: selectedTransporter.id };
      const formData = new FormData();
      formData.append('org', JSON.stringify(payload));
      const docs = [...(org.odc === 'Y' ? tagDocs(odcFiles, 'ODC') : []), ...tagDocs(lrFiles, 'LR')];
      docs.forEach((f) => formData.append('files', f));
      const res = await createOrgin(formData);
      // The backend returns HTTP 200 even on a failed insert, putting the DB/exception text in
      // `message` (data stays null on success too, so it's not a usable signal). Only
      // CREATE_MESSAGE/UPDATE_MESSAGE ("… Successfully!") mean it actually saved.
      const msg: string = res?.data?.message ?? '';
      if (!/success/i.test(msg)) {
        toast.error(msg || 'Save failed');
        return;
      }
      toast.success('Shipment saved');
      router.push('/orgin');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div>
      {spinning && <Spinner fullScreen />}

      <BarcodeScanModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onScan={(code) => {
          setOrg((p) => ({ ...p, odc_scan_code: code }));
          setScanModalOpen(false);
          toast.success('Code scanned');
        }}
      />

      <div className="flex items-center gap-3 mb-6">
        <Link href="/orgin" data-testid="new-shipment-back-link" className="text-slate-400 hover:text-slate-700">
          <RiArrowLeftLine className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Shipment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create a new outbound shipment</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 max-w-4xl">
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
            <select data-testid="orgin-modal-transporter-select" className={SEL} value={org.transporter_name ?? ''}
              onChange={e => setOrg(p => ({ ...p, transporter_name: e.target.value }))}>
              <option value="">Select transporter</option>
              {transporters.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Inward ODC</label>
            <select data-testid="orgin-modal-odc-select" className={SEL} value={org.odc}
              onChange={e => {
                const odc = e.target.value as 'Y' | 'N';
                // Toggling off clears every downstream step so nothing stale can resurface (or
                // be silently uploaded) if Inward ODC is turned back on.
                setOrg(p => ({ ...p, odc, odc_lot: '', odc_scan_code: '' }));
                if (odc === 'N') setOdcFiles([]);
              }}>
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </select>
          </div>

          {org.odc === 'Y' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lot</label>
              <select data-testid="orgin-modal-odc-lot-select" className={SEL} value={org.odc_lot ?? ''}
                onChange={e => setOrg(p => ({ ...p, odc_lot: e.target.value, odc_scan_code: '' }))}>
                <option value="">Select lot</option>
                {LOTS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          {org.odc === 'Y' && lotPicked && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Scan Barcode / QR Code — Lot {org.odc_lot}</label>
              <div className="flex gap-2">
                <input data-testid="orgin-modal-odc-scan-input" className={SEL} placeholder="Scan with a handheld scanner, or type the code…"
                  autoFocus value={org.odc_scan_code ?? ''}
                  onChange={e => setOrg(p => ({ ...p, odc_scan_code: e.target.value }))} />
                <button type="button" data-testid="orgin-modal-odc-scan-camera-button" onClick={() => setScanModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 shrink-0">
                  <RiQrScan2Line className="w-4 h-4" /> Scan with Camera
                </button>
              </div>
              {scanDone && (
                <p data-testid="orgin-modal-odc-scan-done" className="text-xs text-green-700 mt-1 flex items-center gap-1">
                  <RiCheckLine className="w-4 h-4" /> Scanned: {org.odc_scan_code}
                </p>
              )}
            </div>
          )}

          {org.odc === 'Y' && scanDone && (
            <div className="sm:col-span-2">
              <DocumentUpload testId="orgin-modal-odc-doc" label="ODC Document" files={odcFiles} onChange={setOdcFiles} />
            </div>
          )}

          <div className="sm:col-span-2">
            <DocumentUpload testId="orgin-modal-lr-doc" label="LR Document (optional)" files={lrFiles} onChange={setLrFiles} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Link href="/orgin" className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</Link>
          <button data-testid="orgin-modal-save-button" onClick={save}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Save Shipment</button>
        </div>
      </div>
    </div>
  );
}
