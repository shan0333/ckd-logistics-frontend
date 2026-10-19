import Link from 'next/link';
import { RiLockLine } from 'react-icons/ri';

export default function NoAccess() {
  return (
    <div data-testid="no-access" className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
      <RiLockLine className="w-8 h-8 mx-auto text-slate-300 mb-2" />
      <p className="text-sm font-semibold text-slate-600">You don&apos;t have access to this page.</p>
      <p className="text-xs text-slate-400 mt-1">Please contact your admin if you need it.</p>
      <Link href="/dashboard" className="inline-block mt-3 text-sm font-semibold text-blue-600 hover:underline">
        Go to Dashboard
      </Link>
    </div>
  );
}
