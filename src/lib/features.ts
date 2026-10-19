// Which Reports-menu reports users can see. Every report is switched on (management sign-off,
// 2026-10-08). To hide one again, remove its key here and redeploy the frontend — the sidebar
// entry disappears and its page shows "not available yet"; nothing else needs to change.
// Who sees each report is set per group under User Access (lib/access.tsx).
export type ReportKey = 'shipment' | 'billing' | 'odc' | 'asset' | 'sof';

export const ENABLED_REPORTS: ReportKey[] = ['shipment', 'billing', 'odc', 'asset', 'sof'];

export const isReportEnabled = (key: ReportKey) => ENABLED_REPORTS.includes(key);
