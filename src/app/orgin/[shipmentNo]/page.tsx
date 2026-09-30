'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getOrginByShipmentNo, getOrginImages, getOdcLotsByShipmentNo } from '@/lib/api';
import { Orgin, OrginImage, OdcLot } from '@/lib/types';
import Spinner from '@/components/ui/Spinner';
import ShipmentImageGrid from '@/components/ui/ShipmentImageGrid';
import { SectionCard as Card } from '@/components/ui/SectionCard';
import { formatDateTime, formatDateOnly } from '@/lib/dateTime';
import {
  RiArrowLeftLine, RiCheckLine, RiEditLine, RiTruckLine, RiInboxArchiveLine,
  RiBox3Line, RiImage2Line, RiTimeLine, RiAlertLine, RiRocket2Line,
} from 'react-icons/ri';
import type { IconType } from 'react-icons';

// Prefer the live Transporter Master name (joined server-side by transporter_master_id) over the
// free-text snapshot — matches the Shipments list's own fallback logic.
const transporterDisplayName = (row: Orgin): string => row.transporter_master_name ?? row.transporter_name ?? '—';

const STATUS_STYLE: Record<string, { badge: string; icon: IconType }> = {
  'RECEIVED': { badge: 'bg-green-100 text-green-700 ring-1 ring-green-200', icon: RiCheckLine },
  'TRANSIT': { badge: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200', icon: RiTruckLine },
  'OVER DUE': { badge: 'bg-red-100 text-red-700 ring-1 ring-red-200', icon: RiAlertLine },
  'WORK IN-PROGRESS': { badge: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', icon: RiTimeLine },
  'NEW': { badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', icon: RiRocket2Line },
  'COMPLETED': { badge: 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200', icon: RiCheckLine },
};

function StatusBadge({ status }: { status?: string }) {
  const style = (status && STATUS_STYLE[status]) || { badge: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', icon: RiRocket2Line };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${style.badge}`}>
      <Icon className="w-3.5 h-3.5" /> {status ?? '—'}
    </span>
  );
}

const BADGE_COLOR = {
  green: 'bg-green-100 text-green-700',
  slate: 'bg-slate-100 text-slate-500',
  amber: 'bg-amber-100 text-amber-700',
};

function Field({ label, value, badge }: {
  label: string;
  value?: string | null;
  badge?: { text: string; color: keyof typeof BADGE_COLOR };
}) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      {badge ? (
        <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${BADGE_COLOR[badge.color]}`}>
          {badge.text}
        </span>
      ) : (
        <div className="text-slate-900 text-sm font-semibold mt-0.5">{value || '—'}</div>
      )}
    </div>
  );
}

export default function ShipmentViewPage() {
  const params = useParams<{ shipmentNo: string }>();
  const shipmentNo = decodeURIComponent(params.shipmentNo);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Orgin | null>(null);
  const [images, setImages] = useState<OrginImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [odcLots, setOdcLots] = useState<OdcLot[]>([]);
  const [loadingOdcLots, setLoadingOdcLots] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getOrginByShipmentNo(shipmentNo);
        const list: Orgin[] = res.data?.data ?? [];
        setRow(list[0] ?? null);
      } catch { toast.error('Failed to load shipment'); }
      finally { setLoading(false); }
    })();

    (async () => {
      setLoadingImages(true);
      try {
        const res = await getOrginImages(shipmentNo, 'ORGIN');
        setImages(res.data?.data ?? []);
      } catch { toast.error('Failed to load images'); }
      finally { setLoadingImages(false); }
    })();

    (async () => {
      setLoadingOdcLots(true);
      try {
        const res = await getOdcLotsByShipmentNo(shipmentNo);
        setOdcLots(res.data?.data ?? []);
      } catch { toast.error('Failed to load Inward ODC lots'); }
      finally { setLoadingOdcLots(false); }
    })();
  }, [shipmentNo]);

  // Group scans by lot value so repeats (same lot scanned more than once) show together under one
  // heading instead of as separate flat rows.
  const lotGroups: { lot: string; entries: OdcLot[] }[] = [];
  for (const entry of odcLots) {
    const lot = entry.lot ?? '—';
    const group = lotGroups.find((g) => g.lot === lot);
    if (group) group.entries.push(entry);
    else lotGroups.push({ lot, entries: [entry] });
  }
  // Docs already shown grouped under a lot above shouldn't also appear in the general grid below.
  const otherImages = images.filter((img) => img.odc_lot_id == null);

  return (
    <div>
      {loading && <Spinner fullScreen />}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/orgin" data-testid="orgin-view-back-link" className="text-slate-400 hover:text-slate-700">
            <RiArrowLeftLine className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{shipmentNo}</h1>
            {row && <StatusBadge status={row.curr_status} />}
          </div>
        </div>
        {row?.curr_status === 'TRANSIT' && (
          <Link href={`/orgin/${encodeURIComponent(shipmentNo)}/edit`} data-testid="orgin-view-edit-link"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm">
            <RiEditLine className="w-4 h-4" /> Edit
          </Link>
        )}
      </div>

      {!loading && !row && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 text-sm">
          Shipment not found.
        </div>
      )}

      {row && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
          <Card title="Shipment Details" icon={RiTruckLine} accent="blue">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field label="Customer" value={row.customer} />
              <Field label="Vehicle Type" value={row.vehicle_type} />
              <Field label="Route From" value={row.shipment_route_from} />
              <Field label="Route To" value={row.shipment_route_to} />
              <Field label="Vehicle No" value={row.vehicle_no} />
              <Field label="LR No" value={row.lr_no} />
              <Field label="LR Date" value={formatDateOnly(row.lr_date)} />
              <Field label="Transit Days" value={row.transit_days} />
              <Field label="Transporter" value={transporterDisplayName(row)} />
              <Field label="Fast Mode"
                badge={row.fast_mode === 'Y'
                  ? { text: 'Yes', color: 'green' }
                  : { text: 'No', color: 'slate' }} />
            </div>
          </Card>

          <Card title="Receiving" icon={RiInboxArchiveLine} accent="purple">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div className="col-span-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Vehicle Reported On</div>
                {row.vehicle_reported_on ? (
                  <p className="text-sm font-semibold text-green-700 flex items-center gap-1 mt-0.5">
                    <RiCheckLine className="w-4 h-4" /> {formatDateTime(row.vehicle_reported_on)}
                  </p>
                ) : (
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    Pending
                  </span>
                )}
              </div>
              <Field label="Created By" value={row.created_By} />
              <Field label="Updated By" value={row.updated_By} />
            </div>
          </Card>

          {row.odc === 'Y' && (
            <Card title="Inward ODC" icon={RiBox3Line} accent="orange">
              {loadingOdcLots ? (
                <div className="py-6 text-center text-slate-400 text-sm">Loading…</div>
              ) : lotGroups.length === 0 ? (
                <div data-testid="orgin-view-odc-lots-empty-state" className="py-6 text-center text-slate-400 text-sm">No lot scans recorded.</div>
              ) : (
                <div data-testid="orgin-view-odc-lot-groups" className="space-y-4">
                  {lotGroups.map((group) => (
                    <div key={group.lot} data-testid={`orgin-view-odc-lot-group-${group.lot}`} className="border border-orange-100 bg-orange-50/40 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{group.lot}</span>
                        {group.entries.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold">{group.entries.length} scans</span>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {group.entries.map((entry) => {
                          const docs = images.filter((img) => entry.id != null && img.odc_lot_id === entry.id);
                          return (
                            <li key={entry.id} className="text-sm">
                              <p className="text-green-700 font-semibold flex items-center gap-1">
                                <RiCheckLine className="w-4 h-4" /> Scanned: {entry.scanCode}
                              </p>
                              {docs.length > 0 && (
                                <div className="mt-2 ml-5">
                                  <ShipmentImageGrid testId={`orgin-view-odc-lot-${entry.id}-images`} images={docs} />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card title="Documents & Images" icon={RiImage2Line} accent="teal">
            {loadingImages ? (
              <div className="py-6 text-center text-slate-400 text-sm">Loading…</div>
            ) : otherImages.length === 0 ? (
              <div data-testid="orgin-view-images-empty-state" className="py-6 text-center text-slate-400 text-sm">No images uploaded for this shipment.</div>
            ) : (
              <ShipmentImageGrid testId="orgin-view-images-grid" images={otherImages} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
