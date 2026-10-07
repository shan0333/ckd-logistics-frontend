'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { isReportEnabled, type ReportKey } from '@/lib/features';
import { RiTimeLine } from 'react-icons/ri';

// Wraps a report page so it only renders when that report is switched on in lib/features.ts —
// covers direct links/bookmarks to a report that's hidden from the menu.
export function withReportEnabled<P extends object>(key: ReportKey, Page: ComponentType<P>) {
  return function GatedReportPage(props: P) {
    if (!isReportEnabled(key)) {
      return (
        <div data-testid={`report-${key}-disabled`} className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
          <RiTimeLine className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">This report isn&apos;t available yet.</p>
          <Link href="/report/shipment" className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:underline">
            Go to Shipment Report
          </Link>
        </div>
      );
    }
    return <Page {...props} />;
  };
}
