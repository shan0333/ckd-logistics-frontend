// Which Reports-menu reports users can see. All four are built and deployed (frontend pages and
// backend /reports endpoints), but only the Shipment Report is switched on for now — ODC, Asset
// and SOF are waiting for management sign-off. To enable one, add its key here and redeploy the
// frontend; nothing else needs to change.
export type ReportKey = 'shipment' | 'odc' | 'asset' | 'sof';

export const ENABLED_REPORTS: ReportKey[] = ['shipment'];

export const isReportEnabled = (key: ReportKey) => ENABLED_REPORTS.includes(key);
