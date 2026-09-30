'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getOrginByShipmentNo, getOdcLotsByShipmentNo, getOrginImages } from '@/lib/api';
import { Orgin, OdcLot, OrginImage } from '@/lib/types';
import Spinner from '@/components/ui/Spinner';
import ShipmentForm from '../../ShipmentForm';
import { RiArrowLeftLine } from 'react-icons/ri';

export default function EditShipmentPage() {
  const params = useParams<{ shipmentNo: string }>();
  const shipmentNo = decodeURIComponent(params.shipmentNo);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<Orgin | null>(null);
  const [odcLots, setOdcLots] = useState<OdcLot[]>([]);
  const [images, setImages] = useState<OrginImage[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [orginRes, odcLotsRes, imagesRes] = await Promise.all([
          getOrginByShipmentNo(shipmentNo),
          getOdcLotsByShipmentNo(shipmentNo),
          getOrginImages(shipmentNo, 'ORGIN'),
        ]);
        setRow(orginRes.data?.data?.[0] ?? null);
        setOdcLots(odcLotsRes.data?.data ?? []);
        setImages(imagesRes.data?.data ?? []);
      } catch { toast.error('Failed to load shipment'); }
      finally { setLoading(false); }
    })();
  }, [shipmentNo]);

  if (loading) return <Spinner fullScreen />;

  // Editing is only offered while the shipment hasn't been received yet — matches the backend's
  // org_status='O' guard on UPDATE_ORGIN_DETAILS. A direct link after that point (or one opened
  // from a stale tab) lands here safely instead of silently no-opping on save.
  if (!row || row.curr_status !== 'TRANSIT') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/orgin/${encodeURIComponent(shipmentNo)}`} className="text-slate-400 hover:text-slate-700">
            <RiArrowLeftLine className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Edit {shipmentNo}</h1>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400 text-sm">
          {row ? 'This shipment can no longer be edited (already received).' : 'Shipment not found.'}
        </div>
      </div>
    );
  }

  return (
    <ShipmentForm mode="edit" initial={row} existingOdcLots={odcLots} existingImages={images}
      returnTo={`/orgin/${encodeURIComponent(shipmentNo)}`} />
  );
}
