import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  DateRangePicker, DEFAULT_RANGE, applyPreset, formatRange, rangeParams,
  type DateRangeValue,
} from '../components/DateRangePicker';

function renderPicker(initial: DateRangeValue = DEFAULT_RANGE, onChange = vi.fn()) {
  render(<DateRangePicker value={initial} onChange={onChange} idPrefix="t" />);
  return { onChange };
}

describe('DateRangePicker', () => {
  it('renders all presets plus custom', () => {
    renderPicker();
    for (const label of ['Hoje', '7 dias', '90 dias', '12 meses', 'Mês', 'Tudo', 'Personalizado']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // "30 dias" was removed in favor of "Hoje" (month preset covers it)
    expect(screen.queryByRole('button', { name: '30 dias' })).not.toBeInTheDocument();
  });

  it('marks the active preset with aria-pressed', () => {
    renderPicker({ ...DEFAULT_RANGE, preset: '90d' });
    expect(screen.getByRole('button', { name: '90 dias' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking a preset calls onChange with concrete dates', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: '7 dias' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as DateRangeValue;
    expect(next.preset).toBe('7d');
    expect(next.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(next.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(next.startDate <= next.endDate).toBe(true);

    // 7 days = start is 6 days before end
    const days = (new Date(next.endDate).getTime() - new Date(next.startDate).getTime()) / 86400000;
    expect(days).toBe(6);
  });

  it("'Tudo' sends no dates", () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Tudo' }));
    const next = onChange.mock.calls[0][0] as DateRangeValue;
    expect(next).toEqual({ preset: 'all', startDate: '', endDate: '' });
    expect(rangeParams(next)).toEqual({});
  });

  it('clicking Personalizado reveals the date inputs', () => {
    renderPicker();
    expect(screen.queryByLabelText('Data inicial')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/ }));
    expect(screen.getByLabelText('Data inicial')).toBeInTheDocument();
    expect(screen.getByLabelText('Data final')).toBeInTheDocument();
  });

  it('custom range keeps values and reports them through onChange', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/ }));

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-01-10' } });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as DateRangeValue;
    expect(last.preset).toBe('custom');
    expect(last.startDate).toBe('2026-01-10');
  });

  it('start cannot be after end (auto-corrected)', () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Personalizado/ }));
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-05-20' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-05-10' } });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as DateRangeValue;
    expect(last.startDate <= last.endDate).toBe(true);
  });
});

describe('applyPreset', () => {
  it("'today' covers only the current day", () => {
    const out = applyPreset('today', DEFAULT_RANGE);
    expect(out.preset).toBe('today');
    expect(out.startDate).toBe(out.endDate);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(out.startDate).toBe(localToday);
  });

  it('month preset starts on day 1 and ends today', () => {
    const out = applyPreset('month', DEFAULT_RANGE);
    expect(out.preset).toBe('month');
    expect(Number(out.startDate.slice(8))).toBe(1);
    // Compare in local time — toISOString() would shift the day in UTC-3
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(out.endDate).toBe(localToday);
  });

  it('custom keeps existing dates', () => {
    const current: DateRangeValue = { preset: '7d', startDate: '2026-01-01', endDate: '2026-01-07' };
    expect(applyPreset('custom', current)).toEqual(current);
  });
});

describe('formatRange / rangeParams', () => {
  it('formats a custom range in pt-BR', () => {
    const label = formatRange({ preset: 'custom', startDate: '2026-03-01', endDate: '2026-03-31' });
    expect(label).toContain('01/03/2026');
    expect(label).toContain('31/03/2026');
  });

  it("'all' shows the whole-period label", () => {
    expect(formatRange({ preset: 'all', startDate: '', endDate: '' })).toBe('Todo o período');
  });

  it('rangeParams passes ISO dates for the API', () => {
    const params = rangeParams({ preset: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(params).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
  });
});
