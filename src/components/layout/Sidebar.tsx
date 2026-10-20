'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  RiDashboardLine,
  RiTruckLine,
  RiInboxUnarchiveLine,
  RiFileChart2Line,
  RiContactsLine,
  RiBillLine,
  RiMenuLine,
  RiCloseLine,
  RiLogoutBoxLine,
  RiArrowDownSLine,
  RiTruckFill,
  RiBox3Line,
  RiBarcodeBoxLine,
  RiFileShieldLine,
  RiShieldUserLine,
  RiUserSettingsLine,
} from 'react-icons/ri';
import type { IconType } from 'react-icons';
import { clearSession } from '@/lib/auth';
import { useAccess, type AccessModule } from '@/lib/access';
import { isReportEnabled, type ReportKey } from '@/lib/features';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import BrandMark from './BrandMark';

// module: shown only to users whose group can at least view it (lib/access.tsx); adminOnly: ADMIN /
// SUPER ADMIN role only. Items with neither are shown to everyone.
interface NavItem { label: string; href: string; icon: IconType; testId: string; module?: AccessModule; adminOnly?: boolean; reportKey?: ReportKey }

const NAV_ITEMS: (NavItem | { label: string; icon: IconType; testId: string; base: string; children: NavItem[] })[] = [
  { label: 'Dashboard', href: '/dashboard',   icon: RiDashboardLine,      testId: 'nav-dashboard', module: 'DASHBOARD' },
  { label: 'Shipments', href: '/orgin',       icon: RiTruckLine,          testId: 'nav-orgin', module: 'SHIPMENTS' },
  { label: 'Receiving', href: '/destination', icon: RiInboxUnarchiveLine, testId: 'nav-destination', module: 'RECEIVING' },
  {
    label: 'Reports', icon: RiFileChart2Line, testId: 'nav-report', base: '/report',
    children: [
      { label: 'Shipment Report', href: '/report/shipment', icon: RiTruckFill,      testId: 'nav-report-shipment', reportKey: 'shipment', module: 'SHIPMENT_REPORT' },
      { label: 'Billing Report',  href: '/report/billing',  icon: RiBillLine,       testId: 'nav-report-billing', reportKey: 'billing', module: 'BILLING_REPORT' },
      { label: 'ODC Report',      href: '/report/odc',      icon: RiBox3Line,       testId: 'nav-report-odc', reportKey: 'odc', module: 'ODC_REPORT' },
      { label: 'Asset Report',    href: '/report/asset',    icon: RiBarcodeBoxLine, testId: 'nav-report-asset', reportKey: 'asset', module: 'ODC_REPORT' },
      { label: 'SOF',             href: '/report/sof',      icon: RiFileShieldLine, testId: 'nav-report-sof', reportKey: 'sof', module: 'SOF' },
    ],
  },
  { label: 'Transporters', href: '/transporter-master', icon: RiContactsLine, testId: 'nav-transporter-master', module: 'TRANSPORTER' },
  { label: 'Billing', href: '/billing-details', icon: RiBillLine, testId: 'nav-billing-details', module: 'BILLING' },
  { label: 'Users', href: '/users', icon: RiUserSettingsLine, testId: 'nav-users', adminOnly: true },
  { label: 'User Access', href: '/settings/user-access', icon: RiShieldUserLine, testId: 'nav-user-access', adminOnly: true },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const pathname = usePathname();
  const router = useRouter();
  const { canView, isAccessAdmin } = useAccess();
  const visible = (c: NavItem) => (!c.adminOnly || isAccessAdmin) && (!c.module || canView(c.module));
  // A group starts expanded whenever one of its pages is open; the user can still toggle it.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isActive = (href: string) => mounted && (pathname === href || pathname.startsWith(href + '/'));
  const linkClass = (active: boolean, nested = false) => clsx(
    'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
    nested ? 'pl-9 pr-3 py-2' : 'px-3 py-2.5',
    active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
  );

  const handleLogout = () => {
    clearSession();
    document.cookie = 'logistics_token=; Max-Age=0; path=/';
    router.push('/login');
  };

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 flex-1 px-2 py-4">
      {NAV_ITEMS.map((item) => {
        if ('children' in item) {
          const Icon = item.icon;
          // pathname is the same on server and client, so this needs no `mounted` guard — the
          // group is already open on first paint when one of its pages is showing.
          const inGroup = pathname === item.base || pathname.startsWith(item.base + '/');
          const isOpen = expanded[item.base] ?? inGroup;
          const children = item.children.filter((c) => visible(c) && (!c.reportKey || isReportEnabled(c.reportKey)));
          if (children.length === 0) return null;
          // Only one report switched on (lib/features.ts) — a one-item dropdown is pointless, so the
          // group shows as a plain link to it instead.
          if (children.length === 1) {
            return (
              <Link key={item.base} href={children[0].href} data-testid={item.testId} onClick={() => setOpen(false)}
                className={linkClass(isActive(item.base))}>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          }
          return (
            <div key={item.base}>
              <button type="button" data-testid={item.testId} aria-expanded={isOpen}
                onClick={() => setExpanded((p) => ({ ...p, [item.base]: !isOpen }))}
                className={clsx(linkClass(false), 'w-full', inGroup && 'text-white')}>
                <Icon className="w-5 h-5 shrink-0" />
                <span className="whitespace-nowrap flex-1 text-left">{item.label}</span>
                <RiArrowDownSLine className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="flex flex-col gap-1 mt-1">
                  {children.map(({ label, href, icon: ChildIcon, testId }) => (
                    <Link key={href} href={href} data-testid={testId} onClick={() => setOpen(false)}
                      className={linkClass(isActive(href), true)}>
                      <ChildIcon className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }
        if (!visible(item)) return null;
        const { label, href, icon: Icon, testId } = item;
        return (
          <Link key={href} href={href} data-testid={testId} onClick={() => setOpen(false)}
            className={linkClass(isActive(href))}>
            <Icon className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}

      <button
        data-testid="nav-logout"
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-700 hover:text-white transition-colors mt-auto"
      >
        <RiLogoutBoxLine className="w-5 h-5 shrink-0" />
        <span>Logout</span>
      </button>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-slate-900 px-4 h-14 shadow">
        <button onClick={() => setOpen(true)} className="text-white">
          <RiMenuLine className="w-6 h-6" />
        </button>
        <BrandMark name="CKD Logistics" />
        <div className="w-6" />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-700">
          <BrandMark name="CKD Logistics" />
          <button onClick={() => setOpen(false)} className="text-slate-300">
            <RiCloseLine className="w-6 h-6" />
          </button>
        </div>
        <NavLinks />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-slate-900 min-h-screen fixed top-0 left-0">
        <div className="flex items-center px-4 h-14 border-b border-slate-700">
          <BrandMark name="CKD Logistics" className="text-base" />
        </div>
        <NavLinks />
      </aside>
    </>
  );
}
