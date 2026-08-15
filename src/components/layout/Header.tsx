'use client';

import { useEffect, useState } from 'react';
import { getUsername, getRoles } from '@/lib/auth';

export default function Header() {
  // getUsername()/getRoles() read sessionStorage, which doesn't exist during server
  // rendering — deferring to after mount avoids a hydration mismatch (same pattern as
  // Sidebar/LayoutShell's own mounted-gated role checks).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  const username = getUsername();
  if (!username) return null;

  const roles = getRoles();
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="sticky top-0 z-30 flex items-center justify-end gap-3 px-4 md:px-6 h-14 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
          {initials}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-slate-800">{username}</span>
          <span className="text-xs text-slate-500">{roles.join(', ')}</span>
        </div>
      </div>
    </div>
  );
}
