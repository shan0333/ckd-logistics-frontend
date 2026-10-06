'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// "Report" became the Reports menu (Shipment / ODC / Asset / SOF) — old links and bookmarks to
// /report land on the Shipment Report, which replaces the old single shipment-log export.
export default function ReportIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/report/shipment'); }, [router]);
  return null;
}
