'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getAssetReport } from '@/lib/api';
import type { AssetReportItem, AssetMappingEntry } from '@/lib/types';
import { formatDateTime } from '@/lib/dateTime';
import BarcodeScanModal from '@/components/ui/BarcodeScanModal';
import AssetScanValues from '@/components/ui/AssetScanValues';
import { FieldLabel } from '@/components/ui/SectionCard';
import ReportHeader from '@/components/reports/ReportHeader';
import { RiBarcodeBoxLine, RiQrScan2Line, RiSearchLine, RiArrowRightLine } from 'react-icons/ri';

const STATUS_STYLE: Record<AssetReportItem['status'], string> = {
  'IN TRANSIT': 'bg-blue-100 text-blue-700',
  'AT DESTINATION': 'bg-green-100 text-green-700',
  'NOT MAPPED': 'bg-slate-100 text-slate-600',
};

function ShipmentLink({ e }: { e: AssetMappingEntry }) {
  if (!e.shipmentNo) return <>—</>;
  return (
    <Link href={`/orgin/${encodeURIComponent(e.shipmentNo)}`} className="text-blue-600 font-semibold hover:underline">
      {e.shipmentNo}
    </Link>
  );
}

export default function AssetReportPage() {
  const [code, setCode] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState<string | null>(null);
  const [items, setItems] = useState<AssetReportItem[]>([]);

  const search = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) { toast.error('Scan or enter an asset code'); return; }
    setLoading(true);
    try {
      const res = await getAssetReport(q);
      setItems(Array.isArray(res.data?.data) ? res.data.data : []);
      setSearched(q);
    } catch {
      toast.error('Could not load the asset report');
    } finally {
      setLoading(false);
    }
  }, []);

  // Stable identity — BarcodeScanModal restarts the camera whenever onScan changes.
  const onScan = useCallback((scanned: string) => {
    setScanOpen(false);
    setCode(scanned);
    search(scanned);
  }, [search]);
  const onCloseScan = useCallback(() => setScanOpen(false), []);

  return (
    <div>
      <BarcodeScanModal open={scanOpen} onClose={onCloseScan} onScan={onScan} />

      <ReportHeader icon={RiBarcodeBoxLine} tone="teal" title="Asset Report"
        subtitle="Where an asset is now, and every shipment it has been mapped to." />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-4">
        <FieldLabel>Asset Code</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="report-asset-scan-button" onClick={() => setScanOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 text-sm font-semibold rounded-lg hover:bg-blue-50">
            <RiQrScan2Line className="w-4 h-4" /> Scan
          </button>
          <input data-testid="report-asset-code-input" value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(code); }}
            placeholder="Scan with a handheld scanner, or type the full or partial code…"
            className="flex-1 min-w-[240px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="button" data-testid="report-asset-search-button" onClick={() => search(code)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <RiSearchLine className="w-4 h-4" /> {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {searched != null && items.length === 0 && !loading && (
        <div data-testid="report-asset-empty" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-sm text-slate-400">
          No asset found matching &quot;{searched}&quot;.
        </div>
      )}

      <div data-testid="report-asset-results" className="space-y-4">
        {items.map((a, idx) => (
          <div key={a.scanCode} data-testid={`report-asset-item-${idx}`}
            className="bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 border-t-teal-500 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <FieldLabel>Asset</FieldLabel>
                <AssetScanValues code={a.scanCode} testId={`report-asset-item-${idx}-values`} />
              </div>
              <span data-testid={`report-asset-item-${idx}-status`} className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[a.status]}`}>
                {a.status}
              </span>
            </div>

            <div className="mb-4">
              <FieldLabel>Currently mapped to</FieldLabel>
              {a.current.length === 0 ? (
                <p className="text-sm text-slate-400">Not mapped to any shipment.</p>
              ) : (
                <ul className="space-y-1">
                  {a.current.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <ShipmentLink e={e} />
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">{e.shipmentStatus ?? '—'}</span>
                      <span className="text-slate-500 flex items-center gap-1">{e.routeFrom ?? '—'} <RiArrowRightLine className="w-3 h-3" /> {e.routeTo ?? '—'}</span>
                      <span className="text-slate-400">· mapped {formatDateTime(e.mappedDate)}{e.mappedBy ? ` by ${e.mappedBy}` : ''}</span>
                    </li>
                  ))}
                  {a.current.length > 1 && (
                    <li className="text-xs text-amber-700">This asset is mapped to more than one active shipment.</li>
                  )}
                </ul>
              )}
            </div>

            <FieldLabel>Mapping history ({a.history.length})</FieldLabel>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b">
                    <th className="py-2 pr-3">Shipment</th>
                    <th className="py-2 pr-3">Shipment Status</th>
                    <th className="py-2 pr-3">Route</th>
                    <th className="py-2 pr-3">Mapped</th>
                    <th className="py-2 pr-3">Removed</th>
                  </tr>
                </thead>
                <tbody>
                  {a.history.map((e, i) => (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3"><ShipmentLink e={e} /></td>
                      <td className="py-2 pr-3">{e.shipmentStatus ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{e.routeFrom ?? '—'} → {e.routeTo ?? '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(e.mappedDate)}{e.mappedBy ? <span className="text-slate-400"> · {e.mappedBy}</span> : null}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {e.removedDate
                          ? <>{formatDateTime(e.removedDate)}{e.removedBy ? <span className="text-slate-400"> · {e.removedBy}</span> : null}</>
                          : <span className="text-green-700 font-semibold">Current</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
