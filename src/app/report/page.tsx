'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccess, type AccessModule } from '@/lib/access';
import NoAccess from '@/components/ui/NoAccess';

const REPORTS: { module: AccessModule; href: string }[] = [
  { module: 'SHIPMENT_REPORT', href: '/report/shipment' },
  { module: 'BILLING_REPORT', href: '/report/billing' },
  { module: 'ODC_REPORT', href: '/report/odc' },
  { module: 'SOF', href: '/report/sof' },
];

// "Report" became the Reports menu — old links and bookmarks to /report land on the first report
// the user's group can open.
export default function ReportIndexPage() {
  const router = useRouter();
  const { canView } = useAccess();
  const first = REPORTS.find((r) => canView(r.module));
  useEffect(() => { if (first) router.replace(first.href); }, [first, router]);
  return first ? null : <NoAccess />;
}
