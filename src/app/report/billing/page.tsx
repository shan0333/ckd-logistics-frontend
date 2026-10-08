'use client';

import { withReportEnabled } from '@/components/reports/ReportGate';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { downloadBillingReport } from '@/lib/api';
import type { ReportFilter } from '@/lib/types';
import { reportErrorMessage, saveReport } from '@/lib/reportDownload';
import ReportFilters, { emptyReportFilter } from '@/components/reports/ReportFilters';
import ReportHeader from '@/components/reports/ReportHeader';
import Spinner from '@/components/ui/Spinner';
import { RiBillLine, RiFileExcel2Line, RiFilePdf2Line, RiPieChart2Line, RiListCheck2 } from 'react-icons/ri';

// Billing Report = the Shipment Report (same filters, summary and rows) plus each shipment's
// billing columns, left empty for shipments that haven't been billed yet.
function BillingReportPage() {
  const [filter, setFilter] = useState<ReportFilter>(emptyReportFilter());
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);

  const download = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try {
      const res = await downloadBillingReport(filter, format);
      saveReport(res, `Billing_Report.${format}`);
    } catch (e) {
      toast.error(await reportErrorMessage(e, 'Could not download the Billing report'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {busy && <Spinner fullScreen />}
      <ReportHeader icon={RiBillLine} tone="teal" title="Billing Report"
        subtitle="The Shipment Report with each shipment's billing details added."
        actions={<>
          <button data-testid="report-billing-download-xlsx" onClick={() => download('xlsx')} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 shadow-sm">
            <RiFileExcel2Line className="w-4 h-4" /> Excel
          </button>
          <button data-testid="report-billing-download-pdf" onClick={() => download('pdf')} disabled={!!busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            <RiFilePdf2Line className="w-4 h-4" /> PDF
          </button>
        </>} />

      <ReportFilters value={filter} onChange={setFilter} testIdPrefix="report-billing" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
          <RiPieChart2Line className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-700">Summary</div>
            <p className="text-xs text-slate-500 mt-0.5">Everything in the Shipment Report summary, plus billing: shipments billed (final / draft), not billed yet, transporter total, customer total and margin.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
          <RiListCheck2 className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-slate-700">Shipment breakup with billing</div>
            <p className="text-xs text-slate-500 mt-0.5">Every Shipment Report column, then billing status, GRN, POD, transporter invoice no / date / base fare / halting / total, customer invoice no / date / base fare / halting / total and margin. Empty for shipments not billed yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withReportEnabled('billing', BillingReportPage);
