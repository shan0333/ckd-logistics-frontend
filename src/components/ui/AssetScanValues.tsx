import { parseScanValues } from '@/lib/assetScan';

// Shows what an asset scan contains — labelled values when the code is structured (see
// lib/assetScan.ts), otherwise the raw scanned text. Used by both the Shipment form and view.
export default function AssetScanValues({ code, testId }: { code?: string; testId?: string }) {
  const values = parseScanValues(code);

  if (!values) {
    return (
      <p data-testid={testId} className="text-sm font-mono text-slate-800 break-all">{code || '—'}</p>
    );
  }

  return (
    <dl data-testid={testId} className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {values.map((v, i) => (
        <div key={i} className="contents">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500 pt-0.5">{v.label}</dt>
          <dd className="text-slate-900 font-semibold break-all">{v.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
