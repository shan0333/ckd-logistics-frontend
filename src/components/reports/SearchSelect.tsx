'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { RiArrowDownSLine, RiCheckLine, RiCloseLine, RiLoader4Line, RiSearchLine } from 'react-icons/ri';

export interface SelectOption {
  value: string;
  label?: string;
  hint?: string; // small grey text on the right, e.g. LR date
}

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  testId: string;
  /** Fixed list, filtered locally as the user types. */
  options?: SelectOption[];
  /** Or: server search, called (debounced) with the typed text — including '' on first open. */
  loadOptions?: (q: string) => Promise<SelectOption[]>;
  /** One value only (picking replaces it) — e.g. SOF's shipment. */
  single?: boolean;
  emptyText?: string;
}

// Search-as-you-type dropdown used by the report filters. Selected values show as removable chips
// inside the box; the list stays open while picking several (multi mode).
export default function SearchSelect({ value, onChange, placeholder, testId, options, loadOptions, single, emptyText }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open || !loadOptions) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      loadOptions(q.trim())
        .then((opts) => { if (!cancelled) setRemote(opts); })
        .catch(() => { if (!cancelled) setRemote([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open, loadOptions]);

  const list = useMemo(() => {
    if (loadOptions) return remote;
    const term = q.trim().toLowerCase();
    return (options ?? []).filter((o) => !term || (o.label ?? o.value).toLowerCase().includes(term));
  }, [loadOptions, remote, options, q]);

  const toggle = (v: string) => {
    if (single) {
      onChange(value[0] === v ? [] : [v]);
      setOpen(false);
      setQ('');
      return;
    }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    inputRef.current?.focus();
  };

  return (
    <div ref={boxRef} className="relative" data-testid={testId}>
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        className={clsx('min-h-[42px] w-full flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white border rounded-lg cursor-text transition-colors',
          open ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 hover:border-slate-400')}>
        <RiSearchLine className="w-4 h-4 text-slate-400 shrink-0" />
        {value.map((v) => (
          <span key={v} data-testid={`${testId}-chip-${v}`}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold">
            {options?.find((o) => o.value === v)?.label ?? v}
            <button type="button" aria-label={`Remove ${v}`} onClick={(e) => { e.stopPropagation(); toggle(v); }}
              className="p-0.5 rounded hover:bg-blue-100">
              <RiCloseLine className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input ref={inputRef} data-testid={`${testId}-input`} value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
            if (e.key === 'Enter' && list[0]) { e.preventDefault(); toggle(list[0].value); }
          }}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[120px] py-1 text-sm bg-transparent outline-none placeholder:text-slate-400" />
        {value.length > 0 && !single && (
          <button type="button" data-testid={`${testId}-clear`} onClick={(e) => { e.stopPropagation(); onChange([]); }}
            className="text-xs text-slate-400 hover:text-red-600 px-1">Clear</button>
        )}
        <RiArrowDownSLine className={clsx('w-4 h-4 text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400">
              <RiLoader4Line className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && list.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">{emptyText ?? 'No matches'}</div>
          )}
          {!loading && list.map((o) => {
            const selected = value.includes(o.value);
            return (
              <button type="button" key={o.value} data-testid={`${testId}-option-${o.value}`} onClick={() => toggle(o.value)}
                className={clsx('w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50',
                  selected && 'bg-blue-50/60')}>
                <span className={clsx('w-4 h-4 shrink-0 rounded border flex items-center justify-center',
                  selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300')}>
                  {selected && <RiCheckLine className="w-3 h-3" />}
                </span>
                <span className="flex-1 font-medium text-slate-800">{o.label ?? o.value}</span>
                {o.hint && <span className="text-xs text-slate-400">{o.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
