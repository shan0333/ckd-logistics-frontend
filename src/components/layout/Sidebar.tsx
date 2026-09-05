'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  RiDashboardLine,
  RiTruckLine,
  RiInboxUnarchiveLine,
  RiFileChart2Line,
  RiMenuLine,
  RiCloseLine,
  RiLogoutBoxLine,
} from 'react-icons/ri';
import { clearSession } from '@/lib/auth';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard',   icon: RiDashboardLine,      testId: 'nav-dashboard' },
  { label: 'Shipments', href: '/orgin',       icon: RiTruckLine,          testId: 'nav-orgin' },
  { label: 'Receiving', href: '/destination', icon: RiInboxUnarchiveLine, testId: 'nav-destination' },
  { label: 'Report',    href: '/report',      icon: RiFileChart2Line,     testId: 'nav-report' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    document.cookie = 'logistics_token=; Max-Age=0; path=/';
    router.push('/login');
  };

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 flex-1 px-2 py-4">
      {NAV_ITEMS.map(({ label, href, icon: Icon, testId }) => (
        <Link
          key={href}
          href={href}
          data-testid={testId}
          onClick={() => setOpen(false)}
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            mounted && (pathname === href || pathname.startsWith(href + '/'))
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          )}
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
        </Link>
      ))}

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
        <span className="text-white font-bold text-lg">CKD Logistics</span>
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
          <span className="text-white font-bold text-lg">CKD Logistics</span>
          <button onClick={() => setOpen(false)} className="text-slate-300">
            <RiCloseLine className="w-6 h-6" />
          </button>
        </div>
        <NavLinks />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-slate-900 min-h-screen fixed top-0 left-0">
        <div className="flex items-center px-4 h-14 border-b border-slate-700">
          <span className="text-white font-bold text-base">CKD Logistics</span>
        </div>
        <NavLinks />
      </aside>
    </>
  );
}
