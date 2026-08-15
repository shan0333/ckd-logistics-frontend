'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { getTransporterName, downloadLogReport } from '@/lib/api';
import { OrginFilter } from '@/lib/types';
import Spinner from '@/components/ui/Spinner';
import { RiFileChart2Line, RiDownload2Line } from 'react-icons/ri';

const DATE_STR = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

const STATUS_OPTIONS = ['NEW', 'TRANSIT', 'RECEIVED', 'WORK IN-PROGRESS', 'OVER DUE'];

export default function ReportPage() {
  const [transporters, setTransporters] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [transName, setTransName] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [receivedFromDate, setReceivedFromDate] = useState('');
  const [receivedToDate, setReceivedToDate] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getTransporterName()
      .then((res) => setTransporters(res.data ?? []))
      .catch(() => {});
  }, []);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const download = async () => {
    setDownloading(true);
    try {
      const filter: OrginFilter = {
        status, transName,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        received_fromDate: receivedFromDate || undefined,
        received_toDate: receivedToDate || undefined,
      };
      const blob = await downloadLogReport(filter);
      saveAs(blob.data, `Shipment_Report_${DATE_STR}.xlsx`);
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      {downloading && <Spinner fullScreen />}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4 md:p-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <RiFileChart2Line className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Shipment Report</h1>
            <p className="text-sm text-slate-500">Filter and export the shipment log as Excel.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 mb-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <label key={s} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                <input type="checkbox" checked={status.includes(s)} onChange={() => toggle(status, setStatus, s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Transporter</label>
          {transporters.length === 0 ? (
            <p className="text-sm text-slate-400">No transporters found yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {transporters.map((t) => (
                <label key={t} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-sm cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <input type="checkbox" checked={transName.includes(t)} onChange={() => toggle(transName, setTransName, t)} />
                  {t}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shipment Date Range (LR Date)</label>
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Received Date Range (Vehicle Reported)</label>
            <div className="flex items-center gap-2">
              <input type="date" value={receivedFromDate} onChange={(e) => setReceivedFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-sm">to</span>
              <input type="date" value={receivedToDate} onChange={(e) => setReceivedToDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={download}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            <RiDownload2Line /> Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}
