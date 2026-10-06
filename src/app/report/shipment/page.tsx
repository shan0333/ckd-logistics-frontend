'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadShipmentReport } from '@/lib/api';
import type { ReportFilter } from '@/lib/types';
import { reportErrorMessage, saveReport } from '@/lib/reportDownload';
import ReportFilters, { emptyReportFilter } from '@/components/reports/ReportFilters';
import ReportHeader from '@/components/reports/ReportHeader';
import Spinner from '@/components/ui/Spinner';
import { RiTruckFill, RiFileExcel2Line, RiFilePdf2Line, RiPieChart2Line, RiListCheck2 } from 'react-icons/ri';

export default function ShipmentReportPage() {
  const [filter, setFilter] = useState<ReportFilter>(emptyReportFilter());
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  const download = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try {
      const res = await downloadShipmentReport(filter, format);
      saveReport(res, `Shipment_Report.${format}`);
    } catch (e) {
      toast.error(await reportErrorMessage(e, 'Could not download the Shipment report'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {busy && <Spinner fullScreen />}
      <ReportHeader icon={RiTruckFill} tone="blue" title="Shipment Report"
        subtitle="Summary first, then the breakup of every shipment matching the filters."
        actions={<>
          <button data-testid="report-shipment-download-xlsx" onClick={() => download('xlsx')} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
            <RiFileExcel2Line className="w-4 h-4" /> Excel
          </button>
          <button data-testid="report-shipment-download-pdf" onClick={() => download('pdf')} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            <RiFilePdf2Line className="w-4 h-4" /> PDF
          </button>
        </>} />

      <ReportFilters value={filter} onChange={setFilter} testIdPrefix="report-shipment" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
          <RiPieChart2Line className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-700">Summary</div>
            <p className="text-xs text-slate-500 mt-0.5">Total shipments, count per status, ODC shipments, assets mapped, on-time vs late (ATA vs ETA) with average delay, and a transporter-wise table.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
          <RiListCheck2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-700">Shipment breakup</div>
            <p className="text-xs text-slate-500 mt-0.5">One row per shipment: status, customer, route, vehicle, LR, ETA, ATA, delay, transporter, cabins/ODC, assets, created by/date. Excel has every column with filters on the header row.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
