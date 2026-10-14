'use client';

import { useState } from 'react';
import { RiCalendarLine } from 'react-icons/ri';

export type PeriodKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'financialYear' | 'custom';
export interface Period { key: PeriodKey; from: string; to: string }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Weeks run Monday–Sunday; months are calendar months; the financial year is India's, 1 April – 31 March. */
export function presetRange(key: Exclude<PeriodKey, 'custom'>): Period {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const monday = new Date(y, m, d - ((now.getDay() + 6) % 7));
  switch (key) {
    case 'today': return { key, from: iso(now), to: iso(now) };
    case 'yesterday': { const yd = new Date(y, m, d - 1); return { key, from: iso(yd), to: iso(yd) }; }
    case 'financialYear': { const fy = m >= 3 ? y : y - 1; return { key, from: iso(new Date(fy, 3, 1)), to: iso(new Date(fy + 1, 2, 31)) }; }
    case 'thisWeek': return { key, from: iso(monday), to: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)) };
    case 'lastWeek': return { key, from: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7)), to: iso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1)) };
    case 'lastMonth': return { key, from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    default: return { key: 'thisMonth', from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
}

export const DEFAULT_PERIOD = () => presetRange('thisMonth');

const OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'financialYear', label: 'Financial Year' },
  { value: 'custom', label: 'Custom' },
];

const fmt = (s: string) => s.split('-').reverse().join('-');
export const periodCaption = (p: Period) => `${fmt(p.from)} to ${fmt(p.to)}`;

const INPUT = 'px-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

// One per widget: a period dropdown; "Custom" reveals From/To and only applies once both are
// set and valid, so the chart doesn't refetch on every keystroke of a half-typed range.
export default function PeriodFilter({ value, onChange, testId }: {
  value: Period; onChange: (p: Period) => void; testId: string;
}) {
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: value.from, to: value.to });
  const custom = value.key === 'custom';
  const invalid = !!draft.from && !!draft.to && draft.to < draft.from;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testId}>
      <div className="relative">
        <RiCalendarLine className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select data-testid={`${testId}-select`} value={value.key} aria-label="Period"
          onChange={(e) => {
            const k = e.target.value as PeriodKey;
            if (k === 'custom') { setDraft({ from: value.from, to: value.to }); onChange({ ...value, key: 'custom' }); }
            else onChange(presetRange(k));
          }}
          className="pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
          {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {custom && (
        <>
          <input type="date" aria-label="From date" data-testid={`${testId}-from`} className={INPUT} value={draft.from}
            onChange={(e) => {
              const next = { ...draft, from: e.target.value };
              setDraft(next);
              if (next.from && next.to && next.to >= next.from) onChange({ key: 'custom', ...next });
            }} />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" aria-label="To date" data-testid={`${testId}-to`} className={INPUT} value={draft.to}
            onChange={(e) => {
              const next = { ...draft, to: e.target.value };
              setDraft(next);
              if (next.from && next.to && next.to >= next.from) onChange({ key: 'custom', ...next });
            }} />
          {invalid && <span className="text-xs text-red-600">To must be after From</span>}
        </>
      )}
    </div>
  );
}
