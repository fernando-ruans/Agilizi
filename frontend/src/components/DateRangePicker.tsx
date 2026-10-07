import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';

export type RangePreset = 'today' | '7d' | '90d' | '365d' | 'month' | 'all' | 'custom';

export interface DateRangeValue {
  preset: RangePreset;
  /** yyyy-mm-dd — always set when preset !== 'all' */
  startDate: string;
  endDate: string;
}

/** Default period: current calendar month (predictable, good for closings). */
export const DEFAULT_RANGE: DateRangeValue = (() => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { preset: 'month', startDate: toInputDate(start), endDate: toInputDate(today) };
})();

export function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Applies a preset and returns concrete start/end dates (yyyy-mm-dd). */
export function applyPreset(preset: RangePreset, current: DateRangeValue): DateRangeValue {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case 'today':
      // start and end are both "now" → the whole current day
      break;
    case '7d':
      start.setDate(start.getDate() - 6);
      break;
    case '90d':
      start.setDate(start.getDate() - 89);
      break;
    case '365d':
      start.setDate(start.getDate() - 364);
      break;
    case 'month':
      start.setDate(1);
      break;
    case 'all':
      return { preset: 'all', startDate: '', endDate: '' };
    case 'custom':
      // Keep the dates the user already picked
      return current;
  }

  return { preset, startDate: toInputDate(start), endDate: toInputDate(end) };
}

/** Formats the range for display in headers/reports. */
export function formatRange(value: DateRangeValue): string {
  if (value.preset === 'all') return 'Todo o período';
  const fmt = (iso: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') : '—';
  return `${fmt(value.startDate)} — ${fmt(value.endDate)}`;
}

/** Query params for the API (ISO strings; 'all' sends nothing). */
export function rangeParams(value: DateRangeValue): Record<string, string> {
  if (value.preset === 'all' || !value.startDate) return {};
  return { startDate: value.startDate, endDate: value.endDate };
}

const presets: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '90d', label: '90 dias' },
  { key: '365d', label: '12 meses' },
  { key: 'month', label: 'Mês' },
  { key: 'all', label: 'Tudo' },
];

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  idPrefix?: string;
  /** Render as a compact inline control (dashboard chart header). */
  compact?: boolean;
}

/**
 * Preset buttons + custom start/end date inputs.
 * Every list/report that filters by date uses this control, so the UX
 * stays identical across the app.
 */
export function DateRangePicker({ value, onChange, idPrefix = 'range', compact = false }: DateRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');

  const selectPreset = (preset: RangePreset) => {
    if (preset === 'custom') {
      setCustomOpen(true);
      onChange(applyPreset('custom', value.startDate ? value : DEFAULT_RANGE));
      return;
    }
    setCustomOpen(false);
    onChange(applyPreset(preset, value));
  };

  const updateCustom = (patch: Partial<Pick<DateRangeValue, 'startDate' | 'endDate'>>) => {
    const next = { ...value, preset: 'custom' as const, ...patch };
    // Keep the interval sane: start must not be after end
    if (next.startDate && next.endDate && next.startDate > next.endDate) {
      if (patch.startDate) next.endDate = next.startDate;
      else next.startDate = next.endDate;
    }
    onChange(next);
  };

  const size = compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]';

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-1.5' : 'flex flex-wrap items-center gap-2'}>
      <div className="flex max-w-full flex-wrap items-center gap-1" role="group" aria-label="Período">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => selectPreset(p.key)}
            aria-pressed={value.preset === p.key}
            className={`rounded-md font-medium transition-colors shrink-0 ${size} ${
              value.preset === p.key
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => selectPreset('custom')}
          aria-pressed={value.preset === 'custom'}
          className={`rounded-md font-medium transition-colors shrink-0 inline-flex items-center gap-1 ${size} ${
            value.preset === 'custom'
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          <CalendarDays size={12} />
          Personalizado
          <ChevronDown size={11} className={`transition-transform ${customOpen && value.preset === 'custom' ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {customOpen && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 animate-fade-in">
          <label htmlFor={`${idPrefix}-start`} className="sr-only">Data inicial</label>
          <input
            id={`${idPrefix}-start`}
            type="date"
            value={value.preset === 'custom' ? value.startDate : ''}
            max={value.preset === 'custom' ? value.endDate : undefined}
            onChange={(e) => updateCustom({ startDate: e.target.value })}
            className="input min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none !py-1.5 !text-[12px]"
            aria-label="Data inicial"
          />
          <span className="text-[12px] text-gray-400 shrink-0 dark:text-slate-500">até</span>
          <label htmlFor={`${idPrefix}-end`} className="sr-only">Data final</label>
          <input
            id={`${idPrefix}-end`}
            type="date"
            value={value.preset === 'custom' ? value.endDate : ''}
            min={value.preset === 'custom' ? value.startDate : undefined}
            onChange={(e) => updateCustom({ endDate: e.target.value })}
            className="input min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none !py-1.5 !text-[12px]"
            aria-label="Data final"
          />
        </div>
      )}
    </div>
  );
}
