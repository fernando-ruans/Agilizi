import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${sizeClasses[size]} bg-white rounded-lg border border-gray-200 shadow-modal animate-scale-in dark:bg-slate-900 dark:border-slate-700`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-[15px] font-semibold text-gray-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ──
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirmar', variant = 'default', loading = false,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-lg border border-gray-200 shadow-modal animate-scale-in p-5 dark:bg-slate-900 dark:border-slate-700">
        <h3 className="text-[15px] font-semibold text-gray-800 mb-1.5 dark:text-slate-100">{title}</h3>
        <p className="text-[13px] text-gray-500 mb-5 dark:text-slate-400">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary btn-sm" disabled={loading}>Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-sm ${variant === 'danger' ? 'btn-danger-solid' : 'btn-primary'}`}
          >
            {loading && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
