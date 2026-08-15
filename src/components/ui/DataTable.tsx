'use client';

import { RiArrowUpLine, RiArrowDownLine } from 'react-icons/ri';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
  /** Omit this column from the mobile card view (e.g. low-priority columns on wide tables). */
  hideOnMobile?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  totalElements: number;
  page: number;
  pageSize: number;
  sortColumn: string;
  sortMode: string;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSort: (column: string, mode: string) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Opt-in header theming — every existing caller keeps the plain slate header unless it passes these. */
  headerClassName?: string;
  headerTextClassName?: string;
  /** Opt-in zebra striping (odd rows tinted) — off by default, same as before. */
  striped?: boolean;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  totalElements,
  page,
  pageSize,
  sortColumn,
  sortMode,
  loading,
  onPageChange,
  onSort,
  onPageSizeChange,
  headerClassName = 'bg-slate-50',
  headerTextClassName = 'text-slate-600',
  striped = false,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(totalElements / pageSize);

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      onSort(key, sortMode === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'asc');
    }
  };

  const actionsCol = columns.find((c) => c.key === 'actions');
  const cardFieldCols = columns.filter((c) => c.key !== 'actions' && !c.hideOnMobile);
  // Most tables lead with a bare numeric id ("#") — not a useful card headline, so promote
  // the next column (usually a name/description) to the title and demote "#" into the grid.
  const primaryIndex = cardFieldCols.length > 1 && (cardFieldCols[0].key === 'id' || cardFieldCols[0].label === '#') ? 1 : 0;
  const cardPrimary = cardFieldCols[primaryIndex];
  const cardRest = cardFieldCols.filter((_, idx) => idx !== primaryIndex);

  return (
    <div className="flex flex-col gap-3">
      {/* Table — tablet and up */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className={headerClassName}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : {}}
                  className={`px-4 py-3 text-left font-semibold whitespace-nowrap ${headerTextClassName} ${
                    col.sortable ? 'cursor-pointer select-none hover:brightness-95' : ''
                  }`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortColumn === col.key && (
                      sortMode === 'asc'
                        ? <RiArrowUpLine className="w-3.5 h-3.5" />
                        : <RiArrowDownLine className="w-3.5 h-3.5" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10 text-center text-slate-400">
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className={`hover:bg-slate-50 transition-colors ${striped && i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-slate-700 align-middle">
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile only */}
      <div className="md:hidden flex flex-col gap-3">
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : data.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No records found</div>
        ) : (
          data.map((row, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-slate-800 text-sm break-words">
                  {cardPrimary ? (cardPrimary.render ? cardPrimary.render(row) : row[cardPrimary.key] ?? '—') : null}
                </div>
                {actionsCol && <div className="shrink-0 -mr-2 -mt-1">{actionsCol.render?.(row)}</div>}
              </div>
              {cardRest.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  {cardRest.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-slate-400">{col.label}</dt>
                      <dd className="text-slate-700 truncate">{col.render ? col.render(row) : row[col.key] ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Showing {totalElements === 0 ? 0 : page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, totalElements)} of {totalElements}
          </span>
          {onPageSizeChange && (
            <label className="flex items-center gap-1.5">
              <span className="whitespace-nowrap">Rows per page</span>
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="border border-slate-200 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(0)}
            disabled={page === 0}
            className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-slate-100"
          >
            «
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-slate-100"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`px-2.5 py-1 rounded border ${
                  p === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-slate-100'
                }`}
              >
                {p + 1}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-slate-100"
          >
            ›
          </button>
          <button
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-slate-100"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
