'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  createOrgin, getOrginCustomer, getVehicletype, getLocationList, dupCheck, getTransporterMasterList,
  deleteOrginImage,
} from '@/lib/api';
import { Orgin, GenericData, Location, Transporter, OdcLot, OrginImage, AssetMapping } from '@/lib/types';
import Spinner from '@/components/ui/Spinner';
import DocumentUpload from '@/components/ui/DocumentUpload';
import BarcodeScanModal from '@/components/ui/BarcodeScanModal';
import AssetScanValues from '@/components/ui/AssetScanValues';
import ShipmentImageGrid from '@/components/ui/ShipmentImageGrid';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SectionCard, FieldLabel } from '@/components/ui/SectionCard';
import { tagDocs, tagDocsForLot, tagDocsForExistingLot } from '@/lib/shipmentDocs';
import {
  RiArrowLeftLine, RiQrScan2Line, RiCheckLine, RiCloseLine, RiAddLine,
  RiTruckLine, RiTimeLine, RiImage2Line, RiBox3Line, RiFileAddLine, RiEditLine,
  RiBarcodeBoxLine, RiArrowGoBackLine,
} from 'react-icons/ri';
import { getLocId } from '@/lib/auth';

const EMPTY_ORG: Orgin = {
  shipment_no: '', vehicle_no: '', lr_no: '', lr_date: '',
  transporter_name: '', transit_days: '', fast_mode: 'N',
  odc: 'N',
  customer_id: '', shipment_route_from_id: '', shipment_route_to_id: '',
  vehicle_type: '', flag: 'O',
};

const LOTS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

const SEL = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors';

interface CabinRow {
  lot: string;
  scanCode: string;
  hasOdc: boolean;
  files: File[];
}

const EMPTY_CABIN_ROW: CabinRow = { lot: '', scanCode: '', hasOdc: false, files: [] };

interface Props {
  mode: 'create' | 'edit';
  /** Required for edit — the existing shipment's current data. */
  initial?: Orgin;
  /** Required for edit — Inward ODC lot scans already saved for this shipment. A shipment with
   * at least one already doesn't need a NEW one added just to save other field changes. */
  existingOdcLots?: OdcLot[];
  /** Required for edit — every document already uploaded for this shipment (LR + per-lot ODC),
   * so existing lots can show/add/remove theirs. */
  existingImages?: OrginImage[];
  /** Required for edit — assets already mapped to this shipment. They can be removed here; the
   * removal only takes effect on Save (sent as removed_asset_ids), so Cancel discards it. */
  existingAssets?: AssetMapping[];
  /** Where "Cancel"/the back link and (for edit) a successful save should return to. */
  returnTo: string;
}

// Shared by New Shipment (create) and Shipments -> View -> Edit (edit, only offered while
// curr_status='TRANSIT' — see the backend's org_status='O' guard on UPDATE_ORGIN_DETAILS).
export default function ShipmentForm({ mode, initial, existingOdcLots, existingImages, existingAssets, returnTo }: Props) {
  const router = useRouter();
  const locId = getLocId();

  const [spinning, setSpinning] = useState(false);
  // vehicle_type is overloaded — reads back as the display name, but the <select> below (and the
  // write path) needs the generic_data id, which the API returns separately as vehicle_id. Every
  // other *_id field (customer_id, shipment_route_from_id, etc.) is already the write shape.
  const [org, setOrg] = useState<Orgin>({
    ...EMPTY_ORG, ...initial,
    // flag has no backing DB column (it only ever carries meaning within a single request — "O"
    // for this Origin-side form, "D" for Receiving's separate one), so a fetched `initial` always
    // comes back with flag: null and would otherwise silently override EMPTY_ORG's 'O' default via
    // the spread above, sending flag: null to the backend and breaking any file upload that
    // request includes (getObject's category-by-flag check). This form is only ever used for the
    // Origin side, so it's always 'O', regardless of what `initial` contains.
    flag: 'O',
    ...(initial ? { vehicle_type: initial.vehicle_id ?? initial.vehicle_type ?? '' } : {}),
  });
  const [lrFiles, setLrFiles] = useState<File[]>([]);
  const [dupWarning, setDupWarning] = useState(false);
  const [customers, setCustomers] = useState<GenericData[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<GenericData[]>([]);
  const [routeFrom, setRouteFrom] = useState<Location[]>([]);
  const [routeTo, setRouteTo] = useState<Location[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  // The Cabin section always shows and has no minimum — the user can add any number of Cabin
  // scans, and the same Cabin value can be added more than once (e.g. two separate boxes both
  // labelled L4). Every row stays fully editable for as long as the form is open (Cabin, Scan
  // code, ODC, document can all still be changed after "Add Cabin" — nothing collapses into a
  // read-only summary), so the user can come back and adjust an earlier cabin at any time.
  const [cabinRows, setCabinRows] = useState<CabinRow[]>([{ ...EMPTY_CABIN_ROW }]);
  // The one camera scanner modal serves both sections: a Cabin row's scan field, or "Scan Asset".
  const [scanTarget, setScanTarget] = useState<{ kind: 'cabin'; index: number } | { kind: 'asset' } | null>(null);

  // Asset Mapping — newAssetCodes are scans added in this session (not saved yet); in edit mode,
  // already-saved assets the user removes go into removedAssetIds and are only deleted on Save.
  const [newAssetCodes, setNewAssetCodes] = useState<string[]>([]);
  const [removedAssetIds, setRemovedAssetIds] = useState<number[]>([]);
  const [assetInput, setAssetInput] = useState('');
  const keptAssets = (existingAssets ?? []).filter((a) => a.id == null || !removedAssetIds.includes(a.id));
  const assetCount = keptAssets.length + newAssetCodes.length;

  // Already-saved lots (edit mode) — their Lot/Scan Code are fixed (recorded at scan time), but
  // the documents attached to them can still be added to or removed, right from this form.
  const [images, setImages] = useState<OrginImage[]>(existingImages ?? []);
  const [newFilesByLotId, setNewFilesByLotId] = useState<Record<number, File[]>>({});
  const [imageToRemove, setImageToRemove] = useState<OrginImage | null>(null);
  const [removingImage, setRemovingImage] = useState(false);

  const lastCabinRow = cabinRows[cabinRows.length - 1];
  // Gate "Add Cabin" on the last row being usable (Cabin picked, Scan done, and its ODC document
  // uploaded if ODC is checked), so blank rows don't pile up — but this never locks earlier rows;
  // every row above stays editable regardless of this row's state.
  const canAddAnotherCabinRow = !lastCabinRow
    || (!!lastCabinRow.lot && !!lastCabinRow.scanCode.trim() && (!lastCabinRow.hasOdc || lastCabinRow.files.length > 0));

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
    if (mode === 'edit') return; // Shipment No is fixed once created — never re-checked.
    if (!org.shipment_no?.trim()) { setDupWarning(false); return; }
    try {
      const res = await dupCheck(org.shipment_no.trim());
      setDupWarning(res.data?.message === 'true');
    } catch { /* best-effort — don't block on a failed check */ }
  };

  const updateCabinRow = (index: number, patch: Partial<CabinRow>) => {
    setCabinRows((p) => p.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addCabinRow = () => {
    if (!canAddAnotherCabinRow) return;
    setCabinRows((p) => [...p, { ...EMPTY_CABIN_ROW }]);
  };

  const removeCabinRow = (index: number) => {
    setCabinRows((p) => p.filter((_, i) => i !== index));
  };

  // Returns whether the code was added — the same asset can't be mapped twice to one shipment
  // (checked against saved assets that are still kept, and this session's new scans).
  const addAssetCode = (raw: string): boolean => {
    const code = raw.trim();
    if (!code) return false;
    if (keptAssets.some((a) => a.scanCode?.trim() === code) || newAssetCodes.includes(code)) {
      toast.error('This asset is already mapped to the shipment');
      return false;
    }
    setNewAssetCodes((p) => [...p, code]);
    return true;
  };

  const addAssetFromInput = () => {
    if (addAssetCode(assetInput)) setAssetInput('');
  };

  const confirmRemoveImage = async () => {
    const img = imageToRemove;
    if (!img?.id) return;
    setRemovingImage(true);
    try {
      await deleteOrginImage(img.id);
      setImages((p) => p.filter((i) => i.id !== img.id));
      toast.success('Document removed');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to remove document');
    } finally {
      setRemovingImage(false);
      setImageToRemove(null);
    }
  };

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
    if (mode === 'create' && dupWarning) { toast.error('This Shipment No already exists'); return; }
    // LR Document is mandatory at creation only — not re-enforced on edit, since shipments
    // created before this rule existed have no LR doc on file and would otherwise become
    // permanently uneditable.
    if (mode === 'create' && lrFiles.length === 0) {
      toast.error('LR Document is required');
      return;
    }
    // A row only counts once a Cabin has actually been picked — an untouched blank row (e.g. the
    // one always left at the bottom for adding another) is just a placeholder, not a real entry.
    const cabinsToSave = cabinRows.filter((r) => r.lot);
    for (const r of cabinsToSave) {
      if (!r.scanCode.trim()) { toast.error(`Scan a code for Cabin ${r.lot} before saving`); return; }
      if (r.hasOdc && r.files.length === 0) { toast.error(`Upload an ODC document for Cabin ${r.lot} before saving`); return; }
    }
    setSpinning(true);
    try {
      const payload: Orgin = {
        ...org, isfastflag: org.fast_mode === 'Y', transporter_master_id: selectedTransporter.id,
        odc_lots: cabinsToSave.map((r) => ({ lot: r.lot, scanCode: r.scanCode, hasOdc: r.hasOdc ? 'Y' : 'N' })),
        asset_mappings: newAssetCodes.map((scanCode) => ({ scanCode })),
        ...(mode === 'edit' ? { id: initial?.id, removed_asset_ids: removedAssetIds } : {}),
      };
      const formData = new FormData();
      formData.append('org', JSON.stringify(payload));
      const docs = [
        ...cabinsToSave.flatMap((r, i) => tagDocsForLot(r.files, i + 1)),
        ...Object.entries(newFilesByLotId).flatMap(([lotId, files]) => tagDocsForExistingLot(files, Number(lotId))),
        ...tagDocs(lrFiles, 'LR'),
      ];
      docs.forEach((f) => formData.append('files', f));
      const res = await createOrgin(formData);
      // The backend returns HTTP 200 even on a failed insert/update, putting the DB/exception
      // text in `message` (data stays null on success too, so it's not a usable signal). Only
      // CREATE_MESSAGE/UPDATE_MESSAGE ("… Successfully!") mean it actually saved.
      const msg: string = res?.data?.message ?? '';
      if (!/success/i.test(msg)) {
        toast.error(msg || 'Save failed');
        return;
      }
      toast.success(mode === 'create' ? 'Shipment saved' : 'Shipment updated');
      router.push(returnTo);
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
          setScanModalOpen(false);
          if (scanTarget?.kind === 'cabin') {
            updateCabinRow(scanTarget.index, { scanCode: code });
            toast.success('Code scanned');
          } else if (scanTarget?.kind === 'asset') {
            if (addAssetCode(code)) toast.success('Asset scanned');
          }
        }}
      />

      <ConfirmDialog
        open={!!imageToRemove}
        title="Remove Document"
        message="Remove this document from the shipment? This can't be undone."
        confirmLabel={removingImage ? 'Removing…' : 'Remove'}
        onConfirm={confirmRemoveImage}
        onCancel={() => setImageToRemove(null)}
        testId="orgin-modal-remove-image-confirm"
      />

      <div className="flex items-center gap-3 mb-6">
        <Link href={returnTo} data-testid="shipment-form-back-link" className="text-slate-400 hover:text-slate-700">
          <RiArrowLeftLine className="w-5 h-5" />
        </Link>
        <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50">
          {mode === 'create'
            ? <RiFileAddLine className="w-5 h-5 text-blue-600" />
            : <RiEditLine className="w-5 h-5 text-blue-600" />}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mode === 'create' ? 'New Shipment' : `Edit ${org.shipment_no}`}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{mode === 'create' ? 'Create a new outbound shipment' : 'Editable while still in transit'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
        <SectionCard title="Shipment & Route" icon={RiTruckLine} accent="blue">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Customer</FieldLabel>
              <select data-testid="orgin-modal-customer-select" className={SEL} value={org.customer_id} onChange={e => setOrg(p => ({ ...p, customer_id: e.target.value }))}>
                <option value="">Select customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.data}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Vehicle Type</FieldLabel>
              <select data-testid="orgin-modal-vehicletype-select" className={SEL} value={org.vehicle_type} onChange={e => setOrg(p => ({ ...p, vehicle_type: e.target.value }))}>
                <option value="">Select type</option>
                {vehicleTypes.map((v) => <option key={v.id} value={v.id}>{v.data}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Route From</FieldLabel>
              <select data-testid="orgin-modal-route-from-select" className={SEL} value={org.shipment_route_from_id} onChange={e => setOrg(p => ({ ...p, shipment_route_from_id: e.target.value }))}>
                <option value="">Select origin</option>
                {routeFrom.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Route To</FieldLabel>
              <select data-testid="orgin-modal-route-to-select" className={SEL} value={org.shipment_route_to_id} onChange={e => setOrg(p => ({ ...p, shipment_route_to_id: e.target.value }))}>
                <option value="">Select destination</option>
                {routeTo.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Shipment No</FieldLabel>
              {mode === 'edit' ? (
                <input data-testid="orgin-modal-shipment-no-input" disabled className={SEL} value={org.shipment_no ?? ''} />
              ) : (
                <>
                  <input data-testid="orgin-modal-shipment-no-input" className={SEL + (dupWarning ? ' border-red-400' : '')} value={org.shipment_no ?? ''}
                    onBlur={checkDup}
                    onChange={e => { setOrg(p => ({ ...p, shipment_no: e.target.value })); setDupWarning(false); }} />
                  {dupWarning && <p data-testid="orgin-modal-shipment-no-dupwarning" className="text-xs text-red-600 mt-1">This Shipment No already exists.</p>}
                </>
              )}
            </div>
            <div>
              <FieldLabel>Vehicle No</FieldLabel>
              <input data-testid="orgin-modal-vehicle-no-input" className={SEL} value={org.vehicle_no ?? ''}
                onChange={e => setOrg(p => ({ ...p, vehicle_no: e.target.value }))} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Transport & Schedule" icon={RiTimeLine} accent="purple">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>LR No</FieldLabel>
              <input data-testid="orgin-modal-lr-no-input" className={SEL} value={org.lr_no ?? ''}
                onChange={e => setOrg(p => ({ ...p, lr_no: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Transporter</FieldLabel>
              <select data-testid="orgin-modal-transporter-select" className={SEL} value={org.transporter_name ?? ''}
                onChange={e => setOrg(p => ({ ...p, transporter_name: e.target.value }))}>
                <option value="">Select transporter</option>
                {transporters.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Transit Days</FieldLabel>
              <input data-testid="orgin-modal-transit-days-input" className={SEL} value={org.transit_days ?? ''}
                onChange={e => setOrg(p => ({ ...p, transit_days: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>LR Date</FieldLabel>
              <input type="date" data-testid="orgin-modal-lr-date-input" className={SEL} value={org.lr_date ?? ''}
                onChange={e => setOrg(p => ({ ...p, lr_date: e.target.value }))} />
            </div>
            <div>
              <FieldLabel>Fast Mode</FieldLabel>
              <select data-testid="orgin-modal-fastmode-select" className={SEL} value={org.fast_mode} onChange={e => setOrg(p => ({ ...p, fast_mode: e.target.value as 'Y' | 'N' }))}>
                <option value="N">No</option>
                <option value="Y">Yes</option>
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Documents" icon={RiImage2Line} accent="teal">
          <DocumentUpload testId="orgin-modal-lr-doc" label="LR Document *" files={lrFiles} onChange={setLrFiles} />
        </SectionCard>

        <SectionCard title="Cabin Details" icon={RiBox3Line} accent="orange" className="lg:col-span-2">
          <>
            {(existingOdcLots ?? []).length > 0 && (
              <ul data-testid="orgin-modal-existing-lots-list" className="mb-4 space-y-3">
                {existingOdcLots!.map((entry) => {
                  const docs = images.filter((img) => entry.id != null && img.odc_lot_id === entry.id);
                  const pendingFiles = entry.id != null ? (newFilesByLotId[entry.id] ?? []) : [];
                  return (
                    <li key={entry.id} data-testid={`orgin-modal-existing-lot-${entry.id}`}
                      className="px-3 py-2.5 bg-orange-50/40 border border-orange-100 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{entry.lot}</span>
                        <span className="text-green-700 font-semibold flex items-center gap-1">
                          <RiCheckLine className="w-4 h-4" /> Scanned: {entry.scanCode}
                        </span>
                        {entry.hasOdc === 'Y' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">ODC</span>
                        )}
                      </div>
                      {docs.length > 0 && (
                        <div className="mt-2">
                          <ShipmentImageGrid testId={`orgin-modal-existing-lot-${entry.id}-images`} images={docs}
                            onRemove={(img) => setImageToRemove(img)} />
                        </div>
                      )}
                      <div className="mt-2">
                        <DocumentUpload testId={`orgin-modal-existing-lot-${entry.id}-doc`} label="Add another document for this cabin"
                          files={pendingFiles}
                          onChange={(files) => entry.id != null && setNewFilesByLotId((p) => ({ ...p, [entry.id!]: files }))} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {(existingOdcLots ?? []).length > 0 && (
              <h4 className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-2">Add a New Cabin</h4>
            )}

            <div data-testid="orgin-modal-cabin-rows" className="space-y-3 mb-3">
              {cabinRows.map((row, i) => (
                <div key={i} data-testid={`orgin-modal-cabin-row-${i}`}
                  className="p-3 bg-orange-50/40 border border-orange-100 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-end gap-4 flex-1">
                      <div className="w-36">
                        <FieldLabel>Cabin</FieldLabel>
                        <select data-testid={`orgin-modal-cabin-row-${i}-lot-select`} className={SEL} value={row.lot}
                          onChange={e => updateCabinRow(i, { lot: e.target.value, scanCode: '', hasOdc: false, files: [] })}>
                          <option value="">Select cabin</option>
                          {LOTS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>

                      {!!row.lot && (
                        <div className="flex-1 min-w-[240px]">
                          <FieldLabel>Scan Barcode / QR Code</FieldLabel>
                          <div className="flex gap-2">
                            <input data-testid={`orgin-modal-cabin-row-${i}-scan-input`} className={SEL}
                              placeholder="Scan with a handheld scanner, or type the code…"
                              value={row.scanCode}
                              onChange={e => updateCabinRow(i, { scanCode: e.target.value })} />
                            <button type="button" data-testid={`orgin-modal-cabin-row-${i}-scan-camera-button`}
                              onClick={() => { setScanTarget({ kind: 'cabin', index: i }); setScanModalOpen(true); }}
                              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 shrink-0">
                              <RiQrScan2Line className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {!!row.lot && (
                        <div className="pb-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" data-testid={`orgin-modal-cabin-row-${i}-odc-checkbox`} checked={row.hasOdc}
                              onChange={e => updateCabinRow(i, { hasOdc: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
                            <span className="text-sm font-semibold text-slate-700">ODC</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <button type="button" data-testid={`orgin-modal-cabin-row-${i}-remove-button`} onClick={() => removeCabinRow(i)}
                      aria-label={`Remove Cabin row ${i + 1}`} className="text-slate-400 hover:text-red-600 shrink-0 mt-1">
                      <RiCloseLine className="w-4 h-4" />
                    </button>
                  </div>

                  {!!row.lot && !!row.scanCode.trim() && (
                    <p data-testid={`orgin-modal-cabin-row-${i}-scan-done`} className="text-xs text-green-700 mt-2 flex items-center gap-1">
                      <RiCheckLine className="w-4 h-4" /> Scanned: {row.scanCode}
                    </p>
                  )}

                  {!!row.lot && row.hasOdc && (
                    <div className="mt-3">
                      <DocumentUpload testId={`orgin-modal-cabin-row-${i}-doc`} label="ODC Document for this Cabin"
                        files={row.files} onChange={(files) => updateCabinRow(i, { files })} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div>
              <button type="button" data-testid="orgin-modal-add-lot-button" onClick={addCabinRow} disabled={!canAddAnotherCabinRow}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                <RiAddLine className="w-4 h-4" /> Add Cabin
              </button>
              {!canAddAnotherCabinRow && lastCabinRow && (
                <p className="text-xs text-slate-400 mt-1">
                  {!lastCabinRow.lot ? 'Pick a Cabin above to add another.'
                    : !lastCabinRow.scanCode.trim() ? 'Scan or enter a code for that cabin first.'
                    : 'Upload that cabin\'s ODC document first.'}
                </p>
              )}
            </div>
          </>
        </SectionCard>

        <SectionCard title={`Asset Mapping${assetCount > 0 ? ` (${assetCount})` : ''}`} icon={RiBarcodeBoxLine} accent="teal" className="lg:col-span-2">
          <div data-testid="orgin-modal-asset-section">
            {assetCount === 0 && removedAssetIds.length === 0 && (
              <p data-testid="orgin-modal-asset-empty-state" className="text-sm text-slate-400 mb-3">
                No assets mapped yet. Click Add Asset to scan an asset&apos;s barcode or QR code.
              </p>
            )}

            <ul data-testid="orgin-modal-asset-list" className="space-y-2 mb-3">
              {keptAssets.map((a, i) => (
                <li key={`saved-${a.id}`} data-testid={`orgin-modal-asset-saved-${a.id}`}
                  className="flex items-start gap-3 p-3 bg-teal-50/40 border border-teal-100 rounded-lg">
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <AssetScanValues code={a.scanCode} testId={`orgin-modal-asset-saved-${a.id}-values`} />
                  </div>
                  <button type="button" data-testid={`orgin-modal-asset-saved-${a.id}-remove-button`}
                    onClick={() => a.id != null && setRemovedAssetIds((p) => [...p, a.id!])}
                    aria-label={`Remove asset ${i + 1}`} className="text-slate-400 hover:text-red-600 shrink-0">
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {newAssetCodes.map((code, j) => (
                <li key={`new-${code}`} data-testid={`orgin-modal-asset-new-${j}`}
                  className="flex items-start gap-3 p-3 bg-teal-50/40 border border-teal-100 rounded-lg">
                  <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold shrink-0">#{keptAssets.length + j + 1}</span>
                  <div className="flex-1 min-w-0">
                    <AssetScanValues code={code} testId={`orgin-modal-asset-new-${j}-values`} />
                    {mode === 'edit' && <p className="text-[11px] text-teal-700 font-semibold mt-1">New — saved when you click Save Changes</p>}
                  </div>
                  <button type="button" data-testid={`orgin-modal-asset-new-${j}-remove-button`}
                    onClick={() => setNewAssetCodes((p) => p.filter((_, k) => k !== j))}
                    aria-label={`Remove asset ${keptAssets.length + j + 1}`} className="text-slate-400 hover:text-red-600 shrink-0">
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>

            {removedAssetIds.length > 0 && (
              <div data-testid="orgin-modal-asset-removed" className="mb-3 p-3 border border-dashed border-red-200 bg-red-50/40 rounded-lg">
                <p className="text-xs font-semibold text-red-700 mb-2">
                  {removedAssetIds.length} asset{removedAssetIds.length > 1 ? 's' : ''} will be removed when you save
                </p>
                <ul className="space-y-1">
                  {(existingAssets ?? []).filter((a) => a.id != null && removedAssetIds.includes(a.id)).map((a) => (
                    <li key={`removed-${a.id}`} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-slate-500 line-through break-all flex-1">{a.scanCode}</span>
                      <button type="button" data-testid={`orgin-modal-asset-removed-${a.id}-undo-button`}
                        onClick={() => setRemovedAssetIds((p) => p.filter((id) => id !== a.id))}
                        className="flex items-center gap-1 text-blue-600 font-semibold hover:underline shrink-0">
                        <RiArrowGoBackLine className="w-3.5 h-3.5" /> Undo
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" data-testid="orgin-modal-asset-scan-button"
                onClick={() => { setScanTarget({ kind: 'asset' }); setScanModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50">
                <RiQrScan2Line className="w-4 h-4" /> Add Asset
              </button>
              <span className="text-xs text-slate-400">or</span>
              <input data-testid="orgin-modal-asset-input" className={SEL + ' flex-1 min-w-[220px]'}
                placeholder="Use a handheld scanner, or type the code and press Enter…"
                value={assetInput}
                onChange={e => setAssetInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAssetFromInput(); } }} />
              <button type="button" data-testid="orgin-modal-asset-add-button" onClick={addAssetFromInput} disabled={!assetInput.trim()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <RiAddLine className="w-4 h-4" /> Add Code
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex justify-end gap-3 mt-6 max-w-5xl">
        <Link href={returnTo} className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50">Cancel</Link>
        <button data-testid="orgin-modal-save-button" onClick={save}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm">
          {mode === 'create' ? <RiFileAddLine className="w-4 h-4" /> : <RiCheckLine className="w-4 h-4" />}
          {mode === 'create' ? 'Save Shipment' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
