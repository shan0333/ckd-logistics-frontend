'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import type { IconType } from 'react-icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  RiTruckLine, RiRouteLine, RiInboxUnarchiveLine, RiAlarmWarningLine, RiLoginBoxLine, RiInboxArchiveLine,
  RiMoneyRupeeCircleLine, RiHandCoinLine, RiMapPinLine, RiBillLine, RiContactsLine, RiBox3Line,
  RiCalendarCheckLine, RiFileAddLine, RiBarcodeBoxLine, RiLoader4Line, RiDashboardLine, RiFilePdf2Line, RiToolsLine,
} from 'react-icons/ri';
import { downloadDashboardAsPdf } from '@/lib/pdfExport';
import { getUsername } from '@/lib/auth';
import { getDashboardAccess, getDashboardWeekly } from '@/lib/api';
import PeriodFilter, { periodCaption } from '@/components/dashboard/PeriodFilter';
import Widget, { AXIS, GRID, LEGEND, PdfButton, SERIES, STATUS, TOOLTIP, todayStr, useWidgetData, usePeriod } from '@/components/dashboard/Widget';

// ── response shapes (Logistics-backend DashboardV2Service) ──────────────────────────────────
interface Cards {
  total: number; inTransit: number; overdue: number; received: number; inwardOdc: number; receivingOdc: number;
  transporterBilling: number; customerBilling: number; billedShipments: number;
}
interface GroupRow { name: string; total: number; inTransit: number; received: number; receivingOdc?: number }
interface InvoiceStatus { billable: number; completed: number; draft: number; notBilled: number }
interface InwardOdc { shipments: number; odcCabins: number; totalShipments: number; byDestination: { name: string; shipments: number }[] }
interface WeeklyDay { date: string; created: number; received: number; assetsMapped: number }

const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat('en-IN').format(n || 0);
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
// Counts printed on every bar (zeros left blank) — tooltips don't exist in a PDF export.
const VALUE_LABEL = { fontSize: 11, fill: '#334155', fontWeight: 600 } as const;
const hideZero = (v: unknown) => (Number(v) > 0 ? String(v) : '');
const HBAR_RADIUS: [number, number, number, number] = [0, 4, 4, 0];

// ── Summary cards ───────────────────────────────────────────────────────────────────────────
function Tile({ icon: Icon, label, value, hint, tone = 'blue', testId }: {
  icon: IconType; label: string; value: string; hint?: string; tone?: 'blue' | 'orange' | 'aqua' | 'red' | 'violet' | 'amber' | 'slate' | 'green'; testId: string;
}) {
  const TONES = {
    blue: 'bg-blue-50 text-blue-600', orange: 'bg-orange-50 text-orange-600', aqua: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600', violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600', green: 'bg-green-50 text-green-700',
  };
  return (
    <div data-testid={testId} className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3 min-w-0">
      <span className={clsx('w-10 h-10 shrink-0 rounded-lg flex items-center justify-center', TONES[tone])}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums truncate" data-testid={`${testId}-value`}>{value}</div>
        {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

function SummaryCards({ sectionRef }: { sectionRef: (el: HTMLElement | null) => void }) {
  const [period, setPeriod] = usePeriod();
  const { data, loading, error } = useWidgetData<Cards>('cards', period);
  const ref = useRef<HTMLElement | null>(null);
  return (
    <section ref={(el) => { ref.current = el; sectionRef(el); }} data-testid="dash-cards" className="bg-white/60 rounded-xl border border-slate-200 p-4 md:p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">Shipments with LR date {periodCaption(period)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="pdf-hide"><PeriodFilter value={period} onChange={setPeriod} testId="dash-cards-period" /></div>
          {!loading && !error && <PdfButton target={ref} name="summary" testId="dash-cards-pdf" />}
        </div>
      </div>
      {loading ? (
        <div className="min-h-[120px] flex items-center justify-center text-slate-400 text-sm gap-2"><RiLoader4Line className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : error || !data ? (
        <div className="min-h-[120px] flex items-center justify-center text-red-600 text-sm">{error ?? 'Could not load the summary.'}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Tile testId="dash-card-total" icon={RiTruckLine} label="Total Shipments" value={num(data.total)} />
          <Tile testId="dash-card-intransit" icon={RiRouteLine} tone="orange" label="In Transit" value={num(data.inTransit)}
            hint={data.overdue ? `incl. ${num(data.overdue)} overdue` : 'vehicle not reported yet'} />
          <Tile testId="dash-card-received" icon={RiInboxUnarchiveLine} tone="aqua" label="Received" value={num(data.received)} hint="vehicle reported at destination" />
          <Tile testId="dash-card-overdue" icon={RiAlarmWarningLine} tone="red" label="Overdue" value={num(data.overdue)} hint="past ETA, not reported" />
          <Tile testId="dash-card-inward-odc" icon={RiLoginBoxLine} tone="violet" label="Inward ODC" value={num(data.inwardOdc)} hint="shipments with ODC cabins" />
          <Tile testId="dash-card-receiving-odc" icon={RiInboxArchiveLine} tone="amber" label="Receiving ODC" value={num(data.receivingOdc)} hint="ODC document at receiving" />
          <Tile testId="dash-card-transporter-billing" icon={RiMoneyRupeeCircleLine} tone="slate" label="Transporter Billing" value={inr(data.transporterBilling)}
            hint={`${num(data.billedShipments)} billed shipment${data.billedShipments === 1 ? '' : 's'} (final + draft)`} />
          <Tile testId="dash-card-customer-billing" icon={RiHandCoinLine} tone="green" label="Customer Billing" value={inr(data.customerBilling)}
            hint={`${num(data.billedShipments)} billed shipment${data.billedShipments === 1 ? '' : 's'} (final + draft)`} />
        </div>
      )}
    </section>
  );
}

// ── Shipments by destination ───────────────────────────────────────────────────────────────
function DestinationChart() {
  const [period, setPeriod] = usePeriod();
  const { data, loading, error } = useWidgetData<GroupRow[]>('destinations', period);
  const rows = data ?? [];
  return (
    <Widget testId="dash-destinations" exportName="shipments-by-destination" title="Shipments To — by Destination" icon={RiMapPinLine} className="lg:col-span-2"
      period={period} onPeriod={setPeriod} loading={loading} error={error} empty={!loading && rows.length === 0}
      table={{ columns: [{ key: 'name', label: 'Destination' }, { key: 'total', label: 'Total', numeric: true },
        { key: 'inTransit', label: 'In Transit', numeric: true }, { key: 'received', label: 'Received', numeric: true }], rows: rows as never }}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} interval={0} />
          <YAxis {...AXIS} allowDecimals={false} />
          <Tooltip {...TOOLTIP} />
          <Legend {...LEGEND} />
          <Bar dataKey="total" name="Total" fill={SERIES.total} radius={BAR_RADIUS} maxBarSize={28}>
            <LabelList dataKey="total" position="top" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
          <Bar dataKey="inTransit" name="In Transit" fill={SERIES.inTransit} radius={BAR_RADIUS} maxBarSize={28}>
            <LabelList dataKey="inTransit" position="top" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
          <Bar dataKey="received" name="Received" fill={SERIES.received} radius={BAR_RADIUS} maxBarSize={28}>
            <LabelList dataKey="received" position="top" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Widget>
  );
}

// ── Invoice status ─────────────────────────────────────────────────────────────────────────
function InvoiceStatusChart() {
  const [period, setPeriod] = usePeriod();
  const { data, loading, error } = useWidgetData<InvoiceStatus>('invoiceStatus', period);
  const parts = data ? [
    { key: 'completed', label: 'Invoice Completed', value: data.completed, color: STATUS.good, hint: 'billing final' },
    { key: 'draft', label: 'Billing in Draft', value: data.draft, color: STATUS.warning, hint: 'saved, not final' },
    { key: 'notBilled', label: 'Yet to be Billed', value: data.notBilled, color: STATUS.critical, hint: 'no billing yet' },
  ] : [];
  const total = data?.billable ?? 0;
  return (
    <Widget testId="dash-invoice" exportName="invoice-status" title="Invoice Status" icon={RiBillLine}
      subtitle={`Received shipments, LR date ${periodCaption(period)}`}
      period={period} onPeriod={setPeriod} loading={loading} error={error} empty={!loading && !error && total === 0}
      table={{ columns: [{ key: 'label', label: 'Status' }, { key: 'value', label: 'Shipments', numeric: true }], rows: parts as never }}>
      <div className="flex flex-col gap-4 pt-1">
        <div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums">{num(total)}</div>
          <div className="text-xs text-slate-500">received shipments that can be billed</div>
        </div>
        {/* one part-to-whole bar; 2px surface gaps between segments */}
        <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden bg-slate-100" role="img"
          aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
          {parts.filter((p) => p.value > 0).map((p) => (
            <div key={p.key} style={{ width: `${(p.value / Math.max(total, 1)) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
          ))}
        </div>
        <ul className="flex flex-col gap-2.5">
          {parts.map((p) => (
            <li key={p.key} data-testid={`dash-invoice-${p.key}`} className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{p.label}</span>
                <span className="block text-[11px] text-slate-400">{p.hint}</span>
              </span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">{num(p.value)}</span>
              <span className="w-11 text-right text-xs text-slate-500 tabular-nums">{total ? Math.round((p.value / total) * 100) : 0}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Widget>
  );
}

// ── Transporter shipments ──────────────────────────────────────────────────────────────────
function TransporterChart() {
  const [period, setPeriod] = usePeriod();
  const { data, loading, error } = useWidgetData<GroupRow[]>('transporters', period);
  const rows = data ?? [];
  return (
    <Widget testId="dash-transporters" exportName="transporter-shipments" title="Transporter Shipments" icon={RiContactsLine} className="lg:col-span-2"
      period={period} onPeriod={setPeriod} loading={loading} error={error} empty={!loading && rows.length === 0}
      table={{ columns: [{ key: 'name', label: 'Transporter' }, { key: 'total', label: 'Total', numeric: true },
        { key: 'received', label: 'Received', numeric: true }, { key: 'inTransit', label: 'In Transit', numeric: true },
        { key: 'receivingOdc', label: 'Receiving ODC', numeric: true }], rows: rows as never }}>
      <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 64 + 60)}>
        <BarChart data={rows} layout="vertical" barGap={2} barCategoryGap="18%" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
          <CartesianGrid {...GRID} vertical horizontal={false} />
          <XAxis type="number" {...AXIS} allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...AXIS} width={120} />
          <Tooltip {...TOOLTIP} />
          <Legend {...LEGEND} />
          <Bar dataKey="total" name="Total" fill={SERIES.total} radius={HBAR_RADIUS} maxBarSize={12}>
            <LabelList dataKey="total" position="right" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
          <Bar dataKey="received" name="Received" fill={SERIES.received} radius={HBAR_RADIUS} maxBarSize={12}>
            <LabelList dataKey="received" position="right" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
          <Bar dataKey="inTransit" name="In Transit" fill={SERIES.inTransit} radius={HBAR_RADIUS} maxBarSize={12}>
            <LabelList dataKey="inTransit" position="right" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
          <Bar dataKey="receivingOdc" name="Receiving ODC" fill={SERIES.receivingOdc} radius={HBAR_RADIUS} maxBarSize={12}>
            <LabelList dataKey="receivingOdc" position="right" style={VALUE_LABEL} formatter={hideZero} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Widget>
  );
}

// ── Inward ODC ─────────────────────────────────────────────────────────────────────────────
function InwardOdcChart() {
  const [period, setPeriod] = usePeriod();
  const { data, loading, error } = useWidgetData<InwardOdc>('inwardOdc', period);
  const rows = data?.byDestination ?? [];
  return (
    <Widget testId="dash-inward-odc" exportName="inward-odc" title="Inward ODC" icon={RiBox3Line}
      period={period} onPeriod={setPeriod} loading={loading} error={error}
      table={{ columns: [{ key: 'name', label: 'Destination' }, { key: 'shipments', label: 'ODC Shipments', numeric: true }], rows: rows as never }}>
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-end gap-4">
          <div>
            <div className="text-3xl font-bold text-slate-900 tabular-nums" data-testid="dash-inward-odc-total">{num(data?.shipments ?? 0)}</div>
            <div className="text-xs text-slate-500">shipments with Inward ODC</div>
          </div>
          <div className="text-xs text-slate-500 pb-1">
            {num(data?.odcCabins ?? 0)} ODC cabin{data?.odcCabins === 1 ? '' : 's'} · of {num(data?.totalShipments ?? 0)} shipments
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="min-h-[140px] flex items-center justify-center text-slate-400 text-sm">No Inward ODC in this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(150, rows.length * 34 + 20)}>
            <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...AXIS} width={110} />
              <Tooltip {...TOOLTIP} />
              <Bar dataKey="shipments" name="ODC Shipments" fill={SERIES.total} radius={HBAR_RADIUS} maxBarSize={16}>
                <LabelList dataKey="shipments" position="right" style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Widget>
  );
}

// ── Weekly status (fixed last 7 days, one request for all three) ───────────────────────────
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' });
};

function WeeklyCharts() {
  const [days, setDays] = useState<WeeklyDay[] | null>(null);
  const [range, setRange] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getDashboardWeekly()
      .then((res) => {
        const w = res.data?.data?.[0];
        setDays((w?.days ?? []).map((d: WeeklyDay) => ({ ...d, label: dayLabel(d.date) })));
        if (w) setRange(`${w.from.split('-').reverse().join('-')} to ${w.to.split('-').reverse().join('-')}`);
      })
      .catch((e) => setError(e?.response?.data?.message || 'Could not load the weekly status.'));
  }, []);

  const charts: { key: keyof WeeklyDay; title: string; icon: IconType; testId: string }[] = [
    { key: 'created', title: 'Shipments Created', icon: RiFileAddLine, testId: 'dash-weekly-created' },
    { key: 'received', title: 'Shipments Received', icon: RiCalendarCheckLine, testId: 'dash-weekly-received' },
    { key: 'assetsMapped', title: 'Assets Mapped', icon: RiBarcodeBoxLine, testId: 'dash-weekly-assets' },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {charts.map((c) => {
        const total = (days ?? []).reduce((a, d) => a + Number(d[c.key] ?? 0), 0);
        return (
          <Widget key={c.key} testId={c.testId} exportName={c.testId.replace('dash-', '')} title={c.title} icon={c.icon}
            subtitle={range ? `Weekly status · last 7 days (${range}) · ${num(total)} total` : 'Weekly status · last 7 days'}
            loading={days === null && !error} error={error}
            table={{ columns: [{ key: 'date', label: 'Date' }, { key: c.key, label: 'Count', numeric: true }], rows: (days ?? []) as never }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={days ?? []} margin={{ top: 18, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} interval={0} />
                <YAxis {...AXIS} allowDecimals={false} />
                <Tooltip {...TOOLTIP} labelFormatter={(_, p) => (p?.[0]?.payload?.date ? p[0].payload.date.split('-').reverse().join('-') : '')} />
                <Bar dataKey={c.key} name="Count" fill={SERIES.total} radius={BAR_RADIUS} maxBarSize={28}>
                  <LabelList dataKey={c.key} position="top" style={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Widget>
        );
      })}
    </div>
  );
}

// Rollout gate: the backend decides who sees the new dashboard (dashboard.v2.allowed-users); everyone
// else gets this notice. The /dashboard2 endpoints refuse non-allowed users too, so this isn't just UI.
function UnderDevelopment() {
  return (
    <div data-testid="dash-under-development" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 md:p-16 text-center max-w-3xl mx-auto mt-6">
      <span className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4"><RiToolsLine className="w-7 h-7" /></span>
      <h1 className="text-xl font-bold text-slate-800">Dashboard under development</h1>
      <p className="text-sm text-slate-500 mt-2">
        A new dashboard is being prepared and will be available soon. Meanwhile, Shipments, Receiving, Reports and Billing work as usual.
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  useEffect(() => {
    getDashboardAccess()
      .then((res) => setAccess(res.data?.data?.[0]?.allowed ? 'allowed' : 'denied'))
      .catch(() => setAccess('denied'));
  }, []);
  if (access === 'checking') {
    return <div className="min-h-[300px] flex items-center justify-center text-slate-400 text-sm gap-2"><RiLoader4Line className="w-4 h-4 animate-spin" /> Loading…</div>;
  }
  if (access === 'denied') return <UnderDevelopment />;
  return <Dashboard />;
}

function Dashboard() {
  // Full-dashboard PDF: each block below is captured as its own image so pages only ever break
  // *between* blocks (see lib/pdfExport). Side-by-side widgets are captured as their whole row,
  // so the PDF keeps the on-screen layout. What's captured is exactly what's on screen — each
  // widget's current period and chart/table view — and every caption shows its date range.
  const headerRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement | null>(null);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);
  const weeklyRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const exportFull = async () => {
    setExporting(true);
    const when = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    // The "generated …" line is shown only while the PDF is captured; wait two frames so it has painted.
    setGeneratedAt(`${when.replace(/\//g, '-')} by ${getUsername() || 'user'}`);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    try {
      await downloadDashboardAsPdf(
        [headerRef.current, summaryRef.current, row1Ref.current, row2Ref.current, weeklyRef.current],
        `dashboard-full-${todayStr()}.pdf`,
      );
    } catch {
      toast.error('Could not export the dashboard — please try again');
    } finally {
      setGeneratedAt(null);
      setExporting(false);
    }
  };

  return (
    <div>
      <div ref={headerRef} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><RiDashboardLine className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Each section has its own period (default: this month, by LR date). In Transit includes overdue shipments; Received means the vehicle has reported at the destination.
            </p>
            {generatedAt && <p className="text-xs font-semibold text-slate-600 mt-1">CKD Logistics · Dashboard report · generated {generatedAt}</p>}
          </div>
        </div>
        <button type="button" data-testid="dash-export-full" onClick={exportFull} disabled={exporting}
          className="pdf-hide flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {exporting ? <RiLoader4Line className="w-4 h-4 animate-spin" /> : <RiFilePdf2Line className="w-4 h-4" />}
          {exporting ? 'Preparing PDF…' : 'Export Full Dashboard PDF'}
        </button>
      </div>

      <SummaryCards sectionRef={(el) => { summaryRef.current = el; }} />

      <div ref={row1Ref} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <DestinationChart />
        <InvoiceStatusChart />
      </div>

      <div ref={row2Ref} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <TransporterChart />
        <InwardOdcChart />
      </div>

      <div ref={weeklyRef}><WeeklyCharts /></div>
    </div>
  );
}
