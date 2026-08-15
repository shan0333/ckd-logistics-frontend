'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { isLoggedIn } from '@/lib/auth';

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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 lg:ml-56 pt-14 lg:pt-0 min-w-0">
        <Header />
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
