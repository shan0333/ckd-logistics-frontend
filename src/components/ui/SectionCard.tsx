import type { IconType } from 'react-icons';

// Shared "ERP-style" section chrome — a colored top border + icon chip + bold heading — used by
// both the Shipment view page and the New/Edit Shipment form so the two look like one system
// rather than a plain form bolted onto a styled report.
export type Accent = 'blue' | 'purple' | 'orange' | 'teal';

export const ACCENTS: Record<Accent, { border: string; chip: string; icon: string; title: string }> = {
  blue: { border: 'border-t-blue-500', chip: 'bg-blue-50', icon: 'text-blue-600', title: 'text-blue-800' },
  purple: { border: 'border-t-purple-500', chip: 'bg-purple-50', icon: 'text-purple-600', title: 'text-purple-800' },
  orange: { border: 'border-t-orange-500', chip: 'bg-orange-50', icon: 'text-orange-600', title: 'text-orange-800' },
  teal: { border: 'border-t-teal-500', chip: 'bg-teal-50', icon: 'text-teal-600', title: 'text-teal-800' },
};

export function SectionCard({ title, icon: Icon, accent, children, className }: {
  title: string;
  icon: IconType;
  accent: Accent;
  children: React.ReactNode;
  className?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 border-t-4 ${a.border} p-5 ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${a.chip}`}>
          <Icon className={`w-4 h-4 ${a.icon}`} />
        </span>
        <h2 className={`text-sm font-bold tracking-wide ${a.title}`}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// A bold, uppercase, colored label for a form field — the input-side equivalent of Field's
// read-only label on the view page, so both pages "read" the same way.
export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
      {children}
    </label>
  );
}
