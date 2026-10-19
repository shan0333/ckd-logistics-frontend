'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { clearSession, isLoggedIn } from '@/lib/auth';
import { AccessProvider, pageAllowed, useAccess } from '@/lib/access';
import NoAccess from '@/components/ui/NoAccess';
import Spinner from '@/components/ui/Spinner';

const NO_SHELL_PATHS = ['/', '/login'];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const noShell = NO_SHELL_PATHS.includes(pathname);

  // isLoggedIn() reads sessionStorage, which doesn't exist during server rendering —
  // evaluating it during the initial render would make the client's first pass diverge from
  // the server's HTML (hydration mismatch). Defer to after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const allowed = noShell || !mounted || isLoggedIn();

  useEffect(() => {
    if (mounted && !allowed) router.replace('/login');
  }, [mounted, allowed, router]);

  if (noShell) {
    return <>{children}</>;
  }

  if (!allowed) {
    return null;
  }

  return (
    <AccessProvider enabled={mounted && isLoggedIn()}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:ml-56 pt-14 lg:pt-0 min-w-0">
          <Header />
          <div className="p-4 md:p-6"><PageGate pathname={pathname}>{children}</PageGate></div>
        </main>
      </div>
    </AccessProvider>
  );
}

// Blocks a page the user's group has no access to (direct links / bookmarks; the menu already
// hides it). The backend refuses the page's API calls either way.
function PageGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const state = useAccess();
  if (!state.loaded) return <Spinner />;
  if (!state.appAllowed) {
    return (
      <div data-testid="app-blocked" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-700">You don&apos;t have access to the Logistics application.</p>
        <p className="text-xs text-slate-500 mt-1">Please contact your admin if you need it.</p>
        <button
          onClick={() => { clearSession(); document.cookie = 'logistics_token=; Max-Age=0; path=/'; window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/login`; }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
          Back to login
        </button>
      </div>
    );
  }
  if (!pageAllowed(pathname, state)) return <NoAccess />;
  return <>{children}</>;
}
