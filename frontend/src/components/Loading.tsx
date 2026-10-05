export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex items-center gap-3 text-gray-400 dark:text-slate-500">
        <Spinner size={18} />
        <span className="text-[13px] font-medium">Carregando...</span>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="space-y-3">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-6 w-28 rounded" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="flex-1">
                <div className="skeleton h-3.5 rounded" style={{ width: `${50 + Math.random() * 40}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
