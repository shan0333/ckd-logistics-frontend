import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';

const TONES = {
  blue: 'bg-blue-50 text-blue-600',
  orange: 'bg-orange-50 text-orange-600',
  teal: 'bg-teal-50 text-teal-600',
  purple: 'bg-purple-50 text-purple-600',
};

// Title card shared by the Reports pages — icon, title, one-line description, actions on the right.
export default function ReportHeader({ icon: Icon, tone, title, subtitle, actions }: {
  icon: IconType;
  tone: keyof typeof TONES;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${TONES[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Reports</div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
