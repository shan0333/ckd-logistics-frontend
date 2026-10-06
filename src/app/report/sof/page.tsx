'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { downloadSofReport } from '@/lib/api';
import { isAdmin } from '@/lib/auth';
import { reportErrorMessage, saveReport } from '@/lib/reportDownload';
import { FieldLabel } from '@/components/ui/SectionCard';
import Spinner from '@/components/ui/Spinner';
import SearchSelect from '@/components/reports/SearchSelect';
import ReportHeader from '@/components/reports/ReportHeader';
import { loadShipmentOptions } from '@/components/reports/ReportFilters';
import { RiFileShieldLine, RiFilePdf2Line, RiLock2Line } from 'react-icons/ri';

const SECTIONS = ['Shipment details', 'Key dates (LR, ETA, ATA, delay)', 'Receiving', 'Cabins / Inward ODC',
  'All documents', 'Asset mapping (current and removed)', 'Billing (transporter & customer, margin)', 'Full event timeline'];

// Statement of Facts — admin only (the sidebar hides it for others and the backend returns 403).
export default function SofReportPage() {
  const [mounted, setMounted] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const shipmentNo = picked[0] ?? '';
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const download = async () => {
    const no = shipmentNo.trim();
    if (!no) { toast.error('Pick a Shipment No'); return; }
    setBusy(true);
    try {
      const res = await downloadSofReport(no);
      saveReport(res, `SOF_${no}.pdf`);
    } catch (e) {
      toast.error(await reportErrorMessage(e, 'Could not download the SOF report'));
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;
  if (!isAdmin()) {
    return (
      <div data-testid="report-sof-no-access" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
        <RiLock2Line className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">The SOF report is available to Admin users only.</p>
      </div>
    );
  }

  return (
    <div>
      {busy && <Spinner fullScreen />}
      <ReportHeader icon={RiFileShieldLine} tone="purple" title="SOF — Statement of Facts"
        subtitle="Complete history of one shipment, including billing. Admin only." />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col gap-5 max-w-3xl">
        <div>
          <FieldLabel>Shipment No</FieldLabel>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <SearchSelect single testId="report-sof-shipment-no" value={picked} onChange={setPicked}
                loadOptions={loadShipmentOptions} placeholder="Search shipment number…" emptyText="No shipment found" />
            </div>
            <button data-testid="report-sof-download-pdf" onClick={download} disabled={busy || !shipmentNo}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <RiFilePdf2Line className="w-4 h-4" /> Download SOF
            </button>
          </div>
        </div>
        <div>
          <FieldLabel>Includes</FieldLabel>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-slate-600 list-disc pl-5">
            {SECTIONS.map((s) => <li key={s}>{s}</li>)}
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            Detailed event history is recorded from 6 Oct 2026. For earlier activity the timeline is rebuilt from saved dates
            and marked &quot;(from records)&quot;.
          </p>
        </div>
      </div>
    </div>
  );
}
