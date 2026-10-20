import { ICON_URL } from '@/lib/branding';

// Sidebar / top-bar brand: the SPACEAGE CONNECT emblem + the app name (the full logo is too wide here).
export default function BrandMark({ name, className = 'text-lg' }: { name: string; className?: string }) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ICON_URL} alt="" width={28} height={28} className="w-7 h-7 shrink-0" />
      <span className={`text-white font-bold truncate ${className}`}>{name}</span>
    </span>
  );
}
