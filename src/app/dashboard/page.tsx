'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import {
  RiTruckLine, RiInboxUnarchiveLine, RiRouteLine, RiAlertLine,
  RiMapPinLine, RiBarChartBoxLine,
} from 'react-icons/ri';
import { getShipmentGraphInfo } from '@/lib/api';
import { getLocId } from '@/lib/auth';
import Spinner from '@/components/ui/Spinner';

interface GraphData {
  desti_labels?: string[]; desti_series?: number[];
  tr_labels?: string[]; tr_series?: number[];
  odc_labels?: string[]; odc_series?: number[];
  odcTrans_labels?: string[]; odcTrans_series?: number[];
  shipmentCount?: number; unloadedCount?: number;
  transistCount?: number; shipmentToCount?: number; odcCount?: number;
  pieChart?: { name: string; data: number[] }[];
  unloadChart?: { name: string; data: number[] }[];
  day?: string[];
}

interface StatTile {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}

const PALETTE = ['#1D4ED8', '#15803D', '#B45309', '#6D28D9', '#0F766E', '#B91C1C', '#475569'];
const colorAt = (i: number) => PALETTE[i % PALETTE.length];

function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
      {tiles.map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3 select-none cursor-default">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4 select-none cursor-default">
        <Icon className="w-4 h-4 text-slate-400" />
        {title}
      </div>
      {children}
    </div>
  );
}

// labels[i]/series[i] parallel arrays -> recharts' array-of-objects shape.
const zip = (labels?: string[], series?: number[]) =>
  (labels ?? []).map((name, i) => ({ name: name || 'Unassigned', value: series?.[i] ?? 0 }));

export default function DashboardPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const locId = getLocId();
    // getOrginListForDashboard (unlike the plain shipment list) parses loc_id with
    // Integer.parseInt and no null/empty guard — an empty string here 500s instead of falling
    // back to "no location filter" like every other Orgin endpoint. '-1' is that endpoint's own
    // "show everything" sentinel (see OrginServiceImpl.getOrginListForDashboard), so send that
    // explicitly for a user with no fixed location instead of ''.
    getShipmentGraphInfo({ loc_id: locId != null ? String(locId) : '-1', flag: 'O', status: [] })
      .then((res) => setData(res.data ?? null))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400">
        Couldn't load dashboard data.
      </div>
    );
  }

  // pieChart's per-entry `data` is a flat, unlabeled list of month-bucketed counts (the backend
  // groups by route-from then by month, but only keeps the counts — the month itself isn't
  // returned) — summing it back down to one total per route-from is the only sound way to use
  // this shape; anything finer-grained isn't actually in the response.
  const routeFromTotals = (data.pieChart ?? []).map((p) => ({
    name: p.name || 'Unassigned',
    value: (p.data ?? []).reduce((a, b) => a + b, 0),
  }));

  const destinationData = zip(data.desti_labels, data.desti_series);
  const transitData = zip(data.tr_labels, data.tr_series);
  const odcData = zip(data.odc_labels, data.odc_series);
  const odcTransData = zip(data.odcTrans_labels, data.odcTrans_series);

  // unloadChart is multi-series (one line per destination) over the same 7 day categories —
  // reshape into one row per day with one key per destination for recharts' LineChart.
  const days = data.day ?? [];
  const unloadSeries = data.unloadChart ?? [];
  const unloadRows = days.map((day, i) => {
    const row: Record<string, string | number> = { day };
    unloadSeries.forEach((u) => { row[u.name || 'Unassigned'] = u.data?.[i] ?? 0; });
    return row;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shipment Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All-time shipment volume across origin/destination locations (the unload trend below is the only part scoped to the last 7 days).
        </p>
      </div>

      <StatTiles tiles={[
        { icon: RiTruckLine, label: 'Total Shipments', value: data.shipmentCount ?? 0 },
        { icon: RiMapPinLine, label: 'Shipments To Destinations', value: data.shipmentToCount ?? 0 },
        { icon: RiInboxUnarchiveLine, label: 'Unloaded', value: data.unloadedCount ?? 0 },
        { icon: RiRouteLine, label: 'In Transit', value: data.transistCount ?? 0 },
        { icon: RiAlertLine, label: 'ODC Shipments', value: data.odcCount ?? 0 },
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard title="Shipments by Route From" icon={RiBarChartBoxLine}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={routeFromTotals}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {routeFromTotals.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Shipments by Destination" icon={RiMapPinLine}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={destinationData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {destinationData.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Unloaded — Last 7 Days" icon={RiInboxUnarchiveLine}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={unloadRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {unloadSeries.map((u, i) => (
                <Line key={u.name} type="monotone" dataKey={u.name || 'Unassigned'}
                  stroke={colorAt(i)} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="In Transit by Destination" icon={RiRouteLine}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={transitData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ODC Shipments by Destination" icon={RiAlertLine}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={odcData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#B91C1C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ODC Shipments by Transporter" icon={RiTruckLine}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={odcTransData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#6D28D9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
