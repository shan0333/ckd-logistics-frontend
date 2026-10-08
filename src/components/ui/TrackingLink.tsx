import { RiExternalLinkLine } from 'react-icons/ri';

/** The URL to open for a tracking link, or null if it isn't a plain http/https web address.
 *  "www.x.com" (no scheme) is opened as https — the same normalization the backend saves. Anything
 *  else (e.g. "javascript:...") is never turned into a clickable link. */
export function trackingHref(link?: string | null): string | null {
  const v = (link ?? '').trim();
  if (!v) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Clickable tracking link — always opens in a new tab. Shows "—" when there's none. */
export default function TrackingLink({ link, testId, compact }: { link?: string | null; testId: string; compact?: boolean }) {
  const href = trackingHref(link);
  if (!href) return <span className="text-slate-900 text-sm font-semibold">—</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testId} title={href}
      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline max-w-full">
      <span className={compact ? '' : 'truncate'}>{compact ? 'Open' : link}</span>
      <RiExternalLinkLine className="w-4 h-4 shrink-0" />
    </a>
  );
}
