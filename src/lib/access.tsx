'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMyAccess } from './api';

// Group-based access (backend: LogisticsAccessService). Each module is VIEW, FULL or absent (no
// access). The backend enforces the same rules on every API; this only drives what the UI shows.
export type AccessModule =
  | 'SHIPMENTS' | 'RECEIVING' | 'SHIPMENT_REPORT' | 'BILLING_REPORT'
  | 'ODC_REPORT' | 'SOF' | 'TRANSPORTER' | 'BILLING';
export type AccessLevel = 'VIEW' | 'FULL';

export const ACCESS_MODULES: { key: AccessModule; label: string; report?: boolean }[] = [
  { key: 'SHIPMENTS', label: 'Shipments' },
  { key: 'RECEIVING', label: 'Receiving' },
  { key: 'SHIPMENT_REPORT', label: 'Shipment Reports', report: true },
  { key: 'BILLING_REPORT', label: 'Billing Reports', report: true },
  { key: 'ODC_REPORT', label: 'ODC Reports', report: true },
  { key: 'SOF', label: 'SOF', report: true },
  { key: 'TRANSPORTER', label: 'Transporter' },
  { key: 'BILLING', label: 'Billing' },
];

export interface MyAccess {
  admin: boolean;
  appAllowed: boolean;
  group: string | null;
  modules: Partial<Record<AccessModule, AccessLevel>>;
}

interface AccessState {
  loaded: boolean;
  access: MyAccess | null;
  canView: (m: AccessModule) => boolean;
  canEdit: (m: AccessModule) => boolean;
  isAccessAdmin: boolean;
  appAllowed: boolean;
}

const CACHE_KEY = 'logisticsAccess';

function readCache(): MyAccess | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as MyAccess) : null;
  } catch {
    return null;
  }
}

export function clearAccessCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

const AccessContext = createContext<AccessState>({
  loaded: false, access: null, canView: () => false, canEdit: () => false, isAccessAdmin: false, appAllowed: true,
});

/** Fetches the current user's access (the token must already be in the session). */
export async function fetchMyAccess(): Promise<MyAccess | null> {
  const res = await getMyAccess();
  const a = res.data?.data?.[0] as MyAccess | undefined;
  if (!a) return null;
  return { admin: !!a.admin, appAllowed: a.appAllowed !== false, group: a.group ?? null, modules: a.modules ?? {} };
}

export function writeAccessCache(a: MyAccess) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

// Loaded once per page load (and refreshed then), so an admin's change applies on the user's next
// page load. The sessionStorage copy only avoids a blank menu while the fresh copy is fetched.
export function AccessProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const [access, setAccess] = useState<MyAccess | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const cached = readCache();
    if (cached) { setAccess(cached); setLoaded(true); }
    let cancelled = false;
    fetchMyAccess()
      .then((fresh) => {
        if (cancelled || !fresh) return;
        setAccess(fresh);
        writeAccessCache(fresh);
      })
      .catch(() => { /* keep the cached copy; with none, everything stays hidden */ })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [enabled]);

  const canView = useCallback((m: AccessModule) => !!access?.modules?.[m], [access]);
  const canEdit = useCallback((m: AccessModule) => access?.modules?.[m] === 'FULL', [access]);

  return (
    <AccessContext.Provider value={{ loaded, access, canView, canEdit, isAccessAdmin: !!access?.admin, appAllowed: access?.appAllowed !== false }}>
      {children}
    </AccessContext.Provider>
  );
}

export const useAccess = () => useContext(AccessContext);

// Which module (and level) each page needs. First match wins, so specific paths come first.
const PAGE_RULES: { test: (p: string) => boolean; module?: AccessModule; level?: AccessLevel; adminOnly?: boolean }[] = [
  { test: (p) => p === '/orgin/new' || /^\/orgin\/[^/]+\/edit$/.test(p), module: 'SHIPMENTS', level: 'FULL' },
  { test: (p) => p === '/orgin' || p.startsWith('/orgin/'), module: 'SHIPMENTS' },
  { test: (p) => p.startsWith('/destination'), module: 'RECEIVING' },
  { test: (p) => p.startsWith('/report/shipment'), module: 'SHIPMENT_REPORT' },
  { test: (p) => p.startsWith('/report/billing'), module: 'BILLING_REPORT' },
  { test: (p) => p.startsWith('/report/odc') || p.startsWith('/report/asset'), module: 'ODC_REPORT' },
  { test: (p) => p.startsWith('/report/sof'), module: 'SOF' },
  { test: (p) => p.startsWith('/transporter-master'), module: 'TRANSPORTER' },
  { test: (p) => p.startsWith('/billing-details'), module: 'BILLING' },
  { test: (p) => p.startsWith('/settings/user-access'), adminOnly: true },
];

export function pageAllowed(pathname: string, state: AccessState): boolean {
  const rule = PAGE_RULES.find((r) => r.test(pathname));
  if (!rule) return true;
  if (rule.adminOnly) return state.isAccessAdmin;
  if (!rule.module) return true;
  return rule.level === 'FULL' ? state.canEdit(rule.module) : state.canView(rule.module);
}
