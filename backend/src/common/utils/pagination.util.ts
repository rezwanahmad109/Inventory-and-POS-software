import { PaginatedResponse } from '../interfaces/paginated-response.interface';

export function toPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const safeLimit = Math.max(limit, 1);
  return {
    items,
    meta: {
      page,
      limit: safeLimit,
      total,
      totalPages: Math.max(Math.ceil(total / safeLimit), 1),
    },
  };
}
