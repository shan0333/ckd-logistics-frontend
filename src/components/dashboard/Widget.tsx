'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import type { IconType } from 'react-icons';
import { RiBarChart2Line, RiTableLine, RiLoader4Line, RiErrorWarningLine, RiDownload2Line } from 'react-icons/ri';
import { downloadElementAsPdf } from '@/lib/pdfExport';
import { getDashboardWidget, type DashboardWidget } from '@/lib/api';
import PeriodFilter, { DEFAULT_PERIOD, periodCaption, type Period } from '@/components/dashboard/PeriodFilter';

// One color per entity, the same in every chart (validated set — see dataviz palette check):
// Total = blue, In Transit = orange, Received = aqua, Receiving ODC = yellow.
export const SERIES = {
  total: '#2a78d6',
  inTransit: '#eb6834',
  received: '#1baf7a',
  receivingOdc: '#eda100',
} as const;
// Billing states use the reserved status colors, always shown with a text label.
export const STATUS = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' } as const;

export const AXIS = { tick: { fontSize: 11, fill: '#64748b' }, axisLine: { stroke: '#e2e8f0' }, tickLine: false } as const;
export const GRID = { stroke: '#f1f5f9', vertical: false } as const;
export const TOOLTIP = {
  cursor: { fill: 'rgba(148,163,184,0.12)' },
  contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(15,23,42,0.08)' },
} as const;
// itemSorter null = legend in the same order as the bars (recharts sorts by name otherwise).
export const LEGEND = { iconType: 'circle' as const, iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 8 }, itemSorter: null };

export interface TableSpec { columns: { key: string; label: string; numeric?: boolean }[]; rows: Record<string, unknown>[] }

/** Fetches one period widget, refetching whenever its own period changes. */
export function useWidgetData<T>(widget: DashboardWidget, period: Period) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // destinations/transporters answer with a list of rows; the other widgets with one object
    // (wrapped in a one-element list by the backend's ResponseDTO).
    const isList = widget === 'destinations' || widget === 'transporters';
    getDashboardWidget(widget, { from: period.from, to: period.to })
      .then((res) => {
        if (cancelled) return;
        const rows: unknown[] = Array.isArray(res.data?.data) ? res.data.data : [];
        setData((isList ? rows : rows[0] ?? null) as T);
      })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.message || 'Could not load this chart.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [widget, period.from, period.to]);
  return { data, loading, error };
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Small "PDF" button that downloads one element as a one-page PDF. Never captured itself. */
export function PdfButton({ target, name, testId }: { target: React.RefObject<HTMLElement | null>; name: string; testId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" data-testid={testId} disabled={busy} title="Download this as PDF"
      onClick={async () => {
        if (!target.current) return;
        setBusy(true);
        try { await downloadElementAsPdf(target.current, `dashboard-${name}-${todayStr()}.pdf`); }
        catch { toast.error('Could not export this chart — please try again'); }
        finally { setBusy(false); }
      }}
      className="pdf-hide flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 transition-colors">
      {busy ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" /> : <RiDownload2Line className="w-3.5 h-3.5" />} PDF
    </button>
  );
}

export function usePeriod() {
  return useState<Period>(DEFAULT_PERIOD);
}

export default function Widget({ title, subtitle, icon: Icon, period, onPeriod, testId, loading, error, empty, table, children, className, exportName, sectionRef }: {
  title: string;
  subtitle?: string;
  icon: IconType;
  /** Omit for widgets with a fixed range (weekly status). */
  period?: Period;
  onPeriod?: (p: Period) => void;
  testId: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  table?: TableSpec;
  children: ReactNode;
  className?: string;
  /** File-name part for this widget's own PDF ("dashboard-<exportName>-<date>.pdf"). */
  exportName: string;
  /** Lets the page capture this widget as a section of the full-dashboard PDF. */
  sectionRef?: (el: HTMLElement | null) => void;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const ref = useRef<HTMLElement | null>(null);
  return (
    <section ref={(el) => { ref.current = el; sectionRef?.(el); }} data-testid={testId} className={clsx('bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 flex flex-col min-w-0', className)}>
      {/* title + chart/table toggle on one line; the widget's own period filter on the next, so it
          never squeezes the title in the narrow (one-third width) widgets */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Icon className="w-4 h-4 text-slate-400 shrink-0" /> <span className="truncate">{title}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle ?? (period ? periodCaption(period) : '')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!loading && !error && <PdfButton target={ref} name={exportName} testId={`${testId}-pdf`} />}
          {table && (
            <div className="pdf-hide inline-flex p-0.5 bg-slate-100 rounded-md" role="group" aria-label="View">
              {(['chart', 'table'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} data-testid={`${testId}-view-${v}`} onClick={() => setView(v)}
                  title={v === 'chart' ? 'Chart' : 'Table'}
                  className={clsx('p-1.5 rounded', view === v ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                  {v === 'chart' ? <RiBarChart2Line className="w-3.5 h-3.5" /> : <RiTableLine className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {period && onPeriod && (
        <div className="pdf-hide mt-2.5"><PeriodFilter value={period} onChange={onPeriod} testId={`${testId}-period`} /></div>
      )}

      <div className="flex-1 min-h-0 mt-3">
        {loading ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-slate-400 text-sm gap-2">
            <RiLoader4Line className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-red-600 text-sm gap-2">
            <RiErrorWarningLine className="w-4 h-4" /> {error}
          </div>
        ) : empty ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-slate-400 text-sm">No shipments in this period.</div>
        ) : view === 'table' && table ? (
          <div className="overflow-auto max-h-[320px]">
            <table className="w-full text-sm" data-testid={`${testId}-table`}>
              <thead className="sticky top-0 bg-white">
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b">
                  {table.columns.map((c) => <th key={c.key} className={clsx('py-2 pr-3 font-bold', c.numeric ? 'text-right' : 'text-left')}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {table.columns.map((c) => (
                      <td key={c.key} className={clsx('py-1.5 pr-3', c.numeric ? 'text-right tabular-nums' : 'text-slate-700')}>{String(r[c.key] ?? '—')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : children}
      </div>
    </section>
  );
}
