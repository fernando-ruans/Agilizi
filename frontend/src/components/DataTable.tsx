import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
  onPageChange?: (page: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, pagination, onPageChange,
  loading = false, emptyMessage = 'Nenhum registro encontrado',
  emptyIcon, onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {columns.map((col) => (
                <div key={col.key} className="flex-1">
                  <div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3 dark:bg-slate-800">
            {emptyIcon || <Inbox size={20} className="text-gray-300 dark:text-slate-600" />}
          </div>
          <p className="text-[13px] font-medium text-gray-500 dark:text-slate-400">{emptyMessage}</p>
          <p className="text-[12px] text-gray-400 mt-0.5 dark:text-slate-600">Os registros aparecerão aqui quando forem criados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.id || index} className={onRowClick ? 'cursor-pointer' : ''} onClick={() => onRowClick?.(item)}>
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(item) : (item[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-slate-800">
          <p className="text-[12px] text-gray-400 dark:text-slate-500">
            {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPageChange?.(pagination.page - 1)} disabled={pagination.page === 1} className="btn-ghost btn-sm rounded p-1">
              <ChevronLeft size={14} />
            </button>
            <span className="text-[12px] text-gray-500 px-2 tabular-nums dark:text-slate-400">
              {pagination.page}/{pagination.totalPages}
            </span>
            <button onClick={() => onPageChange?.(pagination.page + 1)} disabled={pagination.page === pagination.totalPages} className="btn-ghost btn-sm rounded p-1">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
