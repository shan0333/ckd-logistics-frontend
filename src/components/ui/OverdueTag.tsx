import type { Orgin } from '@/lib/types';
import { RiAlarmWarningLine } from 'react-icons/ri';

/**
 * Red "Overdue" tag shown next to a shipment's status when it missed its ETA after the fact —
 * i.e. the vehicle reported after the ETA date (status RECEIVED / WORK IN-PROGRESS / COMPLETED).
 * An OVER DUE status already says it, so nothing extra is shown then.
 */
export default function OverdueTag({ row, testId }: { row: Pick<Orgin, 'overdue' | 'curr_status'>; testId?: string }) {
  if (row.overdue !== 'Y' || row.curr_status === 'OVER DUE') return null;
  return (
    <span data-testid={testId} title="Vehicle reported after the ETA date"
      className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 ring-1 ring-red-200">
      <RiAlarmWarningLine className="w-3 h-3" /> Overdue
    </span>
  );
}
