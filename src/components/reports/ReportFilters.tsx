'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { getTransporterName, searchShipmentNumbers } from '@/lib/api';
import type { ReportDateType, ReportFilter } from '@/lib/types';
import SearchSelect, { type SelectOption } from '@/components/reports/SearchSelect';
import { RiEqualizerLine, RiArrowDownSLine, RiCloseCircleLine } from 'react-icons/ri';

export const REPORT_STATUSES = ['NEW', 'TRANSIT', 'OVER DUE', 'WORK IN-PROGRESS', 'RECEIVED', 'COMPLETED'];

const STATUS_DOT: Record<string, string> = {
  NEW: 'bg-sky-500', TRANSIT: 'bg-blue-500', 'OVER DUE': 'bg-red-500',
  'WORK IN-PROGRESS': 'bg-amber-500', RECEIVED: 'bg-green-500', COMPLETED: 'bg-slate-500',
};

const DATE_TYPES: { value: ReportDateType; label: string; hint: string }[] = [
  { value: 'LR', label: 'LR Date', hint: 'Shipment (LR) date' },
  { value: 'ETA', label: 'ETA', hint: 'LR Date + Transit Days' },
  { value: 'ATA', label: 'ATA', hint: 'Vehicle Reported On (Receiving)' },
  { value: 'CREATED', label: 'Created', hint: 'When the shipment was entered (older shipments: LR Date)' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function preset(kind: 'today' | '7d' | 'month' | 'lastMonth'): [string, string] {
  const now = new Date();
  if (kind === 'today') return [iso(now), iso(now)];
  if (kind === '7d') return [iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), iso(now)];
  if (kind === 'month') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
  return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))];
}
const PRESETS: { kind: Parameters<typeof preset>[0]; label: string }[] = [
  { kind: 'today', label: 'Today' }, { kind: '7d', label: 'Last 7 days' },
  { kind: 'month', label: 'This month' }, { kind: 'lastMonth', label: 'Last month' },
];

const fmt = (s?: string) => (s ? s.split('-').reverse().join('-') : '…');
const INPUT = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

export const emptyReportFilter = (extra?: Partial<ReportFilter>): ReportFilter =>
  ({ dateType: 'LR', statuses: [], shipmentNos: [], transporters: [], ...extra });

/** Server search for the Shipment Numbers dropdown (shared with the SOF page). */
export const loadShipmentOptions = async (q: string): Promise<SelectOption[]> => {
  const res = await searchShipmentNumbers(q);
  const rows: { shipmentNo: string; lrDate?: string; vehicleNo?: string }[] = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows.map((r) => ({ value: r.shipmentNo, hint: [r.vehicleNo, r.lrDate].filter(Boolean).join(' · ') }));
};

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">{title}</div>
      {children}
    </div>
  );
}

// Collapsible filter panel shared by the Shipment and ODC reports. `extra` renders above the
// standard filters (e.g. ODC Type); `extraSummary` adds its chips to the collapsed summary.
export default function ReportFilters({ value, onChange, testIdPrefix, extra, extraSummary, extraActive = 0, onReset }: {
  value: ReportFilter;
  onChange: (f: ReportFilter) => void;
  testIdPrefix: string;
  extra?: ReactNode;
  extraSummary?: string[];
  extraActive?: number;
  onReset?: () => void;
}) {
  const storageKey = `reportFilters.open.${testIdPrefix}`;
  const [open, setOpen] = useState(true);
  const [transporters, setTransporters] = useState<SelectOption[]>([]);

  useEffect(() => {
    try { const v = localStorage.getItem(storageKey); if (v != null) setOpen(v === '1'); } catch { /* storage unavailable */ }
  }, [storageKey]);
  const toggleOpen = () => {
    setOpen((o) => { try { localStorage.setItem(storageKey, o ? '0' : '1'); } catch { /* ignore */ } return !o; });
  };

  useEffect(() => {
    getTransporterName()
      .then((res) => setTransporters((Array.isArray(res.data) ? res.data : []).filter(Boolean).map((t: string) => ({ value: t }))))
      .catch(() => {});
  }, []);

  const loadShipments = useCallback(loadShipmentOptions, []);

  const statuses = value.statuses ?? [];
  const dateType = value.dateType ?? 'LR';
  const hasDate = !!(value.fromDate || value.toDate);
  const activeCount = (statuses.length ? 1 : 0) + (hasDate ? 1 : 0) + ((value.shipmentNos ?? []).length ? 1 : 0)
    + ((value.transporters ?? []).length ? 1 : 0) + extraActive;

  const summary: string[] = [
    ...(extraSummary ?? []),
    ...(statuses.length ? [`Status: ${statuses.join(', ')}`] : []),
    ...(hasDate ? [`${DATE_TYPES.find((d) => d.value === dateType)?.label}: ${fmt(value.fromDate)} → ${fmt(value.toDate)}`] : []),
    ...((value.shipmentNos ?? []).length ? [`Shipments: ${value.shipmentNos!.length > 3 ? `${value.shipmentNos!.length} selected` : value.shipmentNos!.join(', ')}`] : []),
    ...((value.transporters ?? []).length ? [`Transporter: ${value.transporters!.length > 2 ? `${value.transporters!.length} selected` : value.transporters!.join(', ')}`] : []),
  ];

  const toggleStatus = (s: string) =>
    onChange({ ...value, statuses: statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s] });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 px-4 md:px-5 py-3">
        <button type="button" data-testid={`${testIdPrefix}-filters-toggle`} onClick={toggleOpen} aria-expanded={open}
          className="flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-blue-700">
          <RiEqualizerLine className="w-4 h-4" />
          Filters
          {activeCount > 0 && (
            <span data-testid={`${testIdPrefix}-filters-count`} className="min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
          <RiArrowDownSLine className={clsx('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>

        {!open && (
          <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
            {summary.length === 0
              ? <span className="text-xs text-slate-400">No filters — all shipments</span>
              : summary.map((s) => (
                <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium truncate max-w-[280px]">{s}</span>
              ))}
          </div>
        )}
        {open && <div className="flex-1" />}

        {activeCount > 0 && (
          <button type="button" data-testid={`${testIdPrefix}-filters-clear`}
            onClick={() => { onReset ? onReset() : onChange(emptyReportFilter({ odcType: value.odcType })); }}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 shrink-0">
            <RiCloseCircleLine className="w-4 h-4" /> Clear all
          </button>
        )}
        <button type="button" onClick={toggleOpen} className="text-xs font-semibold text-blue-600 hover:underline shrink-0">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 md:px-5 py-5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
          {extra && <div className="lg:col-span-2">{extra}</div>}

          <Section title="Status" className="lg:col-span-2">
            <div className="flex flex-wrap gap-2">
              {REPORT_STATUSES.map((s) => {
                const on = statuses.includes(s);
                return (
                  <button type="button" key={s} data-testid={`${testIdPrefix}-status-${s}`} aria-pressed={on} onClick={() => toggleStatus(s)}
                    className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                      on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400')}>
                    <span className={clsx('w-2 h-2 rounded-full', on ? 'bg-white' : STATUS_DOT[s])} />
                    {s}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">None selected = all statuses.</p>
          </Section>

          <Section title="Date Range" className="lg:col-span-2">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="inline-flex p-1 bg-slate-100 rounded-lg self-start">
                {DATE_TYPES.map((d) => (
                  <button type="button" key={d.value} title={d.hint} data-testid={`${testIdPrefix}-datetype-${d.value}`}
                    onClick={() => onChange({ ...value, dateType: d.value })}
                    className={clsx('px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors',
                      dateType === d.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 w-full xl:max-w-md">
                <input type="date" className={INPUT} data-testid={`${testIdPrefix}-from`} value={value.fromDate ?? ''}
                  onChange={(e) => onChange({ ...value, fromDate: e.target.value || undefined })} />
                <span className="text-slate-400 text-sm">to</span>
                <input type="date" className={INPUT} data-testid={`${testIdPrefix}-to`} value={value.toDate ?? ''}
                  onChange={(e) => onChange({ ...value, toDate: e.target.value || undefined })} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button type="button" key={p.kind} data-testid={`${testIdPrefix}-preset-${p.kind}`}
                    onClick={() => { const [f, t] = preset(p.kind); onChange({ ...value, fromDate: f, toDate: t }); }}
                    className="px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-700">
                    {p.label}
                  </button>
                ))}
                {hasDate && (
                  <button type="button" onClick={() => onChange({ ...value, fromDate: undefined, toDate: undefined })}
                    className="px-2.5 py-1 rounded-md text-xs text-slate-400 hover:text-red-600">Clear dates</button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{DATE_TYPES.find((d) => d.value === dateType)?.hint}. Leave empty for all dates.</p>
          </Section>

          <Section title="Shipment Numbers">
            <SearchSelect testId={`${testIdPrefix}-shipment-nos`} value={value.shipmentNos ?? []}
              onChange={(v) => onChange({ ...value, shipmentNos: v })}
              loadOptions={loadShipments} placeholder="Search shipment number…" emptyText="No shipment found" />
          </Section>

          <Section title="Transporter">
            <SearchSelect testId={`${testIdPrefix}-transporters`} value={value.transporters ?? []}
              onChange={(v) => onChange({ ...value, transporters: v })}
              options={transporters} placeholder="All transporters — search to pick" emptyText="No transporter found" />
          </Section>
        </div>
      )}
    </div>
  );
}
