/**
 * Sanitized pagination: garbage or out-of-range page/limit values fall
 * back to defaults instead of producing NaN skip/take (which Prisma
 * rejects with a 500). Limit is capped to protect the DB.
 */
export function pageParams(
  query: { page?: unknown; limit?: unknown },
  maxLimit = 100,
): { page: number; limit: number; skip: number } {
  let page = parseInt(String(query.page ?? '1'), 10);
  let limit = parseInt(String(query.limit ?? '10'), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 10;
  limit = Math.min(limit, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}
