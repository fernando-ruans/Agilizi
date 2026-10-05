/**
 * Shared helpers for date-range filters (dashboard, reports, lists).
 * All filters treat endDate as inclusive: "01/01 a 31/01" must include
 * transactions recorded at any time on Jan 31st.
 */

import { AppError } from './errors';

export interface DateRangeQuery {
  startDate?: unknown;
  endDate?: unknown;
}

/** Builds a Prisma date filter ({ gte, lte }) from user-provided bounds. */
export function toDateFilter(range: DateRangeQuery): Record<string, Date> | undefined {
  const startDate = normalize(range.startDate);
  const endDate = normalize(range.endDate);
  if (!startDate && !endDate) return undefined;

  const filter: Record<string, Date> = {};
  if (startDate) filter.gte = startOfDay(parseDate(startDate));
  if (endDate) filter.lte = endOfDay(parseDate(endDate));
  return filter;
}

/** Accepts strings coming straight from req.query (typed as unknown). */
function normalize(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  return value;
}

/**
 * Parses a user-provided date.
 *
 * Plain `new Date('2024-01-01')` is parsed as UTC midnight, which shifts
 * the day for negative-offset timezones (America/Sao_Paulo → Dec 31st).
 * yyyy-mm-dd strings (from <input type="date">) must be read as LOCAL days.
 */
export function parseDate(value: string): Date {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return new Date(value);
}

/** Midnight of the given day (validates to Invalid Date → throws). */
export function startOfDay(value: Date): Date {
  if (Number.isNaN(value.getTime())) {
    throw new AppError('Data inicial inválida', 400);
  }
  value.setHours(0, 0, 0, 0);
  return value;
}

/** Last millisecond of the given day. */
export function endOfDay(value: Date): Date {
  if (Number.isNaN(value.getTime())) {
    throw new AppError('Data final inválida', 400);
  }
  value.setHours(23, 59, 59, 999);
  return value;
}

/** Prisma `where` fragment for createdAt/date range filters. */
export function dateWhere(range: DateRangeQuery, field = 'date'): Record<string, any> {
  const filter = toDateFilter(range);
  return filter ? { [field]: filter } : {};
}
