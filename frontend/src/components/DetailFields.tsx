import type { ReactNode } from 'react';

/** One label/value pair inside a detail (view) modal. */
export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5 dark:text-slate-500">{label}</p>
      <p className={`text-[13px] text-gray-700 dark:text-slate-300 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

/** Two-column grid of fields used by every "ver detalhes" modal. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

/** Section heading inside a detail modal (e.g. "Fotos", "Observações"). */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-1.5 dark:text-slate-500">{title}</p>
      {children}
    </div>
  );
}
