import { useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

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
  /** Linha complementar (ex.: nome do registro, número, consequência). */
  details?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default' | 'success';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message, details,
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

  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => confirmRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tone =
    variant === 'danger'
      ? {
          ring: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400',
          button: 'btn-danger-solid',
          Icon: AlertTriangle,
        }
      : variant === 'success'
        ? {
            ring: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
            button: 'btn-primary',
            Icon: CheckCircle2,
          }
        : {
            ring: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
            button: 'btn-primary',
            Icon: Info,
          };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in dark:bg-black/60"
        onClick={() => { if (!loading) onClose(); }}
      />
      <div className="relative w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-modal animate-scale-in p-5 dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-start gap-3.5">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone.ring}`} aria-hidden="true">
            <tone.Icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-[15px] font-semibold tracking-tight text-gray-800 dark:text-slate-100">{title}</h3>
            <p id="confirm-dialog-message" className="mt-1 text-[13px] leading-5 text-gray-500 dark:text-slate-400">{message}</p>
            {details && (
              <p className="mt-2.5 rounded-md bg-gray-50 px-2.5 py-2 text-[12px] leading-5 text-gray-500 dark:bg-slate-800/70 dark:text-slate-400">
                {details}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary btn-sm" disabled={loading} autoFocus={false}>Cancelar</button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={`btn btn-sm ${tone.button}`}
          >
            {loading && <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
