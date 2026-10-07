import { useState, useEffect, useRef } from 'react';
import { Search, Plus, X } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onAdd?: () => void;
  addLabel?: string;
  showAdd?: boolean;
}

export function PageHeader({ title, subtitle, onAdd, addLabel = 'Novo', showAdd = true }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold text-gray-800 tracking-tight dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-[13px] text-gray-400 mt-0.5 dark:text-slate-500">{subtitle}</p>}
      </div>
      {showAdd && onAdd && (
        <button onClick={onAdd} className="btn-primary shrink-0">
          <Plus size={14} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchBar({ value, onChange, placeholder = 'Buscar...', debounceMs = 300 }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), debounceMs);
  };

  const handleClear = () => { setLocal(''); onChange(''); };

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
      <input type="text" value={local} onChange={(e) => handleChange(e.target.value)} placeholder={placeholder} className="input pl-9 pr-8" />
      {local && (
        <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 dark:text-slate-500 dark:hover:text-slate-300">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

interface FilterBarProps {
  children: React.ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return <div className="flex items-center gap-3 flex-wrap">{children}</div>;
}
