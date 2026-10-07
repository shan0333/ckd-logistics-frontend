'use client';

import { withReportEnabled } from '@/components/reports/ReportGate';
import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { downloadOdcReport } from '@/lib/api';
import type { ReportFilter } from '@/lib/types';
import { reportErrorMessage, saveReport } from '@/lib/reportDownload';
import ReportFilters, { emptyReportFilter } from '@/components/reports/ReportFilters';
import ReportHeader from '@/components/reports/ReportHeader';
import Spinner from '@/components/ui/Spinner';
import { RiBox3Line, RiFilePdf2Line, RiLoginBoxLine, RiInboxArchiveLine, RiStackLine } from 'react-icons/ri';
import type { IconType } from 'react-icons';

type OdcType = NonNullable<ReportFilter['odcType']>;
const ODC_TYPES: { value: OdcType; label: string; hint: string; icon: IconType }[] = [
  { value: 'BOTH', label: 'Both', hint: 'Inward and Receiving ODC in one PDF', icon: RiStackLine },
  { value: 'INWARD', label: 'Inward ODC', hint: 'Cabins marked ODC at Shipment Creation, with their photos', icon: RiLoginBoxLine },
  { value: 'RECEIVING', label: 'Receiving ODC', hint: 'ODC documents uploaded at Receiving', icon: RiInboxArchiveLine },
];

function OdcReportPage() {
  const [filter, setFilter] = useState<ReportFilter>(emptyReportFilter({ odcType: 'BOTH' }));
  const [busy, setBusy] = useState(false);
  const type = filter.odcType ?? 'BOTH';

  const download = async () => {
    setBusy(true);
    try {
      const res = await downloadOdcReport(filter);
      saveReport(res, 'ODC_Report.pdf');
    } catch (e) {
      toast.error(await reportErrorMessage(e, 'Could not download the ODC report'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {busy && <Spinner fullScreen />}
      <ReportHeader icon={RiBox3Line} tone="orange" title="ODC Report"
        subtitle="PDF with the uploaded ODC photos, per shipment. Reports with many photos take a little longer."
        actions={
          <button data-testid="report-odc-download-pdf" onClick={download} disabled={busy}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            <RiFilePdf2Line className="w-4 h-4" /> Download PDF
          </button>
        } />

      <ReportFilters value={filter} onChange={setFilter} testIdPrefix="report-odc"
        onReset={() => setFilter(emptyReportFilter({ odcType: 'BOTH' }))}
        extraActive={type !== 'BOTH' ? 1 : 0}
        extraSummary={[`Type: ${ODC_TYPES.find((t) => t.value === type)?.label}`]}
        extra={
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">ODC Type</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {ODC_TYPES.map((t) => {
                const on = type === t.value;
                const Icon = t.icon;
                return (
                  <button type="button" key={t.value} data-testid={`report-odc-type-${t.value}`} aria-pressed={on}
                    onClick={() => setFilter({ ...filter, odcType: t.value })}
                    className={clsx('flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                      on ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20' : 'border-slate-200 hover:border-slate-300')}>
                    <span className={clsx('w-8 h-8 shrink-0 rounded-lg flex items-center justify-center',
                      on ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500')}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{t.label}</span>
                      <span className="block text-xs text-slate-500">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        } />
    </div>
  );
}

// Hidden until management sign-off — see lib/features.ts.
export default withReportEnabled('odc', OdcReportPage);
